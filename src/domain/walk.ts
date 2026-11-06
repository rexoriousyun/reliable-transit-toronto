/**
 * Walk, or wait for the bus?
 *
 * `J-05` is the one journey where "which option" is a real question, and
 * `D-40` says why it is scoped here and nowhere else: a materially different
 * second option exists on 12.3% of downtown trips against 1.3% citywide
 * (`E-D27`). Outside the core the honest answer is one route and when to leave,
 * not a menu.
 *
 * **The app must be willing to say walk.** A transit app that never recommends
 * against transit is not trusted on the occasions it matters — the design
 * commitment recorded on `F-03`.
 *
 * What makes this answerable without inventing anything: the walk is geometry,
 * and the wait is a published headway (`D-34`). Neither is a prediction. What
 * we do *not* claim is which is nicer — that depends on weather, luggage,
 * mobility and the hour, none of which we hold.
 */

/**
 * How much further a real walk is than the straight line between two points.
 *
 * Every distance here is great-circle, which is a *floor*: pavements follow
 * blocks. Reporting the floor as the walk understates every door-to-door figure
 * and, worse, biases the planner toward alighting far from the door — the error
 * grows with distance, so a long walk is flattered more than a short one.
 *
 * 1.3 is the usual planning figure for a gridded street network, and Toronto is
 * gridded. It is an adjustment for a known bias, not a guess about a particular
 * walk: applying nothing is also a number, and it is the wrong one.
 */
const DETOUR_FACTOR = 1.3;

/**
 * The transfer graph's own pace, imported rather than restated.
 *
 * These were briefly two constants with the same value in two files. Nothing
 * would have caught them drifting, and the symptom would have been a walk leg
 * *inside* a journey timed differently from the walk offered *instead* of it.
 */
import { WALK_SPEED_MS } from "./footpaths.js";

/**
 * How far a rider will consider walking end to end.
 *
 * Two kilometres is about 27 minutes at walking pace. Beyond that the
 * comparison stops being a choice and starts being a lecture — and the
 * threshold is deliberately generous rather than tuned, because nobody has
 * asked a rider yet (`D-08`).
 */
const MAX_WALK_JOURNEY_M = 2000;

/**
 * The downtown box from `E-D14` — 321 stops across 26 routes, against 131
 * across 17 in an equivalent Scarborough box. `D-40` scopes comparison to it.
 */
const CORE = { minLat: 43.638, maxLat: 43.672, minLon: -79.415, maxLon: -79.355 };

export interface Point { lat: number; lon: number }

export function inCore(p: Point): boolean {
  return p.lat >= CORE.minLat && p.lat <= CORE.maxLat
      && p.lon >= CORE.minLon && p.lon <= CORE.maxLon;
}

/** Great-circle metres. Flat enough at this scale for a walking estimate. */
export function metresBetween(a: Point, b: Point): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface WalkOption {
  minutes: number;
  metres: number;
}

/**
 * The walking option, when there is one worth offering.
 *
 * Null outside the core (`D-40`) or beyond `MAX_WALK_JOURNEY_M`. Null is the common
 * answer and the right one: most trips in this city are not a choice.
 *
 * **Straight-line, and the number says so.** A real walking route is longer
 * than the crow flies, so this is a floor rather than an estimate — which is
 * why the interface must not print it as "22 min" full stop. Toronto's grid
 * makes the detour factor small downtown, but small is not zero and `P-03`
 * does not soften for convenience.
 */
export function walkOption(from: Point, to: Point): WalkOption | null {
  if (!inCore(from) || !inCore(to)) return null;
  const metres = Math.round(metresBetween(from, to));
  if (metres > MAX_WALK_JOURNEY_M) return null;
  return { metres, minutes: Math.max(1, Math.round(walkSeconds(metres) / 60)) };
}

/**
 * How far a rider will walk to reach the network.
 *
 * Further than a transfer footpath (400 m) because this is a walk they choose
 * once at each end, not one imposed mid-trip — and short of the 2 km that makes
 * walking the whole way a real option, since past that the comparison in
 * `walkOption` is the better answer.
 */
const MAX_ACCESS_M = 1200;

/**
 * A bound on candidates, not a shortlist.
 *
 * This was 6, on the reasoning that beyond a handful they are the same corner
 * twice. That was wrong, and wrong in the direction that produces nonsense: the
 * six nearest stops to a door are all the same two bus routes, so **every
 * station is excluded**. For one real address, 75 stops sat within the radius
 * and the nearest LRT station ranked 54th — so the planner could not consider
 * getting off the train and walking, and instead rode a bus for two minutes at
 * a cost of eight, saving nothing at all.
 *
 * Cost is not the reason to keep this small. Every origin is seeded into *one*
 * scan, and the far end is a comparison over a result the scan already computed.
 * The number is a guard against a pathological input, not a search budget.
 */
