/**
 * What is actually moving, right now.
 *
 * **This does less than it was built to do, and the reason is the finding.**
 * The intention was `J-02`'s countdown — "is it coming?" — from the TTC's
 * GTFS-Realtime trip updates. Those exist and are fetchable. They are also
 * **in a different identifier space from the static feed this project
 * ingests**, and the collision is silent:
 *
 * - Feed stop id `6857` returns routes 21, 939 and 996. GTFS stop 6857 is
 *   *Queen St West at Triller Ave*. Those are Scarborough routes.
 * - Of 2,301 trip ids in the feed, **1** appears in the 138,036 in the static
 *   feed. The feed's are negative hashes; GTFS ids are sequential.
 *
 * 5,116 of the feed's 8,626 stop ids do exist in our stop table, which is what
 * makes it dangerous: a stop-level board built on the obvious join returns a
 * plausible, confident, wrong answer at more than half of all stops. Matching
 * vehicle positions to the nearest GTFS stop would close the gap by inventing
 * the mapping, which is what `P-03` forbids and what `PR-08` says riders have
 * already learned to distrust.
 *
 * **Route ids do match — 180 of the feed's 181.** So the honest question this
 * feed can answer is not "when is my bus coming" but "is this route running at
 * all right now", which is a real question: `E-D23` measured that 36.1% of all
 * rider-waiting is a vehicle that never came, and 74% of it on the 31
 * Greenwood.
 *
 * **Fetched live, never stored.** An alert is true for hours; a vehicle
 * position is true for seconds. Writing these to a table guarantees every read
 * is stale by however long since the last ingest.
 */

import GtfsRt from "gtfs-realtime-bindings";

const { transit_realtime } = GtfsRt;

const VEHICLES_URL = "https://bustime.ttc.ca/gtfsrt/vehicles";

/**
 * How long a fetched snapshot is reused. Matched to the publishing interval:
 * below it we re-fetch bytes that cannot have changed.
 */
const MEMO_MS = 15_000;

/**
 * Past this the snapshot stops being described as live. A minute is several
 * publishing cycles — the feed has stopped rather than slowed.
 */
export const REALTIME_STALE_AFTER_S = 60;

export interface LiveRoutes {
  /** Vehicles currently reporting, by route id. Absent means *not reporting*. */
  vehicles: Map<string, number>;
  fetchedAt: number;
  ageSeconds: number;
  stale: boolean;
}

let memo: { at: number; value: LiveRoutes } | null = null;

/**
 * Vehicles reporting per route.
 *
 * **A route missing from the map is not a route with zero vehicles.** The feed
 * covers surface routes; the subway is not in it, and a route with nothing
 * running simply does not appear. Callers must treat absent as *unknown* and
 * say so, rather than printing a zero that reads as "nothing is running"
 * (`P-03`).
 */
export async function liveRoutes(nowMs: number = Date.now()): Promise<LiveRoutes> {
  if (memo !== null && nowMs - memo.at < MEMO_MS) {
    const ageSeconds = Math.round((nowMs - memo.value.fetchedAt) / 1000);
    return { ...memo.value, ageSeconds, stale: ageSeconds > REALTIME_STALE_AFTER_S };
  }

  const res = await fetch(VEHICLES_URL);
  if (!res.ok) throw new Error(`vehicles feed failed (${res.status})`);
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(await res.arrayBuffer()));

  const vehicles = new Map<string, number>();
  for (const entity of feed.entity ?? []) {
    const routeId = entity.vehicle?.trip?.routeId;
    if (routeId == null) continue;
    vehicles.set(routeId, (vehicles.get(routeId) ?? 0) + 1);
  }

  const value: LiveRoutes = { vehicles, fetchedAt: nowMs, ageSeconds: 0, stale: false };
  memo = { at: nowMs, value };
  return value;
}

/** Testing seam: drops the memo so a fetch is forced. */
export function resetRealtimeCache(): void {
  memo = null;
}
