export interface RouteSummary {
  routeId: string;
  direction: string;
  mode: string;
  name: string;
  segments: number;
  scored: number;
}

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
  exposure: { gapMinutesPerMonth: number; incidentsPerMonth: number } | null;
  severity: { p50: number; p90: number; p95: number; unit: string; basis: string } | null;
  sample: { incidents: number; window: { start: string; end: string } | null; filters: string[] };
  causes: Array<{ code: string; description: string; share: number }>;
  confidence: Confidence;
}

export interface RouteReliability {
  routeId: string;
  direction: string;
  coverage: { segments: number; scored: number; unknown: number };
  segments: SegmentReliability[];
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const fetchRoutes = (): Promise<{ routes: RouteSummary[] }> => get("/routes");

export function fetchRouteReliability(
  routeId: string,
  direction: string,
  filters: { dayOfWeek?: string; hour?: number },
): Promise<RouteReliability> {
  const q = new URLSearchParams();
  if (filters.dayOfWeek !== undefined) q.set("dayOfWeek", filters.dayOfWeek);
  if (filters.hour !== undefined) q.set("hour", String(filters.hour));
  const suffix = q.toString() === "" ? "" : `?${q.toString()}`;
  return get(`/routes/${encodeURIComponent(routeId)}/${direction}/reliability${suffix}`);
}

export interface SegmentFeature {
  type: "Feature";
  id: number;
  geometry: { type: "LineString"; coordinates: Array<[number, number]> };
  properties: {
    segmentId: string;
    from: string;
    to: string;
    confidence: Confidence;
    gapMinutesPerMonth: number | null;
    incidentsPerMonth: number | null;
    incidents: number;
    isTerminalApproach: boolean;
    drawnOnStreets: boolean;
    /** Set only when step-free routing is on and an endpoint blocks this segment. */
    blockedBy: { station: string; state: string; note?: string } | null | undefined;
  };
}

export interface RouteMap {
  type: "FeatureCollection";
  bbox: [number, number, number, number] | null;
  coverage: { segments: number; scored: number; approximated: number };
  features: SegmentFeature[];
}

export function fetchRouteMap(
  routeId: string,
  direction: string,
  filters: { dayOfWeek?: string; hour?: number; stepFree?: boolean },
): Promise<RouteMap> {
  const q = new URLSearchParams();
  if (filters.dayOfWeek !== undefined) q.set("dayOfWeek", filters.dayOfWeek);
  if (filters.hour !== undefined) q.set("hour", String(filters.hour));
  if (filters.stepFree === true) q.set("stepFree", "1");
  const suffix = q.toString() === "" ? "" : `?${q.toString()}`;
  return get(`/routes/${encodeURIComponent(routeId)}/${direction}/map${suffix}`);
}

export interface LegRisk {
  risk: number;
  /** Null when this leg could not be scored at all — unknown, not fine. */
  oneInTrips: number | null;
  coverage: number;
  /** This leg carries the largest single share of the trip's risk. */
  isWorst: boolean;
}

export interface Disruption {
  id: string;
  kind: "no-service" | "bypass" | "detour" | "elevator" | "notice";
  /** Every route this one event affects — the TTC publishes it once per route. */
  routeIds: string[];
  cause: string | null;
  shuttle: boolean;
  /** The alert text with its route prefix stripped. */
  text: string;
}

export interface JourneyLeg {
  kind: "ride" | "walk";
  routeId?: string;
  departAt: number;
  arriveAt: number;
  fromName: string;
  toName: string;
  /** Null on a walk: a footpath has no reliability to report. */
  reliability: LegRisk | null;
  /** The same leg on the band view. Null when it could not be conditioned. */
  reliabilityAtTime: LegRisk | null;
  /** Flagged by the TTC today. Empty on a walk. */
  disruptions: Disruption[];
}

export interface DepartureAdvice {
  leaveAt: number;
  arriveAt: number;
  slackMinutes: number;
  disrupted: { arriveAt: number; oneInTrips: number | null } | null;
  covered: { leaveAt: number; extraMinutes: number } | null;
}

export interface Comparison {
  /** Share of comparable trips this one is safer than. */
  saferThan: number;
  /** What a typical trip of this length does, as 1 in N. */
  typicalOneInTrips: number | null;
  /** This trip's risk over the typical one's. Above 1 is worse. */
  ratioToTypical: number | null;
  /** The side the comparison takes. Decided on the server; see benchmark/table.ts. */
  verdict: "safer-4in5" | "safer-most" | "typical" | "riskier-most" | "riskier-4in5";
  /** How the reference class is named. */
  label: string;
}

export interface JourneyReliability {
  disruptionRisk: number;
  oneInTrips: number | null;
  minutesWhenDisrupted: number;
  minutesWhenBad: number;
  coverage: number;
  /** Share of this trip's waiting where the vehicle never turned up at all. */
  neverCame: number | null;
  worst: Array<{ segmentId: string; from: string; to: string; risk: number }>;
  /** The one stretch that dominates, or null when the risk is spread. */
  dominant: { segmentId: string; from: string; to: string; risk: number } | null;
  /**
   * How this trip ranks against others of its length, or null when there is no
   * fair reference — too few sampled trips, or too little of this one measured.
   */
  comparison: Comparison | null;
}

export interface BandReliability extends JourneyReliability {
  bands: Array<{ id: string; label: string }>;
  /** Share of scored stretches using their own band rather than the all-day figure. */
  conditionedShare: number;
}

/** One wait on a trip, and the headway behind it (D-34). */
export interface WaitAtStop {
  legIndex: number;
  scheduledMinutes: number;
  /** Typical gap between vehicles here; null when the band is too thin to say. */
  headwayMinutes: number | null;
  bandLabel: string;
  outdoors: boolean;
}

export interface ScoredJourney {
  advice: DepartureAdvice | null;
  /** Every wait on the trip, keyed to the leg boarded after it. */
  waits: WaitAtStop[];
  /** Minutes spent at a street stop or walking. */
  outsideMinutes: number;
  /**
   * The one wait long enough that a vehicle not turning up changes the plan,
   * or null. The threshold is the server's — see `wait.ts`.
   */
  notableWait: WaitAtStop | null;
  /** Today's events on this way, one per incident rather than one per route. */
  disruptions: Disruption[];
  /** Nothing the TTC has flagged today touches this way. */
  avoidsDisruption: boolean;
  /** Measured only in the bands this trip runs in, or null when none could be. */
  atTime: BandReliability | null;
  id: string;
  typicalMinutes: number;
  disruptedMinutes: number;
  transfers: number;
  departAt: number;
  arriveAt: number;
  legs: JourneyLeg[];
  reliability: JourneyReliability;
  geojson: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      geometry: { type: "LineString"; coordinates: Array<[number, number]> };
      properties: {
        /** The stretch this feature draws. Null on a walk. */
        segmentId: string | null;
        kind: "ride" | "walk";
        risk: number | null;
        gapMinutesPerMonth: number | null;
        gapMinutesPerMonthAtTime: number | null;
        conditioned: boolean;
        confidence: "known" | "unknown" | "none";
        from: string;
        to: string;
      };
    }>;
  };
}