const MAX_ACCESS_STOPS = 80;

/** Seconds on foot for a straight-line distance, detour included. */
export function walkSeconds(metres: number): number {
  return Math.round((metres * DETOUR_FACTOR) / WALK_SPEED_MS);
}

export interface AccessStop {
  stopId: string;
  seconds: number;
  metres: number;
}

/**
 * Stops a rider could walk to from a point, nearest first.
 *
 * Returns every stop in the radius rather than a shortlist, because the ones
 * that matter are often not the closest: a station 900 m away that the network
 * actually reaches beats a bus stop 300 m away that it does not. The planner
 * seeds them all into one scan and lets the timetable decide, which is the whole
 * reason this returns a list.
 *
 * Straight-line, so every figure is a floor. Toronto's grid keeps the error
 * small and the interface says "about" rather than printing a minute it has not
 * earned (`P-03`).
 */
export function accessStops(
  from: Point,
  stops: ReadonlyArray<{ id: string; lat: number; lon: number }>,
  limit = MAX_ACCESS_STOPS,
): AccessStop[] {
  const near: AccessStop[] = [];
  for (const s of stops) {
    const metres = metresBetween(from, s);
    if (metres > MAX_ACCESS_M) continue;
    near.push({ stopId: s.id, metres, seconds: walkSeconds(metres) });
  }
  return near.sort((a, b) => a.metres - b.metres).slice(0, limit);
}

/**
 * Drop a ride that costs more in walking than it saves.
 *
 * Connection Scan optimises arrival and never asks whether a leg earns its own
 * overhead, so it will happily ride one stop between two walks. On one real
 * trip it rode the 94 for a minute and then walked four minutes back toward
 * where it had boarded; on the same trip it rode the 512 for a minute between a
 * five-minute walk and a four-minute one.
 *
 * **A ride is only dropped when walking is at least as good.** The rule is not
 * "short rides are suspicious" — a one-minute subway hop between two stations
 * can be exactly right. It is the comparison the rider would make: from where
 * this stretch begins to where it ends, is walking faster, or close enough not
 * to matter? `TOLERANCE_S` is the same margin the door-to-door tiebreak uses
 * and for the same reason — these are straight-line distances with a flat
 * detour factor, so a difference smaller than a couple of minutes is inside our
 * own error.
 */
const TOLERANCE_S = 150;

interface CollapsibleLeg {
  kind: "ride" | "walk";
  fromStop: string;
  toStop: string;
  departAt: number;
  arriveAt: number;
}

export function collapsePointlessRides<T extends CollapsibleLeg>(
  legs: readonly T[],
  coordOf: (stopId: string) => Point | undefined,
  makeWalk: (fromStop: string, toStop: string, departAt: number, arriveAt: number) => T,
): T[] {
  const out: T[] = [];
  let i = 0;

  while (i < legs.length) {
    // A stretch is one ride plus the walking either side of it, bounded by the
    // rides that survive. Judging a ride without its walks would miss the whole
    // cost; judging several rides together would throw away a good one to
    // remove a bad neighbour.
    if (legs[i]!.kind !== "ride") { out.push(legs[i]!); i++; continue; }

    // The leading walks come off `out`, not out of `legs`.
    //
    // A collapsed stretch leaves a walk that is not one of the original legs, so
    // matching against `legs` skipped it and the next ride was judged without
    // the walking in front of it. That is how a trip kept a one-minute ride
    // sitting between a thirteen-minute walk and a three-minute one: the
    // thirteen minutes had already been rewritten and were invisible to the
    // comparison.
    const before: T[] = [];
    while (out.length > 0 && out[out.length - 1]!.kind === "walk") before.unshift(out.pop()!);

    let end = i;
    while (end + 1 < legs.length && legs[end + 1]!.kind === "walk") end++;
    const stretch = [...before, ...legs.slice(i, end + 1)];

    const first = stretch[0]!;
    const last = stretch[stretch.length - 1]!;
    const a = coordOf(first.fromStop);
    const b = coordOf(last.toStop);
    const elapsed = last.arriveAt - first.departAt;
    const direct = a === undefined || b === undefined
      ? Infinity
      : walkSeconds(metresBetween(a, b));

    if (direct <= elapsed + TOLERANCE_S) {
      // Walking wins, or is close enough that a bus ride is not the difference.
      // The walk keeps the stretch's own departure so the rest of the trip is
      // untouched, and finishes when walking finishes — earlier, when walking
      // genuinely is faster.
      out.push(makeWalk(first.fromStop, last.toStop, first.departAt, first.departAt + direct));
    } else {
      out.push(...stretch);
    }
    i = end + 1;
  }

  return out;
}
