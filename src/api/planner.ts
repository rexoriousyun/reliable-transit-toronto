/**
 * Trip planning endpoint.
 *
 * The connection set takes ~6s to build and is ~1.2M connections, so it is
 * built once on first use and held. A cold first request pays that cost; every
 * request after is single-digit milliseconds.
 */

import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { loadConnections, type ConnectionSet } from "../domain/connections.js";
import { displayStopName, displayStationName } from "../domain/stop-names.js";
import { departureAdvice, latestDeparture } from "../domain/departure.js";
import { inServiceDay, serviceDayTimes, DAY_SECONDS } from "../domain/time-bands.js";
import { clusterAlerts, isServiceAffecting, alertAgeHours, ALERTS_STALE_AFTER_HOURS, snapshotTime,
  type Disruption } from "../domain/disruption.js";
import { lastAlertsFetch } from "../ingest/alerts.js";
import { stationAccessMap, isUsable, type StationAccess } from "../domain/accessibility.js";
import { stationFromPlatform } from "../domain/stations.js";
import { BENCHMARK_PATH, MATERIAL_RATIO, MIN_COMPARABLE_COVERAGE, bucketFor, percentileOf, verdictFor,
  type BenchmarkTable, type Verdict } from "../benchmark/table.js";
import { buildFootpaths, type Footpaths } from "../domain/footpaths.js";
import { plan, planFromPoints, type Journey } from "../domain/csa.js";
import { buildFrequency, type SegmentFrequency } from "../domain/frequency.js";
import { notableWait } from "../domain/wait.js";
import { buildSegmentIndex, scoreJourney } from "../domain/itinerary.js";
import { walkOption, accessStops, collapsePointlessRides, type AccessStop } from "../domain/walk.js";
import { geocode } from "../domain/geocode.js";

/** GTFS service id for the weekday schedule. */
const WEEKDAY_SERVICE = "1";

interface Graph {
  connections: ConnectionSet;
  footpaths: Footpaths;
  stopNames: Map<string, string>;
  stopCoords: Map<string, { lat: number; lon: number }>;
  frequency: SegmentFrequency;
  segmentIndex: Awaited<ReturnType<typeof loadSegmentIndex>>;
  /** Stops a rider can actually depart from. Parent station nodes are not. */
  boardable: Set<string>;
  /**
   * Earliest and latest departure the loaded service covers, in seconds since
   * midnight. Only weekday service is ingested, so overnight Blue Night routes
   * are absent — and a rider asking at 2am must be told the data stops there,
   * not that the network does (P-03).
   */
  serviceWindow: { from: number; to: number };
}

async function loadSegmentIndex(): Promise<ReturnType<typeof buildSegmentIndex>> {
  const segments = await prisma.segment.findMany({
    select: {
      id: true, routeId: true, fromStation: true, toStation: true,
      fromStopId: true, toStopId: true, mode: true, geometry: true,
    },
  });
  return buildSegmentIndex(segments);
}

let graphPromise: Promise<Graph> | null = null;

/**
 * Build the graph before the server takes traffic.
 *
 * `getGraph` is lazy, which meant the ~12 s build landed on **the first rider
 * to plan a trip after a deploy** — twelve seconds of spinner, once, for
 * whoever happened to be first. During a rider session that is a finding about
 * the hosting contaminating a question about the design.
 *
 * Doing it at boot moves the wait onto the platform, which is what platforms
 * are for: a health check that stays unhealthy until this resolves means the
 * load balancer simply does not send anyone here yet.
 */
export async function warmGraph(): Promise<void> {
  const { warmScoring } = await import("../domain/itinerary.js");
  await Promise.all([getGraph(), warmScoring()]);
}

async function getGraph(): Promise<Graph> {
  graphPromise ??= (async (): Promise<Graph> => {
    const connections = await loadConnections(WEEKDAY_SERVICE);
    const stops = await prisma.stop.findMany({ select: { id: true, name: true, lat: true, lon: true } });
    const byId = new Map(stops.map((s) => [s.id, s]));

    const lat = new Float64Array(connections.stopIds.length);
    const lon = new Float64Array(connections.stopIds.length);
    for (let i = 0; i < connections.stopIds.length; i++) {
      const s = byId.get(connections.stopIds[i]!);
      lat[i] = s?.lat ?? 0;
      lon[i] = s?.lon ?? 0;
    }
    const stopNamesMap = new Map(stops.map((s) => [s.id, s.name]));
    // GTFS carries a parent node per station alongside its platforms. It has a
    // clean name and no departures, so search must not offer it: picking it
    // would return "no journey found" for a trip that plans fine.
    const boardable = new Set<string>();
    for (let i = 0; i < connections.fromStop.length; i++) {
      boardable.add(connections.stopIds[connections.fromStop[i]!]!);
    }
    const coords = new Map(stops.map((s) => [s.id, { lat: s.lat, lon: s.lon }]));
    let earliest = Infinity, latest = -Infinity;
    for (let i = 0; i < connections.count; i++) {
      const t = connections.depTime[i]!;
      if (t < earliest) earliest = t;
      if (t > latest) latest = t;
    }

    return {
      serviceWindow: { from: earliest, to: latest },
      stopCoords: coords,
      connections,
      footpaths: buildFootpaths(lat, lon),
      stopNames: stopNamesMap,
      frequency: buildFrequency(connections, (id) => stopNamesMap.get(id) ?? id),
      segmentIndex: await loadSegmentIndex(),
      boardable,
    };
  })();
  return graphPromise;
}

