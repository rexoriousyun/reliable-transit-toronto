/**
 * Connection Scan: earliest-arrival journey planning.
 *
 * One pass over connections sorted by departure time. Chosen over RAPTOR
 * because it is short enough to be obviously correct, and correctness matters
 * more here than the last millisecond — the reliability layer is the product,
 * the planner underneath it just has to be right.
 */

import type { ConnectionSet } from "./connections.js";
import { MIN_TRANSFER_S, type Footpaths } from "./footpaths.js";

const INF = 0x7fffffff;

export interface Leg {
  kind: "ride" | "walk";
  fromStop: string;
  toStop: string;
  departAt: number;
  arriveAt: number;
  /** Present on a ride. */
  routeId?: string;
  tripId?: string;
  /** Every stop the ride passes through, board to alight. Needed to map a leg
   *  onto the segments it traverses, which is what carries the reliability. */
  stopIds?: string[];
}

export interface Journey {
  legs: Leg[];
  departAt: number;
  arriveAt: number;
  transfers: number;
}

interface Reached {
  /** Connection index that produced the best arrival at this stop, or -1. */
  viaConnection: Int32Array;
  /** Stop walked from, or -1 when the arrival was a ride. */
  viaWalk: Int32Array;
  arrival: Int32Array;
}

/**
 * Earliest arrival at every stop, given a departure time and origin.
 *
 * A connection is boardable when we are already aboard its trip, or when we
 * reached its departure stop early enough to transfer. Tracking trip
 * reachability is what keeps a rider from being charged a transfer penalty for
 * simply staying on the vehicle.
 */
function scan(
  c: ConnectionSet,
  paths: Footpaths,
  /**
   * Where the rider can start, and when they can be there.
   *
   * More than one, because a trip may begin at a street address rather than a
   * stop: every stop within walking distance is a way in, each reachable at a
   * different time. Seeding them all costs one scan; running the planner once
   * per candidate stop would cost one scan each and still have to guess which
   * to try.
   */
  origins: ReadonlyArray<{ stop: number; at: number }>,
  departAt: number,
  horizonSeconds: number,
  bannedRoutes: ReadonlySet<string>,
  /**
   * Stops a rider may ride *through* but never use.
   *
   * A station with no step-free route is not a station this rider can board,
   * alight or change at — but the train still passes through it, and blocking
   * the hop entirely would sever lines that are perfectly usable end to end.
   * So the flag suppresses arrivals and walks, not movement (D-07).
   */
  blockedStops: Uint8Array,
): Reached {
  const stops = c.stopIds.length;
  const arrival = new Int32Array(stops).fill(INF);
  const viaConnection = new Int32Array(stops).fill(-1);
  const viaWalk = new Int32Array(stops).fill(-1);
  const onTrip = new Uint8Array(c.tripIds.length);

  const relaxWalks = (stop: number): void => {
    for (let e = paths.offset[stop]!; e < paths.offset[stop + 1]!; e++) {
      const to = paths.target[e]!;
      if (blockedStops[to] === 1) continue;
      const t = arrival[stop]! + paths.seconds[e]!;
      if (t < arrival[to]!) {
        arrival[to] = t;
        viaConnection[to] = -1;
        viaWalk[to] = stop;
      }
    }
  };

  // Every seed is placed before any walk is relaxed. Relaxing as we go would
  // let a walk out of the first origin overwrite a second origin that is
  // reachable sooner on foot from the door.
  for (const o of origins) {
    if (o.at < arrival[o.stop]!) arrival[o.stop] = o.at;
  }
  for (const o of origins) relaxWalks(o.stop);

  // Binary search to the first connection departing at or after departAt:
  // scanning the earlier ones cannot help and there are hundreds of thousands.
  let lo = 0;
  let hi = c.count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (c.depTime[mid]! < departAt) lo = mid + 1;
    else hi = mid;
  }

  const limit = departAt + horizonSeconds;
  for (let i = lo; i < c.count; i++) {
    const dep = c.depTime[i]!;
    if (dep > limit) break;

    const trip = c.trip[i]!;
    if (bannedRoutes.size > 0 && bannedRoutes.has(c.tripRoute[trip]!)) continue;
    const from = c.fromStop[i]!;
    // Staying on a vehicle is always allowed; getting on is not, at a stop this
    // rider cannot reach the platform of.
    const boardable = onTrip[trip] === 1
      || (blockedStops[from] === 0 && arrival[from]! + MIN_TRANSFER_S <= dep);
    if (!boardable) continue;

    onTrip[trip] = 1;
    const to = c.toStop[i]!;
    if (c.arrTime[i]! < arrival[to]!) {
      // The arrival is recorded even at a blocked stop: the vehicle really does
      // get there, and the path back through it is how a through-ride is
      // reconstructed. What is withheld is every way of *leaving* on foot, and
      // boarding is refused above — so a rider passes through without the stop
      // ever becoming usable.
      arrival[to] = c.arrTime[i]!;
      viaConnection[to] = i;
      viaWalk[to] = -1;
      if (blockedStops[to] === 0) relaxWalks(to);
    }
  }

  return { arrival, viaConnection, viaWalk };
}

