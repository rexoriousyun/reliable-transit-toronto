/**
 * What today's alerts actually say.
 *
 * The TTC populates every alert with `UNKNOWN_EFFECT`, so the feed's own enum
 * is useless and the meaning has to come from the description text. The text is
 * consistent enough to read:
 *
 *   "506 Carlton: Detour via Ossington Ave, Dundas St W and Bay St
 *    due to a blocked track."
 *
 * A route prefix, a kind, the change, and a cause. This module reads the kind
 * and the cause and refuses to guess anything else — notably the *extent* of a
 * closure, which is written as prose ("between Queens Quay Loop at Lower
 * Spadina Ave and Union Station Streetcar Platform") and would have to be
 * matched back to stops. Getting that wrong would strand a rider on a leg we
 * told them was fine, so it is left unparsed and the whole route is flagged.
 */

/** Ordered by how much they change a rider's plan, worst first. */
export type DisruptionKind = "no-service" | "bypass" | "detour" | "elevator" | "notice";

const SEVERITY: Record<DisruptionKind, number> = {
  "no-service": 3,
  bypass: 2,
  detour: 1,
  elevator: 1,
  notice: 0,
};

export function isServiceAffecting(kind: DisruptionKind): boolean {
  return kind === "no-service" || kind === "bypass";
}

export function moreSevere(a: DisruptionKind, b: DisruptionKind): DisruptionKind {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

/**
 * The kind of change an alert describes.
 *
 * Anything unrecognised is a notice, not a disruption. The feed carries real
 * public-service announcements — "Have proof of payment ready for inspection",
 * attached to eight routes at once — and treating an unmatched string as a
 * disruption would put a warning on trips that have nothing wrong with them.
 * The cost of the conservative direction is a missed alert; the cost of the
 * other is an app that cries wolf, which is how riders stop reading warnings.
 */
export function classifyDisruption(description: string, isElevator = false): DisruptionKind {
  if (isElevator) return "elevator";
  const text = description.toLowerCase();
  if (/\bno service\b|\bsuspended\b|\bclosed between\b/.test(text)) return "no-service";
  if (/\bbypass\b|\bnot stopping\b/.test(text)) return "bypass";
  if (/\bdetour\b|\bdiver(t|sion)\b/.test(text)) return "detour";
  return "notice";
}

/**
 * Why, in the TTC's own words.
 *
 * Both phrasings appear — "due to a collision" and "while we respond to a
 * medical emergency" — and the tail is already rider-readable, so it is lifted
 * rather than rewritten into a category of ours.
 */
export function causeOf(description: string): string | null {
  // The article is kept. "due to the CNE" and "due to a blocked track" both
  // read as English; stripping it leaves "— CNE." on screen, which reads like a
  // database field. The TTC already wrote this for riders.
  const m = /(?:due to|while we respond to)\s+([^.]+)\./i.exec(description);
  return m === null ? null : m[1]!.trim();
}

/** Is a shuttle running? Worth saying, because it changes what a rider does. */
export function hasShuttle(description: string): boolean {
  return /\bshuttle\b/i.test(description);
}

/**
 * The alert text with its route prefix removed.
 *
 * One incident is published once per affected route: a single security incident
 * at Scarborough Centre arrived as **17 alerts**, identical but for the route
 * name in front. Stripping the prefix is what lets them be recognised as one
 * event (E-D15).
 */
export function withoutRoutePrefix(description: string): string {
  return description.replace(/^\s*[0-9A-Za-z][^:]{0,60}:\s*/, "").trim();
}

export interface AlertLike {
  id: string;
  description: string;
  routeIds: string[];
  isElevator: boolean;
}

export interface Disruption {
  /** Stable across a cluster, so the interface can key on one event. */
  id: string;
  kind: DisruptionKind;
  /** Every route this one event affects. */
  routeIds: string[];
  cause: string | null;
  shuttle: boolean;
  /** The alert text, prefix stripped, for display. */
  text: string;
}

/**
 * One event per real-world incident, not one per route.
 *
 * Showing a rider seventeen warnings for one security incident is noise that
 * buries the one alert that affects them. Alerts with identical text once the
 * route prefix is stripped are the same event.
 */
export function clusterAlerts(alerts: readonly AlertLike[]): Disruption[] {
  const byText = new Map<string, Disruption>();
  for (const a of alerts) {
    const kind = classifyDisruption(a.description, a.isElevator);
    if (kind === "notice") continue;
    const text = withoutRoutePrefix(a.description);
    const key = `${kind}|${text}`;
    const existing = byText.get(key);
    if (existing === undefined) {
      byText.set(key, {
        id: a.id,
        kind,
        routeIds: [...a.routeIds],
        cause: causeOf(a.description),
        shuttle: hasShuttle(a.description),
        text,
      });
    } else {
      for (const r of a.routeIds) if (!existing.routeIds.includes(r)) existing.routeIds.push(r);
    }
  }
  return [...byText.values()];
}

/**
 * How old a snapshot may be before it stops being "today".
 *
 * The alerts feed carries no `active_period`: an alert's presence in the latest
 * fetch is the only evidence it is live, so an old snapshot is a list of things
 * that were true once. Incidents clear in hours. Beyond this the app says it
 * does not know rather than reporting a cleared detour as current — and it says
 * that out loud, because showing nothing would read as "nothing is wrong today"
 * (P-03).
 */
export const ALERTS_STALE_AFTER_HOURS = 12;

/**
 * When the alert snapshot was taken.
 *
 * The newest stored row, or the last fetch that succeeded and found nothing.
 * Reading it off the rows alone meant a quiet day, with no alerts at all, had
 * no time and so read as "we could not check" rather than "nothing is wrong".
 */
export function snapshotTime(rowTimes: Date[], lastFetch: Date | null): Date | null {
  let newest = lastFetch;
  for (const t of rowTimes) if (newest === null || t > newest) newest = t;
  return newest;
}

export function alertAgeHours(fetchedAt: Date, now: Date): number {
  return Math.max(0, (now.getTime() - fetchedAt.getTime()) / 3600000);
}