/**
 * How a trip compares with others of its length.
 *
 * "Goes wrong 1 trip in 181" is an analyst's number until there is something to
 * measure it against — the complaint Q-C makes about our whole unit vocabulary.
 * The table is built offline by `npm run benchmark`; a missing table or a thin
 * bucket yields no comparison rather than a guessed one (P-03).
 */
let benchmark: BenchmarkTable | null = null;
try {
  benchmark = JSON.parse(readFileSync(BENCHMARK_PATH, "utf8")) as BenchmarkTable;
} catch {
  benchmark = null;
}

interface Comparison {
  /** Share of comparable trips this one is safer than. */
  saferThan: number;
  /** What a typical trip of this length does, as 1 in N. */
  typicalOneInTrips: number | null;
  /** This trip's risk over the typical one's. Above 1 is worse. */
  ratioToTypical: number | null;
  /** The side the comparison takes — decided here, not in the interface. */
  verdict: Verdict;
  /** How the reference class is named on screen. */
  label: string;
}

function compare(
  risk: number,
  coverage: number,
  minutes: number,
  bandId: string | null,
): Comparison | null {
  if (benchmark === null) return null;
  // The reference only holds trips we could measure properly, so a thinly
  // measured trip has nothing fair to be ranked against. Saying so beats
  // ranking it against a standard it was not held to.
  if (coverage < MIN_COMPARABLE_COVERAGE) return null;
  const i = bucketFor(minutes);
  if (i === null) return null;
  const bucket = benchmark.buckets[i];
  if (bucket === undefined) return null;
  const reference = bandId === null ? bucket.allDay : (bucket.atTime[bandId] ?? null);
  const saferThan = percentileOf(risk, reference);
  if (saferThan === null || reference === null) return null;
  const median = reference[Math.floor(reference.length / 2)]!;
  const ratioToTypical = median > 0 ? Number((risk / median).toFixed(2)) : null;
  return {
    saferThan,
    typicalOneInTrips: median > 0 ? Math.round(1 / median) : null,
    ratioToTypical,
    verdict: verdictFor(saferThan, ratioToTypical),
    label: bucket.label,
  };
}

/**
 * Today's disruptions, clustered into events and keyed by route.
 *
 * Re-read per request rather than cached with the graph: the alerts table is
 * replaced on every ingest, and a plan that quotes a cleared incident is worse
 * than one that quotes none. The table holds tens of rows.
 */
async function disruptionsByRoute(): Promise<{
  byRoute: Map<string, Disruption[]>;
  fetchedAt: Date | null;
  ageHours: number | null;
  stale: boolean;
}> {
  const rows = await prisma.serviceAlert.findMany({
    select: { id: true, description: true, routeIds: true, isElevator: true, fetchedAt: true },
  });
  const fetchedAt = snapshotTime(rows.map((r) => r.fetchedAt), lastAlertsFetch());
  const ageHours = fetchedAt === null ? null : Number(alertAgeHours(fetchedAt, new Date()).toFixed(1));
  const stale = ageHours === null || ageHours > ALERTS_STALE_AFTER_HOURS;
  const events = clusterAlerts(rows.map((r) => ({
    id: r.id,
    description: r.description,
    isElevator: r.isElevator,
    routeIds: JSON.parse(r.routeIds) as string[],
  })));
  const byRoute = new Map<string, Disruption[]>();
  for (const d of events) {
    // Elevator alerts already drive the step-free filter (D-07); they name a
    // station, not a route, and would attach to nothing here.
    if (d.kind === "elevator") continue;
    for (const r of d.routeIds) {
      const list = byRoute.get(r);
      if (list === undefined) byRoute.set(r, [d]);
      else list.push(d);
    }
  }
  return { byRoute: stale ? new Map() : byRoute, fetchedAt, ageHours, stale };
}

/**
 * Stops a step-free rider cannot use, and the stations behind them.
 *
 * D-07 makes accessibility a filter applied before anything is ranked, and
 * until now the planner only *marked* blocked stations while still routing
 * through them. A station is unusable when it is not built step-free or its
 * elevator is out — and, per `isUsable`, when we simply do not know: absence of
 * an alert is not evidence an elevator works, and U-04 abandons us the first
 * time we send them somewhere we could not verify.
 *
 * Surface stops are not gated by this. A street corner has no elevator, so it
 * is not "accessibility unknown" — it is simply not a station.
 */
async function stepFreeBlocks(
  stopNames: Map<string, string>,
  ends: readonly string[],
): Promise<{ stops: Set<string>; stations: StationAccess[]; endsBlocked: StationAccess[] }> {
  const { states } = await stationAccessMap();

  // The rider's own ends are exempt *by station, not by stop*. Exempting only
  // the one stop id they picked left the other platforms of the same station
  // blocked, and the planner answered a Greenwood trip by riding past and
  // doubling back on the opposite platform — five minutes longer and plainly
  // absurd. They chose that station; what they need is to be told it is not
  // step-free, not to be routed around their own destination.
  const exempt = new Set(
    ends.map((id) => stationFromPlatform(stopNames.get(id) ?? "")).filter((x) => x !== ""),
  );

  const stops = new Set<string>();
  const stations = new Map<string, StationAccess>();
  const endsBlocked = new Map<string, StationAccess>();
  for (const [stopId, name] of stopNames) {
    const station = stationFromPlatform(name);
    if (station === "") continue;
    const state = states.get(station);
    if (state === undefined || isUsable(state.state)) continue;
    if (exempt.has(station)) {
      endsBlocked.set(station, state);
      continue;
    }
    stops.add(stopId);
    stations.set(station, state);
  }
  return {
    stops,
    stations: [...stations.values()],
    endsBlocked: [...endsBlocked.values()],
  };
}

