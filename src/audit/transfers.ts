/**
 * Does a transfer cost anything in this product?
 *
 * `PR-05` says each transfer is a fresh chance to miss a connection and that
 * variance compounds rather than averages out. `D-34` acted on half of that:
 * every wait now carries the headway behind it, so a rider can read what one
 * no-show costs *at the stop they are standing at*. Nothing acted on the other
 * half — whether a trip with three of those should rank below a trip with none.
 *
 * This audit asks three questions of the planner as it actually runs, because
 * the answer to all three was assumed rather than measured:
 *
 * 1. **Is the ranking transfer-blind?** Journeys sort on
 *    `durationMinutes + expectedAddedMinutes`. If the second term is small
 *    relative to the differences in the first, the sort is schedule time and
 *    nothing else, and a trip that saves one minute by adding two connections
 *    wins every time.
 *
 * 2. **How tight are the connections it picks?** Connection Scan finds earliest
 *    arrival, which is exactly the objective that selects the tightest legal
 *    transfer available. `MIN_TRANSFER_S` is 60 seconds, so "legal" starts one
 *    minute above impossible.
 *
 * 3. **Does the composed risk reward ignorance?** `composeRisk` multiplies
 *    `(1 - risk)` over scored segments. An unscored leg contributes `risk = 0`,
 *    which enters the product as a perfect leg. More transfers means more
 *    surface legs, and surface is where coverage is thin (E-D12) — so the bias,
 *    if present, runs toward telling riders that the trip we know least about
 *    is the safest one on the screen. That is `P-03` at the level of the
 *    headline number rather than the map, and E-D21 already caught the same
 *    shape of error one level up in the reference class.
 *
 * **Measured on the planner, not on the network.** An audit over all possible
 * transfers would describe the graph. What matters is the connections this
 * ranking puts in front of a rider, so every figure below is taken from the
 * journeys the planner actually returns, at the same four departure times and
 * with the same service-weighted origin draw the benchmark uses (E-D21) — a
 * uniform draw over stops would fill the sample with quiet suburban pairs
 * nobody travels between, which is the mistake that made every real trip look
 * terrible the first time.
 */

import { prisma, disconnect } from "../db/client.js";
import { loadConnections } from "../domain/connections.js";
import { buildFootpaths } from "../domain/footpaths.js";
import { buildFrequency } from "../domain/frequency.js";
import { plan, type Journey } from "../domain/csa.js";
import { scoreJourney, buildSegmentIndex } from "../domain/itinerary.js";
import { waitsOn, NOTABLE_HEADWAY_MINUTES } from "../domain/wait.js";

const WEEKDAY_SERVICE = "1";
const DEPART_TIMES = [7 * 3600 + 30 * 60, 12 * 3600, 17 * 3600, 21 * 3600];
const TARGET_JOURNEYS = 400;
const MAX_ATTEMPTS = 20000;

/* ---- Pre-registered thresholds -------------------------------------------
   Fixed before any number was looked at. */

/**
 * Scheduled slack at or below this is a connection a rider misses if anything
 * at all goes wrong on the leg before it.
 *
 * Two minutes rather than a judgement about walking speed: `MIN_TRANSFER_S` is
 * 60 seconds, so one minute is the floor the graph will emit and measuring at
 * the floor would only count connections that are already at the limit. Two is
 * the first value that describes a *choice* the ranking made rather than the
 * constraint's edge.
 */
const TIGHT_SLACK_MINUTES = 2;

/**
 * The headway that makes a missed connection expensive.
 *
 * Reused from `D-34` rather than invented here. It was audited in its own right
 * (`npm run audit:headway`, E-D24): 20 minutes fires on 25.0% of weekday
 * departures and 74.3% of night ones, where 10 — the TTC's own frequent-service
 * standard — turned out to be the median and would have described half of all
 * service. A second threshold for the same underlying quantity would be a
 * second chance to pick a flattering number.
 */
const EXPOSED_HEADWAY_MINUTES = NOTABLE_HEADWAY_MINUTES;

/**
 * Above this share of comparable trips, the ranking is transfer-blind in
 * practice.
 *
 * "Comparable" means the planner returned an alternative with strictly fewer
 * transfers, so the ranking had a choice to make. Some preference for the
 * faster trip is correct — a rider who wanted the simplest possible journey
 * regardless of time is not who this ranks for. Nine in ten is the point at
 * which "sometimes prefers speed" stops being a fair description.
 */