export interface StationAccessState {
  station: string;
  state: "accessible" | "outage" | "not-accessible" | "unknown";
  note?: string;
}

/** Walking the whole way, when the core makes that a real option (F-03, D-40). */
export interface WalkOption {
  minutes: number;
  metres: number;
}

export interface PlanResult {
  /** Null on almost every trip: outside downtown there is rarely a choice. */
  walk: WalkOption | null;
  /** The walk from the door to the first stop; null when a stop was picked. */
  access: AccessWalk | null;
  /** The walk from the last stop to the door. */
  egress: AccessWalk | null;
  /** When the live alerts feed was last seen, and whether that is recent. */
  alerts?: { ageHours: number | null; stale: boolean };
  /** Present when the rider asked for step-free. */
  stepFree?: {
    /** Stations the fastest way would have used, and this one avoids. */
    blockedStations: StationAccessState[];
    /** The rider's own origin or destination, when it is not step-free. */
    endsBlocked: StationAccessState[];
    /** The fastest way was already step-free, so the constraint cost nothing. */
    changedNothing: boolean;
  } | null;
  journeys?: ScoredJourney[];
  alternativesFound?: number;
  journey?: null;
  reason?: string;
}

export interface StopHit { id: string; name: string; lat: number; lon: number }

export const searchStops = (q: string): Promise<{ stops: StopHit[] }> =>
  get(`/stops/search?q=${encodeURIComponent(q)}`);