const planQuery = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  /**
   * A door rather than a stop.
   *
   * When present, `from`/`to` are still sent — the stop the walk resolves to —
   * but these say where the rider actually is, so the walk at each end is part
   * of the answer instead of being invisible. Optional because a rider who
   * picked a station meant that station, and snapping it to "somewhere within
   * 1.2 km" would be answering a question they did not ask.
   */
  fromLat: z.coerce.number().min(-90).max(90).optional(),
  fromLon: z.coerce.number().min(-180).max(180).optional(),
  toLat: z.coerce.number().min(-90).max(90).optional(),
  toLon: z.coerce.number().min(-180).max(180).optional(),
  /** Seconds since midnight. Defaults to a weekday morning peak. */
  departAt: z.coerce.number().int().min(0).max(36 * 3600).optional(),
  /**
   * Seconds since midnight. The J-01 entry point: a rider with an obligation
   * knows their arrival time, not their departure time. Wins over departAt.
   */
  arriveBy: z.coerce.number().int().min(0).max(36 * 3600).optional(),
  /** Plan only through stations a rider needing step-free access can use. */
  stepFree: z.coerce.boolean().optional(),
});

/**
 * The first lookback tried when working back from a deadline, and the horizon a
 * single journey may span. `latestDeparture` widens the lookback on its own
 * when nothing is found; this is the size that answers the common case in one
 * probe.
 */
const ARRIVE_BY_WINDOW_S = 3 * 3600;

/**
 * The routes a journey rides, in order. Two journeys sharing one are the same
 * answer to a rider however the schedule differs underneath.
 */
function journeySignature(j: Journey): string {
  return j.legs.map((l) => `${l.kind}:${l.routeId ?? ""}`).join(">");
}

/**
 * How wide to search, how many searches that may cost, and how many journeys
 * come back.
 *
 * The pool is larger than the answer on purpose, and both numbers were measured
 * rather than chosen. Returning six journeys instead of four doubled the
 * response — 69 KB to 132 KB at the median — and added half again to the
 * endpoint's latency, which is the bill `D-36` had just finished paying down.
 * So the width buys candidates and the cap spends them.
 *
 * A sweep over 300 citywide trips, measuring how often the returned set holds a
 * materially safer alternative (`MATERIAL_RATIO`, and one costing five minutes
 * or less):
 *
 * | pool / kept | journeys | search ms | material | and cheap |
 * |---|---|---|---|---|
 * | 4 / 4 *(before)* | 3.42 | 18.6 | 1.3% | 0.3% |
 * | **6 / 4** | **3.76** | **31.8** | **2.3%** | **1.0%** |
 * | 8 / 4 | 3.76 | 43.3 | 2.0% | 0.7% |
 * | 12 / 4 | 3.76 | 54.8 | 2.0% | 0.7% |
 *
 * **Searching wider makes it worse past six**, which was not the expectation
 * going in. A deeper pool is mostly journeys reached by banning two routes at
 * once, and those crowd out the single-ban alternatives that a rider would
 * actually consider — the diversity pick has more to choose from and chooses
 * less well. Twelve costs 23 ms more per request to find a materially safer
 * option less often than six does.
 */
const CANDIDATE_POOL = 6;
const MAX_SEARCHES = 8;
const MAX_RETURNED = 4;

/**
 * Genuinely different ways to make the same trip.
 *
 * Connection Scan answers one question — earliest arrival — so a second opinion
 * has to come from changing the question. Banning a route the best journey uses
 * and re-planning is the cheapest way to do that, and it degrades honestly:
 * where the network offers no alternative the search returns nothing, which is
 * itself the answer (`D-13`'s surviving insight, kept by `D-14`: adapt to how
 * much choice actually exists rather than padding a menu).
 *
 * **Banning one route at a time was not enough.** The previous version banned
 * each of the first three routes the best journey used, all from the same
 * starting point, so every alternative was one edit away from the original and
 * a trip whose second-best answer needed two changes was never found. This
 * expands each surviving journey in turn — ban a route, then ban a route of
 * what that produced — which is the standard branch-and-ban shape and finds the
 * second edit.
 *
 * **Then it throws most of them away.** The pool is ranked by how little it
 * overlaps what is already kept, and only `MAX_RETURNED` survive. Diversity
 * rather than rank, because a rider scanning a list is choosing between *ways
 * to go*, and four variations on one corridor is one option printed four times.
 * The earliest arrival is always kept first; the rest earn their place by being
 * different from it.
 *
 * **The remaining limit is coverage, not search.** On a median trip *zero*
 * candidates clear the comparison bar, however many are generated, because most
 * surface segments cannot be scored at all (`E-D12`). More search does not fix
 * that, and this function is deliberately not the place that tries to.
 */
