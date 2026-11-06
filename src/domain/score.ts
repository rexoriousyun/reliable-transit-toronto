/**
 * M4 — segment reliability scoring.
 *
 * Implements the engine contract in docs/product/PLAN.md. Six properties are
 * non-negotiable, each traced to a principle:
 *
 *   1. Percentiles, never a mean (P-01)
 *   2. Headway gap as the metric, not vehicle lateness (P-02, D-02)
 *   3. "unknown" is a real state, never rendered as healthy (P-03)
 *   4. Terminal approaches excluded from through-rider scores (P-04, D-06)
 *   5. Zero-minute records filtered, and the filter declared (P-08, E-D04)
 *   6. Every number traceable to window and sample size (P-08)
 */

import { prisma } from "../db/client.js";

/**
 * Sample sizes below which we decline to state a distribution.
 * Pre-registered so a thin segment cannot be talked into looking confident.
 */
/**
 * Half-life for recency weighting, in months.
 *
 * The network is not stationary: **35.9% of segments changed by 2x or more**
 * between the first and second halves of the archive, and 18.5% by 3x
 * (`E-D18`). Route changes, construction, signal work and reassignment all move
 * a segment's behaviour, so an incident from eighteen months ago is weak
 * evidence about next Tuesday.
 *
 * Tested against a two-month holdout on a fixed segment set. Flat windows peak
 * at six months (rho 0.530) and *decline* with more history (0.512 at
 * seventeen). Exponential decay beats every flat window, peaking here at a
 * three-month half-life (rho 0.543).
 *
 * Decay rather than truncation: a hard cutoff throws away the only evidence
 * thin segments have, while decay keeps it and merely discounts it.
 */
export const HALF_LIFE_MONTHS = 3;

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

/** Weight for an incident by age, halving every `HALF_LIFE_MONTHS`. */
export function recencyWeight(occurredAt: Date, now: Date): number {
  const ageMonths = Math.max(0, (now.getTime() - occurredAt.getTime()) / MS_PER_MONTH);
  return Math.pow(0.5, ageMonths / HALF_LIFE_MONTHS);
}

/**
 * Months of observation the weighting is equivalent to.
 *
 * The integral of the decay curve over the window. Dividing weighted minutes by
 * this keeps the published figure an honest per-month rate rather than an
 * uninterpretable weighted sum.
 */
export function effectiveMonths(windowMonths: number): number {
  const k = HALF_LIFE_MONTHS / Math.LN2;
  return k * (1 - Math.pow(0.5, windowMonths / HALF_LIFE_MONTHS));
}

/**
 * Thresholds on the **recency-weighted** sample, not on a raw count.
 *
 * A weighted sample of N is roughly N incidents within the last three months.
 * Three (about 11-17 raw incidents) is the bar for saying anything; twelve
 * (roughly 45-65 raw) for saying it with confidence.
 *
 * Recalibrated when decay landed. The old 5/30 bar was set on raw counts and is
 * far stricter once weighted — it left only 40 high-confidence segments in the
 * whole city. These are the same epistemic standard expressed in the new unit.
 */
export const CONFIDENCE = {
  high: 12,
  low: 3,
} as const;

export type Confidence = "high" | "low" | "unknown";

export interface SegmentReliability {
  segment: {
    id: string;
    routeId: string;
    direction: string;
    fromStation: string;
    toStation: string;
    isTerminalApproach: boolean;
  };
  /**
   * How often this segment costs riders time. This is the segment-specific
   * signal: rho = 0.68 across periods, so it persists and can be ranked (D-11).
   */
  exposure: { gapMinutesPerMonth: number; incidentsPerMonth: number } | null;
  /**
   * Wait once an incident happens, in minutes.
   *
   * `basis` matters. Severity does NOT persist per segment (rho = 0.10 with only
   * 3% ties, so genuinely unstable, not a scale artifact), which means a
   * per-segment p95 would imply a precision the data cannot support. It is
   * therefore pooled across the network and labelled as such (D-11, P-08).
   */
  severity: {
    p50: number;
    p90: number;
    p95: number;
    unit: "minutes";
    basis: "pooled-subway" | "pooled-surface";
  } | null;
  sample: {
    incidents: number;
    window: { start: string; end: string } | null;
    /** Stated so a reader knows what was excluded (P-08). */
    filters: string[];
  };
  causes: Array<{ code: string; description: string; share: number }>;
  confidence: Confidence;
}

export interface ScoreQuery {
  // Explicit `| undefined` so parsed query objects, where an absent field is
  // present-but-undefined, satisfy exactOptionalPropertyTypes.
  dayOfWeek?: string | undefined;
  hour?: number | undefined;
  /** Terminal approaches are excluded by default (D-06). */
  includeTerminalApproach?: boolean | undefined;
}