/**
 * Anywhere a trip can start or end.
 *
 * A stop has an id the planner understands. An address does not — it is a
 * coordinate, and `planTrip` sends it as one so the walk at each end becomes
 * part of the answer instead of being invisible.
 */
export interface PlaceHit {
  kind: "stop" | "address";
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** The house number asked for does not exist; this is the nearest that does. */
  approximate: boolean;
}

export const searchPlaces = (q: string): Promise<{ places: PlaceHit[] }> =>
  get(`/places/search?q=${encodeURIComponent(q)}`);

/**
 * `when.mode` is how the rider stated the trip, not a detail of the request:
 * a deadline makes the planner search backwards for the latest departure that
 * still makes it, which is a different question from "what leaves at 08:30".
 */
export function planTrip(
  from: PlaceHit,
  to: PlaceHit,
  when: { mode: "arriveBy" | "departAt"; seconds: number },
  stepFree = false,
): Promise<PlanResult> {
  const q = new URLSearchParams();
  // A stop id the planner knows, or — for an address — the nearest stop it
  // could find, which the server replaces with whichever one the timetable
  // actually prefers once it has the coordinate.
  q.set("from", from.id);
  q.set("to", to.id);
  q.set(when.mode, String(when.seconds));
  if (stepFree) q.set("stepFree", "true");
  // Coordinates only for a door. A rider who picked a station meant that
  // station, and snapping it to "somewhere within 1.2 km" answers a question
  // they did not ask.
  if (from.kind === "address") { q.set("fromLat", String(from.lat)); q.set("fromLon", String(from.lon)); }
  if (to.kind === "address") { q.set("toLat", String(to.lat)); q.set("toLon", String(to.lon)); }
  return get(`/plan?${q.toString()}`);
}

/** The walk between a door and the network, when the rider gave an address. */
export interface AccessWalk {
  stopId: string;
  stopName: string;
  metres: number;
  seconds: number;
}

export interface RankedRoute {
  routeId: string;
  name: string;
  mode: string;
  rank: number;
  gapMinutesPerMonth: number;
  coverage: number;
  /** Much of the route is unmeasured, so the figure is a floor, not a total. */
  partial: boolean;
  leadingCause: string | null;
  /** Share of this route's waiting where the vehicle never turned up at all. */
  neverCameShare: number | null;
  causes: Array<{ code: string; cause: string; minutesPerMonth: number }>;
}

export interface Ranking {
  modes: { subway?: RankedRoute[]; surface?: RankedRoute[] };
}

/** Which routes cost riders the most time. Static between ingests. */
export function fetchRanking(): Promise<Ranking> {
  return get("/routes/ranking");
}

/** One hour of the day on one segment, for the hour strip. */
export interface HourBucket {
  hour: number;
  /** Null when the hour has too few observations to describe (P-03). */
  gapMinutesPerMonth: number | null;
  sample: number;
}

export async function segmentHours(
  segmentId: string,
  dayOfWeek?: string,
): Promise<{ hours: HourBucket[] }> {
  const q = new URLSearchParams();
  if (dayOfWeek !== undefined) q.set("dayOfWeek", dayOfWeek);
  const suffix = q.toString() === "" ? "" : `?${q.toString()}`;
  return get(`/segments/${encodeURIComponent(segmentId)}/hours${suffix}`);
}

/** Vehicles reporting per route, right now. Absent means not reporting (P-03). */
export interface LiveRoutesResult {
  vehicles: Record<string, number>;
  ageSeconds: number;
  stale: boolean;
}

export const fetchLiveRoutes = (): Promise<LiveRoutesResult> => get("/routes/live");

/** The delay history's date range and publication date (`/about`). */
export interface AboutData {
  delays: { from: string | null; to: string | null; publishedOn: string | null; source: string };
}

export const fetchAbout = (): Promise<AboutData> => get("/about");