function alternatives(
  connections: ConnectionSet,
  footpaths: Footpaths,
  from: string,
  to: string,
  departAt: number,
  blockedStops: ReadonlySet<string>,
  best: Journey,
): Journey[] {
  const pool: Journey[] = [best];
  const seen = new Set([journeySignature(best)]);
  let searches = 0;
  let frontier: Array<{ journey: Journey; banned: ReadonlySet<string> }> = [
    { journey: best, banned: new Set() },
  ];

  // Two rounds. A third would keep finding journeys, but they are reached by
  // banning three of the rider's routes at once and read as contrivances.
  outer: for (let depth = 0; depth < 2; depth++) {
    const next: Array<{ journey: Journey; banned: ReadonlySet<string> }> = [];
    for (const node of frontier) {
      for (const routeId of routesOf(node.journey)) {
        if (pool.length >= CANDIDATE_POOL || searches >= MAX_SEARCHES) break outer;
        if (node.banned.has(routeId)) continue;
        const banned = new Set(node.banned).add(routeId);
        searches++;
        const alt = plan(connections, footpaths, from, to, departAt,
                         ARRIVE_BY_WINDOW_S, banned, blockedStops);
        if (alt === null) continue;
        const sig = journeySignature(alt);
        if (seen.has(sig)) continue;
        seen.add(sig);
        pool.push(alt);
        next.push({ journey: alt, banned });
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return mostDiverse(pool, MAX_RETURNED);
}

/** The routes a journey rides, as a set. */
function routesOf(j: Journey): Set<string> {
  return new Set(j.legs.filter((l) => l.kind === "ride").map((l) => l.routeId!));
}

/**
 * Pick `k` journeys that are as unlike each other as possible.
 *
 * Greedy max-min on route overlap: keep the first — always the earliest
 * arrival, which is the answer to the question actually asked — then repeatedly
 * add whichever candidate shares fewest routes with everything kept so far.
 * Overlap is Jaccard on the route sets, which is the rider's own notion of "the
 * same way there": two journeys riding the 504 and the 1 differ only in details
 * they did not ask about.
 */
function mostDiverse(all: readonly Journey[], k: number): Journey[] {
  if (all.length <= k) return [...all];
  const routes = new Map(all.map((j) => [j, routesOf(j)]));
  const overlap = (a: Set<string>, b: Set<string>): number => {
    let shared = 0;
    for (const r of a) if (b.has(r)) shared++;
    const union = a.size + b.size - shared;
    return union === 0 ? 1 : shared / union;
  };
  const keep = [all[0]!];
  const rest = all.slice(1);
  while (keep.length < k && rest.length > 0) {
    let bestIndex = 0;
    let bestScore = Infinity;
    for (let i = 0; i < rest.length; i++) {
      const mine = routes.get(rest[i]!)!;
      let worst = 0;
      for (const kept of keep) worst = Math.max(worst, overlap(mine, routes.get(kept)!));
      if (worst < bestScore) {
        bestScore = worst;
        bestIndex = i;
      }
    }
    keep.push(rest.splice(bestIndex, 1)[0]!);
  }
  return keep;
}

/** Station codes come out of the incident feed upper-cased; riders read signs. */
function named<T extends { worst: Array<{ from: string; to: string }>; dominant: { from: string; to: string } | null }>(r: T): T {
  return {
    ...r,
    worst: r.worst.map((w) => ({ ...w, from: displayStationName(w.from), to: displayStationName(w.to) })),
    dominant:
      r.dominant === null
        ? null
        : { ...r.dominant, from: displayStationName(r.dominant.from), to: displayStationName(r.dominant.to) },
  };
}

/**
 * Why we found nothing, when the reason is us rather than the network.
 *
 * A time outside the loaded schedule is missing from our data, not from
 * Toronto. Saying "no journey" there would be absence of data dressed as
 * absence of service — the confusion P-03 forbids.
 *
 * This fires rarely: the weekday service day runs 03:28 to 30:35 and covers
 * every wall-clock hour. An earlier version of this message blamed the gap on
 * Blue Night being un-ingested, which was false — all 35 of those routes are in
 * the loaded service.
 */
function outsideService(atSeconds: number, window: { from: number; to: number }): string | null {
  if (atSeconds >= window.from && atSeconds <= window.to) return null;
  const hh = (s: number): string => {
    const t = `${String(Math.floor(s / 3600) % 24).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
    return s >= DAY_SECONDS ? `${t} the next morning` : t;
  };
  return (
    `We have no scheduled service loaded outside ${hh(window.from)} to ${hh(window.to)}, ` +
    "so we cannot answer for that hour."
  );
}

/**
 * Coordinates, at the precision a map can actually use.
 *
 * Stored geometry carries full float precision — `-79.44447489404904`, fourteen
 * decimal places, which is sub-micron. Six places is about 0.11 m at this
 * latitude: finer than a GPS fix, finer than the width of the line drawn on top
 * of it, and roughly half the bytes.
 *
 * Applied on the way out only. The stored value keeps its precision, because
 * rounding a number other code divides is how `disruptionRisk` ended up ranked
 * on one figure and displayed as another.
 */
const PLACES = 1e6;
function thin(coordinates: number[][]): number[][] {
  return coordinates.map(([lon, lat]) => [
    Math.round(lon! * PLACES) / PLACES,
    Math.round(lat! * PLACES) / PLACES,
  ]);
}

export function registerPlanner(app: FastifyInstance): void {
  // The graph takes a few seconds to build; warm it now so the first search
  // does not pay for it.
  void getGraph();

  app.get("/stops/search", async (req, reply) => {
    const q = z.object({ q: z.string().min(2), limit: z.coerce.number().int().max(25).optional() })
      .safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: q.error.flatten() });
    return { stops: await findStops(q.data.q, q.data.limit ?? 8) };
  });

  /**
   * Everywhere a trip can start or end: stops and street addresses in one list.
   *
   * One endpoint rather than two because a rider typing "487 Lauder" does not
   * know whether they are searching stops or addresses, and asking them to pick
   * a tab is asking about our data model rather than about their trip.
   */
  app.get("/places/search", async (req, reply) => {
    const q = z.object({ q: z.string().min(2), limit: z.coerce.number().int().max(25).optional() })
      .safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: q.error.flatten() });
    const text = q.data.q.trim();

    // A leading house number is the signal to geocode. Without one this is a
    // stop search: a rider typing "King" wants King Station, not 1 King St.
    const addresses = /^\d/.test(text) ? await geocode(text, 4) : [];
    const stops = await findStops(text, q.data.limit ?? 6);

    return {
      places: [
        ...addresses.map((a) => ({
          kind: "address" as const,
          // The coordinate *is* the identity: an address is not in the stop
          // table and never gets an id of its own.
          id: `@${a.lat.toFixed(6)},${a.lon.toFixed(6)}`,
          name: a.label,
          lat: a.lat, lon: a.lon,
          approximate: a.approximate,
        })),
        ...stops.map((s) => ({
          kind: "stop" as const,
          id: s.id, name: s.name, lat: s.lat, lon: s.lon, approximate: false,
        })),
      ],
    };
  });

  async function findStops(
    query: string,
    limit: number,
  ): Promise<Array<{ id: string; name: string; lat: number; lon: number }>> {
    const q = { data: { q: query } };
    const { boardable } = await getGraph();
    // Over-fetch, then clean up: the raw GTFS list has a row per platform and
    // per side of the street, so a naive top-8 is mostly duplicates.
    const raw = await prisma.stop.findMany({
      where: { name: { contains: q.data.q } },
      select: { id: true, name: true, lat: true, lon: true },
      take: limit * 12,
    });

    const needle = q.data.q.toLowerCase();
    /**
     * Does the query land at the start of a word?
     *
     * Prisma's `contains` matches anywhere, so "CN" matched "M**cN**icoll" and
     * "ROM" matched "San **Rom**anoway" — and because neither is a prefix match,
     * the ranking below fell through to shortest-name and confidently offered a
     * stop 25km from what was asked for. A tap on the first suggestion sent a
     * rider across the city with no signal anything was wrong. Nobody typing
     * two letters means the middle of a word.
     */
    const atWordStart = (name: string): boolean =>
      new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(name);
    const seen = new Map<string, { id: string; name: string; lat: number; lon: number }>();
    for (const s of raw) {
      if (!boardable.has(s.id)) continue;
      // A mid-word match is noise, and offering it is worse than offering
      // nothing: an empty result tells the rider to try different words.
      if (!atWordStart(s.name)) continue;
      const name = displayStopName(s.name);
      // Platforms of one station, and the two sides of one corner, are the same
      // place to a rider. They sit metres apart, so the footpath graph joins
      // them and either id plans the same trip.
      if (!seen.has(name)) seen.set(name, { ...s, name });
    }

    const stops = [...seen.values()]
      .sort((a, b) => {
        const ap = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
        const bp = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        if (a.name.length !== b.name.length) return a.name.length - b.name.length;
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit);

    return stops;
  }

  app.get("/plan", async (req, reply) => {
    const parsed = planQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { connections, footpaths, stopNames, stopCoords, frequency, segmentIndex,
            serviceWindow, boardable } = await getGraph();
    const departAt = parsed.data.departAt ?? 8 * 3600 + 30 * 60;
    // Scoring keys on the raw GTFS name: the segment index was built from it,
    // and a prettier string here would silently miss every lookup.
    const nameOf = (id: string): string => stopNames.get(id) ?? id;
    /** The same stop, named for a rider rather than for the index. */
    const labelOf = (id: string): string => displayStopName(nameOf(id));

    // Working backwards from a deadline is a search, not a single plan: earliest
    // arrival is monotone in departure time, so the latest departure that still
    // makes it is found by bisection over the planner.
    // An early-morning hour is two positions in the schedule — 04:00 today and
    // 28:00 on the service day still running — and only one of them carries any
    // service. Both are tried, and the better result wins.
    const departCandidates = serviceDayTimes(departAt, serviceWindow);

    /**
     * A door resolves to the stop the *timetable* prefers, not the nearest one.
     *
     * `planFromPoints` seeds every stop within walking distance at the time the
     * rider could be there, so a stop 50 m further away wins when the service
     * there leaves sooner — which is most of the value. Resolved once here, and
     * the rest of the endpoint then runs on stop ids exactly as before: the
     * alternatives, the arrive-by bisection and the scoring all keep working
     * without learning about addresses.
     */
    const doorFrom = parsed.data.fromLat !== undefined && parsed.data.fromLon !== undefined
      ? { lat: parsed.data.fromLat, lon: parsed.data.fromLon } : null;
    const doorTo = parsed.data.toLat !== undefined && parsed.data.toLon !== undefined
      ? { lat: parsed.data.toLat, lon: parsed.data.toLon } : null;

    let fromStop = parsed.data.from;
    let toStop = parsed.data.to;
    let access: AccessStop | null = null;
    let egress: AccessStop | null = null;

    if (doorFrom !== null || doorTo !== null) {
      const coords = [...boardable].flatMap((id) => {
        const c = stopCoords.get(id);
        return c === undefined ? [] : [{ id, lat: c.lat, lon: c.lon }];
      });
      const origins = doorFrom === null
        ? [{ stopId: fromStop, seconds: 0, metres: 0 }]
        : accessStops(doorFrom, coords);
      const targets = doorTo === null
        ? [{ stopId: toStop, seconds: 0, metres: 0 }]
        : accessStops(doorTo, coords);
      const probe = origins.length === 0 || targets.length === 0
        ? null
        : planFromPoints(connections, footpaths, origins, targets, departCandidates[0]!);
      if (probe === null) {
        // No stop within walking distance, or none of them reach the far end.
        // A real answer, not an error: this address is not on the network.
        return { journey: null, reason: origins.length === 0 || targets.length === 0
          ? "No stop within a walk of that address."
          : "No journey from there within three hours." };
      }
      fromStop = probe.access.stopId;
      toStop = probe.egress.stopId;
      if (doorFrom !== null) access = origins.find((o) => o.stopId === fromStop) ?? null;
      if (doorTo !== null) egress = targets.find((t) => t.stopId === toStop) ?? null;
    }

    const stepFree = parsed.data.stepFree ?? false;
    const { stops: blockedStops, stations: blockedStations, endsBlocked } = stepFree
      ? await stepFreeBlocks(stopNames, [fromStop, toStop])
      : { stops: new Set<string>(), stations: [] as StationAccess[], endsBlocked: [] as StationAccess[] };


    let searchFrom = departCandidates[0]!;
    let arriveByUsed: number | null = null;

    if (parsed.data.arriveBy !== undefined) {
      let best: { departAt: number; arriveAt: number; arriveBy: number } | null = null;
      for (const arriveBy of serviceDayTimes(parsed.data.arriveBy, serviceWindow)) {
        const found = latestDeparture(arriveBy, ARRIVE_BY_WINDOW_S, (t) => {
          const j = plan(connections, footpaths, fromStop, toStop, t,
                         ARRIVE_BY_WINDOW_S, new Set(), blockedStops);
          return j === null ? null : j.arriveAt;
        });
        if (found === null) continue;
        // Door to door, deadline included: leave as late as possible and arrive
        // as close to the deadline as the schedule allows. Comparable across
        // readings because each is measured against its own deadline.
        const cost = arriveBy - found.departAt;
        if (best === null || cost < best.arriveBy - best.departAt) best = { ...found, arriveBy };
      }
      if (best === null) {
        return { journey: null, reason: outsideService(departCandidates[0]!, serviceWindow)
          ?? "No journey arrives by then, starting from up to three hours before." };
      }
      searchFrom = best.departAt;
      arriveByUsed = best.arriveBy;
    } else {
      // Without a deadline, take the first reading that can actually be planned.
      for (const t of departCandidates) {
        if (plan(connections, footpaths, fromStop, toStop, t,
                 ARRIVE_BY_WINDOW_S, new Set(), blockedStops) !== null) {
          searchFrom = t;
          break;
        }
      }
    }

    const best = plan(connections, footpaths, fromStop, toStop, searchFrom,
                      ARRIVE_BY_WINDOW_S, new Set(), blockedStops);
    if (best === null) {
      // A failed plan is a real answer, not an error: no service in the window
      // is exactly what a rider at 3am needs to be told.
      return { journey: null, reason: outsideService(searchFrom, serviceWindow)
        ?? "No journey found within 3 hours of the requested departure." };
    }

    const candidates = alternatives(connections, footpaths, fromStop, toStop,
                                    searchFrom, blockedStops, best);

    /**
     * Remove rides that cost more walking than they save.
     *
     * Applied to the answer rather than inside the search: the arrive-by
     * bisection and the alternatives generator both depend on `plan` returning
     * the earliest arrival, and quietly changing that underneath them would
     * change what they are searching over.
     */
    const tidy = (j: Journey): Journey => {
      const legs = collapsePointlessRides(
        j.legs,
        (id) => stopCoords.get(id),
        (fromStop, toStop, departAt, arriveAt) => ({ kind: "walk", fromStop, toStop, departAt, arriveAt }),
      );
      if (legs.length === j.legs.length) return j;
      return {
        legs,
        departAt: legs[0]!.departAt,
        arriveAt: legs[legs.length - 1]!.arriveAt,
        transfers: Math.max(0, legs.filter((l) => l.kind === "ride").length - 1),
      };
    };

    // Today, on top of the history. A route the TTC has flagged is not running
    // normally, and the reliability figure below is a record of normal days.
    const { byRoute, ageHours, stale: alertsStale } = await disruptionsByRoute();
    const disruptionsOn = (j: Journey): Disruption[] => {
      const seen = new Map<string, Disruption>();
      for (const l of j.legs) {
        if (l.kind !== "ride" || l.routeId === undefined) continue;
        for (const d of byRoute.get(l.routeId) ?? []) seen.set(d.id, d);
      }
      return [...seen.values()];
    };

    // Where a disruption actually stops service on the planned way, offer one
    // that does not use those routes at all. We cannot say how much a detour
    // costs — that number is not in the feed and inventing it is exactly what
    // P-03 forbids — but we can offer a way that does not depend on it.
    const blocked = new Set(
      disruptionsOn(best).filter((d) => isServiceAffecting(d.kind)).flatMap((d) => d.routeIds),
    );
    if (blocked.size > 0) {
      const clear = plan(connections, footpaths, fromStop, toStop,
                         searchFrom, ARRIVE_BY_WINDOW_S, blocked, blockedStops);
      if (clear !== null && !candidates.some((c) => journeySignature(c) === journeySignature(clear))) {
        candidates.push(clear);
      }
    }

    // What the constraint actually cost, measured rather than asserted.
    //
    // This field used to be every inaccessible station in the city — the same
    // eighteen on every trip — behind a comment promising the rider "what that
    // cost them". Planning once without the constraint and naming the blocked
    // stations that way would have used is the honest version of the claim, and
    // it is one extra plan on a request that already does several.
    const costStations: StationAccess[] = [];
    if (stepFree && blockedStops.size > 0) {
      const unconstrained = plan(connections, footpaths, fromStop, toStop,
                                 searchFrom, ARRIVE_BY_WINDOW_S);
      if (unconstrained !== null) {
        const byStation = new Map(blockedStations.map((b) => [b.station, b]));
        const seen = new Set<string>();
        for (const leg of unconstrained.legs) {
          // Leg ends only. A journey riding *through* College without getting
          // off never uses the station, so listing it as a cost would blame the
          // constraint for a route it did not change — which is how the first
          // version of this measure reported two stations on a trip the toggle
          // left byte-identical.
          for (const id of [leg.fromStop, leg.toStop]) {
            const station = stationFromPlatform(stopNames.get(id) ?? "");
            const hit = byStation.get(station);
            if (hit !== undefined && !seen.has(station)) {
              seen.add(station);
              costStations.push(hit);
            }
          }
        }
      }
    }

    const scored = await Promise.all(
      // Cleaned before scoring, so the risk figures and the drawn route describe
      // the journey the rider is actually shown (`E-D33`).
      candidates.map((j) => scoreJourney(tidy(j), segmentIndex, frequency, nameOf)),
    );
    const byJourney = new Map(scored.map((j) => [j, disruptionsOn(j)]));

    // Ranked by expected door-to-door time — schedule plus what the history says
    // usually happens — not by the timetable alone (E-L02).
    scored.sort(
      (a, b) =>
        a.durationMinutes + a.reliability.expectedAddedMinutes -
        (b.durationMinutes + b.reliability.expectedAddedMinutes),
    );

    /**
     * Drop options that are worse on every axis a rider can read.
     *
     * The generator bans a route the best journey uses and re-plans, so when
     * there is no real second way it returns the best trip that exists *without
     * the one route that works* — and the diversity pick then keeps it
     * precisely because it shares fewest routes with the others. On one real
     * trip that produced a 79-minute option beside a 37-minute one, and nothing
     * asked whether it was worth a rider's attention.
     *
     * `D-14` is explicit that where there is no real alternative the honest
     * output is one route and when to leave, not a menu. This is that rule
     * applied to the list.
     *
     * **Dominated means slower, no safer, and no better measured** — all three,
     * against a journey already kept. Slower alone is not enough: a longer trip
     * that is genuinely safer, or one we can actually speak for, is a real
     * choice. Both bars are ones this project already set and audited:
     * `MATERIAL_RATIO` for whether a risk difference is worth acting on, and
     * `MIN_COMPARABLE_COVERAGE` for whether a figure can be compared at all.
     */
    const kept: typeof scored = [];
    for (const j of scored) {
      const dominated = kept.some((k) => {
        if (j.durationMinutes <= k.durationMinutes) return false;
        const jr = j.reliability;
        const kr = k.reliability;
        // Better measured is a reason to keep it, whatever the clock says.
        if (jr.coverage >= kr.coverage + (1 - MIN_COMPARABLE_COVERAGE) / 2) return false;
        // Materially safer is a reason to keep it — but only where both figures
        // are solid enough to compare. Two thin numbers do not make a verdict.
        const comparable = jr.coverage >= MIN_COMPARABLE_COVERAGE
          && kr.coverage >= MIN_COMPARABLE_COVERAGE;
        if (comparable && jr.disruptionRisk > 0
            && kr.disruptionRisk / jr.disruptionRisk >= MATERIAL_RATIO) return false;
        return true;
      });
      if (!dominated) kept.push(j);
    }
    scored.length = 0;
    scored.push(...kept);

    return {
      /**
       * When we last saw the live feed, and whether that is recent enough to
       * report. Sent even when nothing is disrupted: a rider who sees no
       * warning deserves to know whether that means "nothing wrong" or "we did
       * not look" (P-03).
       */
      /**
       * Walking the whole way, when that is a real option (`F-03`, `D-40`).
       * Null on almost every trip, which is the honest answer: outside the
       * core Toronto rarely offers a second way (`E-L12`, `E-D27`).
       */
      walk: (() => {
        const a = doorFrom ?? stopCoords.get(fromStop);
        const b = doorTo ?? stopCoords.get(toStop);
        return a === undefined || b === undefined ? null : walkOption(a, b);
      })(),
      /**
       * The walk at each end, when the rider gave a door rather than a stop.
       * Null when they picked a stop — they meant that stop, and inventing a
       * walk they did not ask for would inflate every figure on the card.
       */
      access: access === null ? null : { ...access, stopName: labelOf(access.stopId) },
      egress: egress === null ? null : { ...egress, stopName: labelOf(egress.stopId) },
      alerts: { ageHours, stale: alertsStale },
      /**
       * Stations kept out of these results. Named rather than silently
       * excluded: a rider who asked for step-free deserves to see what that
       * cost them, and an outage may clear within the hour (P-09).
       */
      stepFree: stepFree
        ? {
            blockedStations: costStations,
            /**
             * The rider's own origin or destination, when it is not step-free.
             * Routing around it is not an option — it is where they are going —
             * so the honest output is to plan the trip and say so (P-07: "there
             * is no good option" is a valid answer).
             */
            endsBlocked,
            /**
             * True when the fastest way was already step-free, so the constraint
             * cost nothing. Worth saying: a rider who flips the switch and sees
             * the screen not move cannot tell "nothing to change" from "broken
             * toggle", and silence is the one reading we know is wrong.
             */
            changedNothing: costStations.length === 0,
          }
        : null,
      /**
       * `path` and `legs` are pulled out of the spread deliberately.
       *
       * `...j` used to spread the whole scored journey, which shipped `path`
       * — 18.5 KB per journey, four journeys, **74 KB of a 185 KB response**
       * that the browser never reads: it is not even declared in the client's
       * own `ScoredJourney` type. Worse, `geojson` below is *built from*
       * `path`, so the same geometry went out twice in two encodings.
       *
       * A spread is exactly how that hides. Both fields are now named, used to
       * build what the client does read, and left out of the wire.
       */
      journeys: scored.map((journey) => {
        const { path, legs, ...j } = journey;
        return {
        id: legs.map((l) => `${l.kind}:${l.routeId ?? ""}`).join(">"),
        ...j,
        // GeoJSON for the whole journey: one feature per segment ridden, plus a
        // straight line per walk. Segments carry their own risk so the map can
        // colour the trip with the same scale the explore view uses.
        geojson: {
          type: "FeatureCollection" as const,
          features: [
            ...path.flatMap((seg) =>
              seg.geometry === null
                ? []
                : [{
                    type: "Feature" as const,
                    geometry: { type: "LineString" as const, coordinates: thin(JSON.parse(seg.geometry) as number[][]) },
                    properties: {
                      // The stretch's own id, so the sheet can point the map at
                      // one segment without matching on a name. `dominant` and
                      // `worst` are display-cased on the way out (`named`), and
                      // these are raw — comparing the two would fail silently
                      // for exactly the reason `displayStopName` is kept off
                      // every lookup path.
                      segmentId: seg.id,
                      kind: "ride", risk: seg.risk,
                      gapMinutesPerMonth: seg.gapMinutesPerMonth,
                      gapMinutesPerMonthAtTime: seg.gapMinutesPerMonthAtTime,
                      // Without this the map's colour ramp coalesces a missing
                      // exposure to zero and paints an unmeasured stretch in
                      // the *most reliable* colour — absence of data reading as
                      // good news, which P-03 exists to forbid.
                      confidence: seg.risk === null ? "unknown" : "known",
                      conditioned: seg.conditioned,
                      from: seg.from, to: seg.to,
                    },
                  }],
            ),
            ...legs.flatMap((l) => {
              if (l.kind !== "walk") return [];
              const a = stopCoords.get(l.fromStop), b = stopCoords.get(l.toStop);
              if (a === undefined || b === undefined) return [];
              return [{
                type: "Feature" as const,
                geometry: { type: "LineString" as const, coordinates: thin([[a.lon, a.lat], [b.lon, b.lat]]) },
                properties: {
                  // A walk is not a measured segment, so it has no id to point at.
                  segmentId: null,
                  kind: "walk", risk: null, gapMinutesPerMonth: null,
                  gapMinutesPerMonthAtTime: null, conditioned: false,
                  confidence: "none",
                  from: labelOf(l.fromStop), to: labelOf(l.toStop),
                },
              }];
            }),
          ],
        },
        reliability: {
          ...named(j.reliability),
          comparison: compare(
            j.reliability.disruptionRisk, j.reliability.coverage, j.durationMinutes, null),
        },
        atTime: j.atTime === null ? null : {
          ...named(j.atTime),
          bands: j.atTime.bands,
          span: j.atTime.span,
          conditionedShare: j.atTime.conditionedShare,
          // Only comparable against a reference measured in the same band.
          comparison: j.atTime.bands.length === 1
            ? compare(j.atTime.disruptionRisk, j.atTime.coverage, j.durationMinutes,
                      j.atTime.bands[0]!.id)
            : null,
        },
        // Only present when the rider gave a deadline: without one there is
        // nothing to work backwards from, and inventing a target would be
        // answering a question they did not ask.
        advice:
          parsed.data.arriveBy === undefined
            ? null
            : departureAdvice({
                departAt: j.departAt,
                arriveAt: j.arriveAt,
                arriveBy: arriveByUsed ?? inServiceDay(parsed.data.arriveBy, serviceWindow),
                disruptionRisk: j.reliability.disruptionRisk,
                oneInTrips: j.reliability.oneInTrips,
                severityCoveredMinutes: j.reliability.minutesWhenBad,
                severityTypicalMinutes: j.reliability.minutesWhenDisrupted,
              }),
        typicalMinutes: j.durationMinutes,
        /** What it costs on the trips that do go wrong. */
        disruptedMinutes: j.durationMinutes + j.reliability.minutesWhenDisrupted,
        legs: legs.map((l, i) => ({
          kind: l.kind, routeId: l.routeId, departAt: l.departAt, arriveAt: l.arriveAt,
          fromName: labelOf(l.fromStop), toName: labelOf(l.toStop),
          reliability: j.legRisks[i] ?? null,
          reliabilityAtTime: j.legRisksAtTime?.[i] ?? null,
          disruptions: l.kind === "ride" && l.routeId !== undefined
            ? (byRoute.get(l.routeId) ?? [])
            : [],
        })),
        /**
         * Today's events on this way, deduplicated across its legs.
         *
         * Ranking is deliberately left alone. We know a flagged route is not
         * running normally; we do not know whether the rider's own stretch of
         * it is affected, or what it costs. Demoting on that would be deciding
         * for them with a number we do not have — the same call D-24 makes
         * about the departure buffer.
         */
        disruptions: byJourney.get(journey) ?? [],
        /** True when nothing the TTC has flagged today touches this way. */
        avoidsDisruption: (byJourney.get(journey) ?? []).length === 0,
        /** What each wait actually costs if the vehicle does not turn up (D-34). */
        waits: j.waits.map((w) => ({
          ...w,
          headwayMinutes: w.headwayMinutes === null ? null : Math.round(w.headwayMinutes),
        })),
        outsideMinutes: j.outsideMinutes,
        /**
         * The one wait long enough to change the plan when a vehicle does not
         * turn up, decided on the server so the threshold lives in one place.
         */
        notableWait: (() => {
          const w = notableWait(j.waits);
          return w === null ? null : { ...w, headwayMinutes: Math.round(w.headwayMinutes!) };
        })(),
        };
      }),
      /** Stated so a single result is not mistaken for a shortlist. */
      alternativesFound: scored.length - 1,
    };
  });
}