const RANKING_BLIND_ABOVE = 0.9;

/**
 * Below this share of top-ranked trips carrying an exposed connection, the
 * problem is real but too rare to spend a decision on.
 *
 * The same reasoning as `MIN_SHARE` in the headway audit: a condition that
 * almost never fires does not earn a change to the ranking, whatever the
 * principle says about it.
 */
const EXPOSED_MATTERS_ABOVE = 0.1;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor((sorted.length - 1) * p)]!;
}

async function main(): Promise<void> {
  const connections = await loadConnections(WEEKDAY_SERVICE);
  const stops = await prisma.stop.findMany({ select: { id: true, name: true, lat: true, lon: true } });
  const byId = new Map(stops.map((s) => [s.id, s]));
  const stopNames = new Map(stops.map((s) => [s.id, s.name]));
  const nameOf = (id: string): string => stopNames.get(id) ?? id;

  const lat = new Float64Array(connections.stopIds.length);
  const lon = new Float64Array(connections.stopIds.length);
  for (let i = 0; i < connections.stopIds.length; i++) {
    const s = byId.get(connections.stopIds[i]!);
    lat[i] = s?.lat ?? 0;
    lon[i] = s?.lon ?? 0;
  }
  const footpaths = buildFootpaths(lat, lon);
  const frequency = buildFrequency(connections, nameOf);
  const segments = await prisma.segment.findMany({
    select: { id: true, routeId: true, fromStation: true, toStation: true,
              fromStopId: true, toStopId: true, mode: true, geometry: true },
  });
  const segmentIndex = buildSegmentIndex(segments);

  // Service-weighted origin draw and a distance-first destination, both lifted
  // from the benchmark so this sample and that reference class describe the
  // same population of trips.
  const departures = new Map<string, number>();
  for (let i = 0; i < connections.fromStop.length; i++) {
    const id = connections.stopIds[connections.fromStop[i]!]!;
    departures.set(id, (departures.get(id) ?? 0) + 1);
  }
  const boardable = [...departures.keys()];
  const CELL = 0.01;
  const grid = new Map<string, string[]>();
  for (const id of boardable) {
    const s = byId.get(id);
    if (s === undefined) continue;
    const k = `${Math.round(s.lat / CELL)}|${Math.round(s.lon / CELL)}`;
    const list = grid.get(k);
    if (list === undefined) grid.set(k, [id]);
    else list.push(id);
  }

  const rand = mulberry32(20260901);
  const cumulative = new Float64Array(boardable.length);
  let running = 0;
  for (let i = 0; i < boardable.length; i++) {
    running += departures.get(boardable[i]!) ?? 0;
    cumulative[i] = running;
  }
  const drawWeighted = (pool: readonly string[]): string => {
    if (pool === boardable) {
      const target = rand() * running;
      let lo = 0, hi = boardable.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid]! < target) lo = mid + 1;
        else hi = mid;
      }
      return boardable[lo]!;
    }
    let total = 0;
    for (const id of pool) total += departures.get(id) ?? 0;
    if (total <= 0) return pool[Math.floor(rand() * pool.length)]!;
    let target = rand() * total;
    for (const id of pool) {
      target -= departures.get(id) ?? 0;
      if (target <= 0) return id;
    }
    return pool[pool.length - 1]!;
  };
  const pickNear = (fromId: string, km: number): string | null => {
    const s = byId.get(fromId);
    if (s === undefined) return null;
    const dLat = km / 111;
    const dLon = km / (111 * Math.cos((s.lat * Math.PI) / 180));
    const ring: string[] = [];
    for (const [k, ids] of grid) {
      const [la, lo] = k.split("|").map(Number) as [number, number];
      const dy = (la * CELL - s.lat) / dLat;
      const dx = (lo * CELL - s.lon) / dLon;
      const r = Math.hypot(dx, dy);
      if (r >= 0.8 && r <= 1.2) ring.push(...ids);
    }
    return ring.length === 0 ? null : drawWeighted(ring);
  };

  /** The same alternative generation the planner uses: ban one route at a time. */
  const alternativesOf = (best: Journey, from: string, to: string, departAt: number): Journey[] => {
    const out: Journey[] = [];
    const used = [...new Set(best.legs.filter((l) => l.kind === "ride").map((l) => l.routeId!))];
    const signature = (j: Journey): string =>
      j.legs.map((l) => `${l.kind}:${l.routeId ?? ""}`).join(">");
    const seen = new Set([signature(best)]);
    for (const banned of used.slice(0, 3)) {
      const alt = plan(connections, footpaths, from, to, departAt, 3 * 3600, new Set([banned]));
      if (alt === null) continue;
      const sig = signature(alt);
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(alt);
    }
    return out;
  };

  let found = 0;
  let withTransfer = 0;
  let comparable = 0;      // an alternative with strictly fewer transfers existed
  let rankedMore = 0;      // ...and the top-ranked trip still had more
  let exposedTrips = 0;    // at least one tight connection onto sparse service
  const slack: number[] = [];
  const headways: number[] = [];
  let zeroSlack = 0;
  let tightAndExposed = 0;
  let connections_ = 0;
  /** Reported risk and coverage, split by how many transfers the trip has. */
  const byTransfers = new Map<number, { n: number; risk: number[]; coverage: number[] }>();
  /** Where the ranking chose more transfers, what it bought in minutes. */
  const minutesSaved: number[] = [];
  /**
   * Of those, how many bought less than a minute.
   *
   * **Reported without a verdict, and deliberately.** This counter was added
   * after the first run, because the distribution of `minutesSaved` came out
   * with a median of zero and that was not a case anyone had thought to ask
   * about. A threshold chosen now would be chosen knowing the answer, which is
   * the renegotiation the pre-registered ones above exist to prevent — so this
   * one carries no PASS or FAIL and decides nothing on its own. It is a
   * description, and any decision resting on it needs its own audit written
   * before the next measurement.
   */
  let boughtNothing = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS && found < TARGET_JOURNEYS; attempt++) {
    const from = drawWeighted(boardable);
    const km = 1 + 24 * rand() * rand();
    const to = pickNear(from, km);
    if (to === null || to === from) continue;
    const departAt = DEPART_TIMES[attempt % DEPART_TIMES.length]!;
    const best = plan(connections, footpaths, from, to, departAt);
    if (best === null) continue;

    const scored = await scoreJourney(best, segmentIndex, frequency, nameOf);
    found++;
    if (best.transfers > 0) withTransfer++;

    const bucket = byTransfers.get(best.transfers) ?? { n: 0, risk: [], coverage: [] };
    bucket.n++;
    bucket.risk.push(scored.reliability.disruptionRisk);
    bucket.coverage.push(scored.reliability.coverage);
    byTransfers.set(best.transfers, bucket);

    let exposed = false;
    for (const w of waitsOn(best.legs, frequency)) {
      connections_++;
      slack.push(w.scheduledMinutes);
      if (w.scheduledMinutes === 0) zeroSlack++;
      if (w.headwayMinutes === null) continue;
      headways.push(w.headwayMinutes);
      if (w.scheduledMinutes <= TIGHT_SLACK_MINUTES && w.headwayMinutes >= EXPOSED_HEADWAY_MINUTES) {
        tightAndExposed++;
        exposed = true;
      }
    }
    if (exposed) exposedTrips++;

    // Did the ranking have a simpler option, and did it take it? The sort is
    // reproduced rather than imported so this measures the ordering a rider
    // sees, not an intention stated somewhere else.
    const alts = alternativesOf(best, from, to, departAt);
    const simpler = alts.filter((a) => a.transfers < best.transfers);
    if (simpler.length === 0) continue;
    comparable++;
    const scoredAlts = await Promise.all(
      simpler.map((a) => scoreJourney(a, segmentIndex, frequency, nameOf)),
    );
    const cost = (j: { durationMinutes: number; reliability: { expectedAddedMinutes: number } }): number =>
      j.durationMinutes + j.reliability.expectedAddedMinutes;
    const bestSimpler = scoredAlts.reduce((a, b) => (cost(a) <= cost(b) ? a : b));
    if (cost(scored) <= cost(bestSimpler)) {
      rankedMore++;
      const saved = Number((cost(bestSimpler) - cost(scored)).toFixed(1));
      minutesSaved.push(saved);
      if (saved < 1) boughtNothing++;
    }
  }

  slack.sort((a, b) => a - b);
  headways.sort((a, b) => a - b);
  minutesSaved.sort((a, b) => a - b);

  const blindShare = comparable === 0 ? 0 : rankedMore / comparable;
  const exposedShare = found === 0 ? 0 : exposedTrips / found;

  console.log(`\nTransfers as a cost — measured on the planner's own output`);
  console.log(`  seed 20260901 · ${DEPART_TIMES.length} departure times · service-weighted origins`);
  console.log(`  tight connection: <= ${TIGHT_SLACK_MINUTES} min slack · exposed: headway >= ${EXPOSED_HEADWAY_MINUTES} min\n`);

  console.log(`  trips planned:                       ${found}`);
  console.log(`  top result carries a transfer:       ${withTransfer} (${((100 * withTransfer) / found).toFixed(1)}%)`);
  console.log(`  connections in those trips:          ${connections_}\n`);

  console.log(`  scheduled slack at a connection:`);
  console.log(`    p10 ${quantile(slack, 0.1)} min · p50 ${quantile(slack, 0.5)} min · p90 ${quantile(slack, 0.9)} min`);
  console.log(`    zero-minute connections: ${zeroSlack} (${((100 * zeroSlack) / Math.max(1, connections_)).toFixed(1)}%)`);
  console.log(`  headway behind a connection:`);
  console.log(
    `    p10 ${quantile(headways, 0.1).toFixed(1)} min · p50 ${quantile(headways, 0.5).toFixed(1)} min` +
    ` · p90 ${quantile(headways, 0.9).toFixed(1)} min`,
  );
  console.log(`    tight AND exposed: ${tightAndExposed} connections, on ${exposedTrips} trips (${(100 * exposedShare).toFixed(1)}%)\n`);

  console.log(`  reported risk by transfer count — does the number fall as the trip gets more complex?`);
  console.log(`    transfers    n   median 1 in N   median coverage`);
  for (const t of [...byTransfers.keys()].sort((a, b) => a - b)) {
    const b = byTransfers.get(t)!;
    const risk = [...b.risk].sort((x, y) => x - y);
    const cov = [...b.coverage].sort((x, y) => x - y);
    const median = quantile(risk, 0.5);
    const oneIn = median > 0 ? `1 in ${Math.round(1 / median)}` : "unmeasured";
    console.log(
      `    ${String(t).padStart(9)} ${String(b.n).padStart(4)} ${oneIn.padStart(15)} ${quantile(cov, 0.5).toFixed(2).padStart(17)}`,
    );
  }

  console.log(`\n  where a simpler journey existed:      ${comparable} trips`);
  console.log(`    ranking preferred the transfer:    ${rankedMore} (${(100 * blindShare).toFixed(1)}%)`);
  if (minutesSaved.length > 0) {
    console.log(`    minutes it bought:                 p50 ${quantile(minutesSaved, 0.5)} · p90 ${quantile(minutesSaved, 0.9)}`);
    console.log(
      `    ...of which bought < 1 min:        ${boughtNothing}` +
      ` (${((100 * boughtNothing) / rankedMore).toFixed(1)}% — descriptive, no verdict attached)`,
    );
  }

  const blind = blindShare > RANKING_BLIND_ABOVE;
  const matters = exposedShare > EXPOSED_MATTERS_ABOVE;
  console.log(
    `\n  VERDICT: ranking prefers more transfers on ${(100 * blindShare).toFixed(1)}% of comparable trips` +
    ` (transfer-blind above ${(100 * RANKING_BLIND_ABOVE).toFixed(0)}%);` +
    ` ${(100 * exposedShare).toFixed(1)}% of trips carry a tight connection onto sparse service` +
    ` (worth acting on above ${(100 * EXPOSED_MATTERS_ABOVE).toFixed(0)}%).`,
  );
  if (blind && matters) {
    console.log(`  FAIL — a transfer costs a rider something the ranking does not price. PR-05 stands open.\n`);
  } else if (blind) {
    console.log(`  MIXED — the ranking is transfer-blind, but exposed connections are rare enough to leave alone.\n`);
  } else {
    console.log(`  PASS — the ranking already discriminates on transfers.\n`);
  }

  await disconnect();
  if (blind && matters) process.exitCode = 1;
}

await main();