/** Nearest-rank percentile. Values must be sorted ascending. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error("percentile of empty sample");
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]!;
}

export function confidenceFor(n: number): Confidence {
  if (n >= CONFIDENCE.high) return "high";
  if (n >= CONFIDENCE.low) return "low";
  return "unknown";
}

/**
 * The most recent observation in the archive.
 *
 * Recency is measured from the data's own edge, not from wall-clock time: the
 * delay feed refreshes monthly, so "now" is up to a month behind, and using the
 * clock would silently discount the newest month we actually have.
 */
let latestCache: Date | null = null;
async function latestObservation(): Promise<Date> {
  if (latestCache !== null) return latestCache;
  const row = await prisma.delayIncident.findFirst({
    where: { minDelay: { gt: 0 } },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });
  return (latestCache = row?.occurredAt ?? new Date());
}

/** Length of the observation window in months, so rates are comparable. */
let monthsCache: number | null = null;
async function observationMonths(): Promise<number> {
  if (monthsCache !== null) return monthsCache;
  const [min, max] = await Promise.all([
    prisma.delayIncident.findFirst({ where: { minDelay: { gt: 0 } }, orderBy: { occurredAt: "asc" }, select: { occurredAt: true } }),
    prisma.delayIncident.findFirst({ where: { minDelay: { gt: 0 } }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } }),
  ]);
  if (min === null || max === null) return (monthsCache = 1);
  const ms = max.occurredAt.getTime() - min.occurredAt.getTime();
  return (monthsCache = Math.max(ms / (1000 * 60 * 60 * 24 * 30.44), 1));
}

/**
 * The pooled wait distribution, computed per mode.
 *
 * Pooling is not a shortcut: segment-level severity fails the persistence test
 * outright (E-D10), so a per-segment distribution would be noise dressed as
 * insight. But pooling across *modes* is wrong in the other direction — surface
 * waits run far longer than subway ones, so a single network pool shows a
 * subway rider percentiles drawn mostly from buses. Each mode gets its own pool.
 *
 * Terminal approaches are excluded here too, for the same reason as everywhere
 * else (D-06).
 */
const severityCache = new Map<string, SegmentReliability["severity"]>();
async function pooledSeverity(mode: string): Promise<SegmentReliability["severity"]> {
  const cached = severityCache.get(mode);
  if (cached !== undefined) return cached;

  // Bus and streetcar share a pool: both run in mixed traffic and behave alike,
  // and streetcar alone is thin.
  const modes = mode === "subway" ? ["subway"] : ["bus", "streetcar"];
  const rows = await prisma.delayIncident.findMany({
    where: {
      mode: { in: modes },
      minDelay: { gt: 0 },
      segmentId: { not: null },
      segment: { isTerminalApproach: false },
    },
    select: { minGap: true },
  });
  const gaps = rows.map((r) => r.minGap).sort((a, b) => a - b);
  const result: SegmentReliability["severity"] =
    gaps.length === 0
      ? null
      : {
          p50: percentile(gaps, 50),
          p90: percentile(gaps, 90),
          p95: percentile(gaps, 95),
          unit: "minutes",
          basis: mode === "subway" ? "pooled-subway" : "pooled-surface",
        };
  severityCache.set(mode, result);
  return result;
}