/** Walks the back-pointers from the target to the origin and reverses. */
function reconstruct(
  c: ConnectionSet,
  r: Reached,
  /** 1 at every stop the rider could have started from. */
  isOrigin: Uint8Array,
  target: number,
): Leg[] | null {
  if (r.arrival[target] === INF) return null;

  const legs: Leg[] = [];
  let at = target;
  let guard = 0;

  while (isOrigin[at] !== 1 && guard++ < 500) {
    const conn = r.viaConnection[at]!;
    if (conn !== -1) {
      // Walk back along the same trip to find where this ride was boarded, so
      // a ten-stop journey on one bus reads as one leg, not ten.
      const trip = c.trip[conn]!;
      let first = conn;
      let boardStop = c.fromStop[conn]!;
      while (
        r.viaConnection[boardStop] !== -1 &&
        c.trip[r.viaConnection[boardStop]!] === trip
      ) {
        first = r.viaConnection[boardStop]!;
        boardStop = c.fromStop[first]!;
      }
      // Replay the ride forward to collect the stops it passes through.
      const traversed: string[] = [c.stopIds[boardStop]!];
      let cursor = first;
      while (true) {
        traversed.push(c.stopIds[c.toStop[cursor]!]!);
        if (cursor === conn) break;
        // The next connection on this trip departs where this one arrived.
        let next = -1;
        for (let k = cursor + 1; k < c.count; k++) {
          if (c.trip[k] === trip && c.fromStop[k] === c.toStop[cursor]!) { next = k; break; }
        }
        if (next === -1) break;
        cursor = next;
      }

      legs.push({
        kind: "ride",
        fromStop: c.stopIds[boardStop]!,
        toStop: c.stopIds[at]!,
        departAt: c.depTime[first]!,
        arriveAt: c.arrTime[conn]!,
        routeId: c.tripRoute[trip]!,
        tripId: c.tripIds[trip]!,
        stopIds: traversed,
      });
      at = boardStop;
      continue;
    }

    const walked = r.viaWalk[at]!;
    if (walked === -1) return null;
    legs.push({
      kind: "walk",
      fromStop: c.stopIds[walked]!,
      toStop: c.stopIds[at]!,
      departAt: r.arrival[walked]!,
      arriveAt: r.arrival[at]!,
    });
    at = walked;
  }

  if (isOrigin[at] !== 1) return null;
  return legs.reverse();
}

export function plan(
  c: ConnectionSet,
  paths: Footpaths,
  fromStopId: string,
  toStopId: string,
  departAt: number,
  horizonSeconds = 3 * 3600,
  bannedRoutes: ReadonlySet<string> = new Set(),
  /** Stop ids a rider cannot use — see `blockedStops` in `scan`. */
  bannedStops: ReadonlySet<string> = new Set(),
): Journey | null {
  const origin = c.stopIndex.get(fromStopId);
  const target = c.stopIndex.get(toStopId);
  if (origin === undefined || target === undefined) return null;

  const blocked = new Uint8Array(c.stopIds.length);
  for (const id of bannedStops) {
    const i = c.stopIndex.get(id);
    // Never the rider's own ends: they chose them, and a trip they cannot
    // complete is a real answer to give them, not a trip to hide.
    if (i !== undefined && i !== origin && i !== target) blocked[i] = 1;
  }

  const reached = scan(c, paths, [{ stop: origin, at: departAt }], departAt,
                       horizonSeconds, bannedRoutes, blocked);
  const isOrigin = new Uint8Array(c.stopIds.length);
  isOrigin[origin] = 1;
  const legs = reconstruct(c, reached, isOrigin, target);
  if (legs === null || legs.length === 0) return null;

  return {
    legs,
    departAt: legs[0]!.departAt,
    arriveAt: legs[legs.length - 1]!.arriveAt,
    transfers: Math.max(0, legs.filter((l) => l.kind === "ride").length - 1),
  };
}

/**
 * How close two door-to-door times have to be before the simpler trip wins.
 *
 * Pre-registered here rather than tuned against an example. It is sized to the
 * uncertainty in our own walking estimate: those are straight-line distances
 * with a flat detour factor, so on a walk of several hundred metres the figure
 * is comfortably a minute or two out either way. A margin smaller than that is
 * not a real difference, and resolving it with an extra bus ride claims a
 * precision the estimate does not have (`P-08`).
 */
const TIE_SECONDS = 150;

/** How many rides it takes to reach a stop, by walking the predecessors back. */
function ridesTo(c: ConnectionSet, r: Reached, stop: number): number {
  let at = stop;
  let rides = 0;
  let guard = 0;
  while (guard++ < 500) {
    const conn = r.viaConnection[at]!;
    if (conn !== -1) {
      rides++;
      const trip = c.trip[conn]!;
      let board = c.fromStop[conn]!;
      while (r.viaConnection[board] !== -1 && c.trip[r.viaConnection[board]!] === trip) {
        board = c.fromStop[r.viaConnection[board]!]!;
      }
      at = board;
      continue;
    }
    const walked = r.viaWalk[at]!;
    if (walked === -1) return rides;
    at = walked;
  }
  return rides;
}

