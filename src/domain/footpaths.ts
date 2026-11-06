/**
 * Walking transfers between nearby stops.
 *
 * Without these a planner can only change vehicles where two routes share a
 * stop id, which on the TTC means it would miss most real transfers — opposite
 * corners of an intersection are separate stops, and a subway station's bus
 * bays are separate again.
 */

const MAX_WALK_M = 400;

/**
 * Walking pace, in metres per second.
 *
 * Exported because `walk.ts` compares a whole journey against walking it, and
 * two files disagreeing about how fast a person walks would let the transfer
 * and the comparison contradict each other on the same screen.
 */
export const WALK_SPEED_MS = 1.25;
/** Charged on every transfer: finding the platform, crossing the road. */
export const MIN_TRANSFER_S = 60;

export interface Footpaths {
  /** Flattened adjacency: neighbours of stop i are [offset[i], offset[i+1]). */
  offset: Int32Array;
  target: Int32Array;
  seconds: Int32Array;
}

function metres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const latRad = (aLat * Math.PI) / 180;
  const dLat = (bLat - aLat) * 111_320;
  const dLon = (bLon - aLon) * 111_320 * Math.cos(latRad);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

/**
 * Builds walking edges via a grid index.
 *
 * All-pairs over 9,000 stops is 42M comparisons; bucketing by a cell slightly
 * larger than the walk radius means each stop only compares against its own
 * cell and the eight around it.
 */
export function buildFootpaths(lat: Float64Array, lon: Float64Array): Footpaths {
  const n = lat.length;
  const cell = 0.006; // ~600m of latitude
  const grid = new Map<string, number[]>();
  const key = (la: number, lo: number): string =>
    `${Math.floor(la / cell)}:${Math.floor(lo / cell)}`;

  for (let i = 0; i < n; i++) {
    const k = key(lat[i]!, lon[i]!);
    const bucket = grid.get(k);
    if (bucket === undefined) grid.set(k, [i]);
    else bucket.push(i);
  }

  const targets: number[][] = [];
  const times: number[][] = [];
  let total = 0;

  for (let i = 0; i < n; i++) {
    const gy = Math.floor(lat[i]! / cell);
    const gx = Math.floor(lon[i]! / cell);
    const t: number[] = [];
    const s: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = grid.get(`${gy + dy}:${gx + dx}`);
        if (bucket === undefined) continue;
        for (const j of bucket) {
          if (j === i) continue;
          const d = metres(lat[i]!, lon[i]!, lat[j]!, lon[j]!);
          if (d > MAX_WALK_M) continue;
          t.push(j);
          s.push(Math.max(MIN_TRANSFER_S, Math.round(d / WALK_SPEED_MS)));
        }
      }
    }
    targets.push(t);
    times.push(s);
    total += t.length;
  }

  const offset = new Int32Array(n + 1);
  const target = new Int32Array(total);
  const seconds = new Int32Array(total);
  let k = 0;
  for (let i = 0; i < n; i++) {
    offset[i] = k;
    for (let j = 0; j < targets[i]!.length; j++) {
      target[k] = targets[i]![j]!;
      seconds[k] = times[i]![j]!;
      k++;
    }
  }
  offset[n] = k;
  return { offset, target, seconds };
}