export async function scoreSegment(
  segmentId: string,
  query: ScoreQuery = {},
): Promise<SegmentReliability | null> {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (segment === null) return null;

  const filters = ["minDelay > 0 (excludes zero-minute non-events, E-D04)"];
  if (!(query.includeTerminalApproach ?? false) && segment.isTerminalApproach) {
    filters.push("terminal approach — turnaround incidents are not through-rider risk (D-06)");
  }
  if (query.dayOfWeek !== undefined) filters.push(`dayOfWeek = ${query.dayOfWeek}`);
  if (query.hour !== undefined) filters.push(`hour = ${query.hour}`);

  const incidents = await prisma.delayIncident.findMany({
    where: {
      segmentId,
      minDelay: { gt: 0 },
      ...(query.dayOfWeek !== undefined ? { dayOfWeek: query.dayOfWeek } : {}),
      ...(query.hour !== undefined ? { hour: query.hour } : {}),
    },
    select: { minGap: true, code: true, occurredAt: true },
  });

  const now = await latestObservation();
  const weights = incidents.map((i) => recencyWeight(i.occurredAt, now));
  const effectiveSample = weights.reduce((t, w) => t + w, 0);

  // Confidence is judged on the *weighted* sample. Thirty incidents that all
  // happened eighteen months ago are not thirty incidents' worth of evidence
  // about next week, and calling that "high confidence" would be the precise
  // failure P-08 exists to prevent.
  const confidence = confidenceFor(effectiveSample);

  const times = incidents.map((i) => i.occurredAt.getTime());
  const window =
    times.length > 0
      ? {
          start: new Date(Math.min(...times)).toISOString().slice(0, 10),
          end: new Date(Math.max(...times)).toISOString().slice(0, 10),
        }
      : null;

  // A thin sample gets no numbers at all. Publishing off four observations is
  // the kind of precise-looking lie P-08 exists to prevent.
  const months = await observationMonths();
  const denominator = effectiveMonths(months);
  const exposure =
    confidence === "unknown"
      ? null
      : {
          gapMinutesPerMonth: Number(
            (incidents.reduce((t, i, idx) => t + i.minGap * weights[idx]!, 0) / denominator).toFixed(1),
          ),
          incidentsPerMonth: Number((effectiveSample / denominator).toFixed(2)),
        };

  const severity = confidence === "unknown" ? null : await pooledSeverity(segment.mode);

  const counts = new Map<string, number>();
  for (const i of incidents) counts.set(i.code, (counts.get(i.code) ?? 0) + 1);

  const descriptions = new Map(
    (
      await prisma.delayCode.findMany({
        where: { mode: "subway", code: { in: [...counts.keys()] } },
      })
    ).map((c) => [c.code, c.description]),
  );

  const causes = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, n]) => ({
      code,
      description: descriptions.get(code) ?? "unknown",
      share: Number((n / incidents.length).toFixed(3)),
    }));

  return {
    segment: {
      id: segment.id,
      routeId: segment.routeId,
      direction: segment.direction,
      fromStation: segment.fromStation,
      toStation: segment.toStation,
      isTerminalApproach: segment.isTerminalApproach,
    },
    exposure,
    severity,
    sample: { incidents: incidents.length, window, filters },
    causes,
    confidence,
  };
}

/** Every segment on a route, ordered along the line, for the J-04 map. */
export async function scoreRoute(
  routeId: string,
  direction: string,
  query: ScoreQuery = {},
): Promise<SegmentReliability[]> {
  const segments = await prisma.segment.findMany({
    where: { routeId, direction },
    orderBy: { sequence: "asc" },
    select: { id: true },
  });

  const scored = await Promise.all(segments.map((s) => scoreSegment(s.id, query)));
  return scored.filter((s): s is SegmentReliability => s !== null);
}

/** One hour of the day on one segment. */
export interface HourBucket {
  hour: number;
  /** Null when the hour has too few observations to describe (`P-03`). */
  gapMinutesPerMonth: number | null;
  /** Weighted observations behind it, so the strip can hatch a thin bar. */
  sample: number;
}

/**
 * The whole day on one segment, hour by hour.
 *
 * Explore used two native `<select>`s — a day and an hour — so seeing how a
 * stretch behaves across the day meant twenty-four separate reads, each
 * replacing the last. The shape was never visible, which is the one thing an
 * hourly breakdown is for.
 *
 * **Every hour is returned, including the empty ones.** An hour with no
 * observations is not an hour with no risk; dropping it would let the strip
 * close up and imply service we cannot speak for is service that behaves. The
 * bar is drawn hatched instead, and `gapMinutesPerMonth` stays null (`P-03`).
 *
 * Recency-weighted on the same 3-month half-life as `scoreSegment` (`E-D18`),
 * and gated on the same confidence floor, so a bar and the headline figure
 * above it cannot disagree about what counts as known.
 */
export async function segmentByHour(
  segmentId: string,
  dayOfWeek?: string,
): Promise<HourBucket[] | null> {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (segment === null) return null;

  const incidents = await prisma.delayIncident.findMany({
    where: {
      segmentId,
      minDelay: { gt: 0 },
      ...(dayOfWeek === undefined ? {} : { dayOfWeek }),
    },
    select: { minGap: true, hour: true, occurredAt: true },
  });

  const now = await latestObservation();
  const denominator = effectiveMonths(await observationMonths());

  const gap = new Float64Array(24);
  const weight = new Float64Array(24);
  for (const i of incidents) {
    const h = i.hour;
    if (h === null || h < 0 || h > 23) continue;
    const w = recencyWeight(i.occurredAt, now);
    gap[h] = gap[h]! + i.minGap * w;
    weight[h] = weight[h]! + w;
  }

  return Array.from({ length: 24 }, (_, hour) => {
    const sample = weight[hour]!;
    return {
      hour,
      gapMinutesPerMonth:
        confidenceFor(sample) === "unknown"
          ? null
          : Number((gap[hour]! / denominator).toFixed(1)),
      sample: Number(sample.toFixed(2)),
    };
  });
}