/** A way into or out of the network on foot, from a point that is not a stop. */
export interface Access {
  stopId: string;
  /** Seconds of walking between the door and this stop. */
  seconds: number;
}

export interface PointJourney {
  journey: Journey;
  /** The stop the rider walks to, and how long that takes. */
  access: Access;
  /** The stop they walk from at the far end. */
  egress: Access;
  /** Door to door, walking included. */
  totalSeconds: number;
}

/**
 * Plan between two *places* rather than two stops.
 *
 * The trip used to begin at a stop the rider was assumed to already be standing
 * at, so the first and last mile were invisible and every door-to-door figure
 * was short by however long the walk takes. With an address at each end, both
 * walks are part of the answer.
 *
 * **One scan, many ways in.** Each candidate origin stop is seeded at
 * `departAt + its walk`, so the search naturally prefers a stop that is further
 * away when the service there leaves sooner — which is the whole reason not to
 * simply snap to the nearest stop. The nearest stop is often on a route going
 * the wrong way.
 *
 * **The far end is free.** A scan already computes arrival at every stop, so
 * choosing between candidate destinations is a comparison over results rather
 * than another search: arrival plus the walk from that stop to the door.
 */
export function planFromPoints(
  c: ConnectionSet,
  paths: Footpaths,
  origins: readonly Access[],
  destinations: readonly Access[],
  departAt: number,
  horizonSeconds = 3 * 3600,
  bannedRoutes: ReadonlySet<string> = new Set(),
  bannedStops: ReadonlySet<string> = new Set(),
): PointJourney | null {
  const seeds: Array<{ stop: number; at: number; access: Access }> = [];
  for (const o of origins) {
    const i = c.stopIndex.get(o.stopId);
    if (i !== undefined) seeds.push({ stop: i, at: departAt + o.seconds, access: o });
  }
  const targets: Array<{ stop: number; egress: Access }> = [];
  for (const d of destinations) {
    const i = c.stopIndex.get(d.stopId);
    if (i !== undefined) targets.push({ stop: i, egress: d });
  }
  if (seeds.length === 0 || targets.length === 0) return null;

  const isOrigin = new Uint8Array(c.stopIds.length);
  for (const s of seeds) isOrigin[s.stop] = 1;

  const blocked = new Uint8Array(c.stopIds.length);
  for (const id of bannedStops) {
    const i = c.stopIndex.get(id);
    if (i === undefined) continue;
    // Never a stop the rider is starting from or heading to.
    if (isOrigin[i] === 1) continue;
    if (targets.some((t) => t.stop === i)) continue;
    blocked[i] = 1;
  }

  const reached = scan(c, paths, seeds, departAt, horizonSeconds, bannedRoutes, blocked);

  // Door to door: arriving at a stop is not arriving, so the walk off the far
  // end decides which destination stop actually wins.
  //
  // **Ties go to the shorter ride.** Walking distances here are straight-line
  // with a detour factor applied — an adjustment for a known bias, not a
  // measurement — so a door-to-door margin of a minute or two is inside our own
  // error. Spending a ride to win it is false precision, and it produces
  // journeys nobody would follow: on one real trip the planner rode a bus for
  // two minutes, after a one-minute walk and a two-minute wait, to arrive one
  // minute earlier than walking. This is `D-38`'s tiebreak, applied where the
  // evidence for it turned up.
  const candidates: Array<{ stop: number; egress: Access; doorAt: number; rides: number }> = [];
  for (const t of targets) {
    const at = reached.arrival[t.stop]!;
    if (at >= INF) continue;
    candidates.push({ ...t, doorAt: at + t.egress.seconds, rides: ridesTo(c, reached, t.stop) });
  }
  if (candidates.length === 0) return null;

  const earliest = Math.min(...candidates.map((x) => x.doorAt));
  const best = candidates
    .filter((x) => x.doorAt <= earliest + TIE_SECONDS)
    .sort((a, b) => (a.rides !== b.rides ? a.rides - b.rides : a.doorAt - b.doorAt))[0]!;

  const legs = reconstruct(c, reached, isOrigin, best.stop);
  if (legs === null || legs.length === 0) return null;

  const boarded = legs[0]!.fromStop;
  const access = seeds.find((s) => c.stopIds[s.stop] === boarded)?.access
    ?? { stopId: boarded, seconds: 0 };

  return {
    journey: {
      legs,
      departAt: legs[0]!.departAt,
      arriveAt: legs[legs.length - 1]!.arriveAt,
      transfers: Math.max(0, legs.filter((l) => l.kind === "ride").length - 1),
    },
    access,
    egress: best.egress,
    // From leaving the door to reaching it, which is longer than the trip.
    totalSeconds: best.doorAt - departAt,
  };
}
