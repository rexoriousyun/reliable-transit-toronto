import Fastify from "fastify";
import compress from "@fastify/compress";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { scoreSegment, scoreRoute, segmentByHour } from "../domain/score.js";
import { prisma } from "../db/client.js";
import { rankRoutes } from "../domain/route-ranking.js";
import { neverCame } from "../domain/vanishing.js";
import { liveRoutes } from "../domain/realtime.js";
import { recencyWeight, effectiveMonths, observationMonths } from "../domain/score.js";
import { registerTiles } from "./tiles.js";
import { registerPlanner, warmGraph } from "./planner.js";
import { stationAccessMap, endpointState, isUsable } from "../domain/accessibility.js";

/**
 * The browser calls `/api/plan`; the routes below are declared as `/plan`.
 *
 * In development Vite proxied `/api` to this server and stripped the prefix, so
 * the server never saw it. In production there is no proxy — one origin serves
 * the app, the API and the tiles, which is what `tiles.ts` has always assumed
 * when it builds absolute sprite URLs from the request origin.
 *
 * Stripping it here rather than re-declaring every route under a prefix keeps
 * one definition of each route, and `rewriteUrl` runs before routing, which an
 * `onRequest` hook does not. The dev proxy no longer rewrites either, so both
 * environments now take the same path through this function — the difference
 * between them was its own class of bug.
 */
const app = Fastify({
  logger: true,
  rewriteUrl: (req) => {
    const url = req.url ?? "/";
    return url === "/api" || url.startsWith("/api/") ? url.slice(4) || "/" : url;
  },
});

/**
 * Compress every response.
 *
 * Nothing was compressed at all, and the cost fell hardest on the rider this
 * product is for. Measured on the production bundle through a throttled
 * browser: **7.1 s to first paint on slow 4G, 20.9 s on 3G**, against 2.2 s and
 * 5.9 s once gzipped. A `/plan` response goes 185 KB -> 20 KB; the route
 * ranking 120 KB -> 12 KB; the map style 43 KB -> 3.8 KB.
 *
 * Two reasons this is not merely a speed fix:
 *
 * - `U-02` is standing at a stop, in winter, on whatever signal the shelter
 *   gets. Seven seconds of blank screen is the difference between an app they
 *   use and one they close.
 * - `PR-14` records that this product excludes part of the audience it claims
 *   to serve — 66.6% of TTC riders are equity-deserving, and lower-income
 *   riders pay per ride because they cannot front a monthly pass. Sending a
 *   quarter of a megabyte where twenty kilobytes would do spends *their* data.
 *
 * Brotli is not enabled. It compresses a little better and costs noticeably
 * more CPU per response on a shared vCPU, and the gain over gzip here is
 * single-digit percent on payloads already reduced tenfold.
 */
await app.register(compress, {
  global: true,
  encodings: ["gzip", "deflate"],
  // Below about a kilobyte the header overhead and the CPU are not repaid — a
  // stop-search response is 681 bytes.
  threshold: 1024,
  /**
   * Vector tiles have to be named explicitly.
   *
   * The plugin decides what to compress from `mime-db`'s `compressible` flag,
   * and `application/vnd.mapbox-vector-tile` carries no such flag — so tiles
   * were silently passing through uncompressed, which is easy to mistake for a
   * deliberate exemption.
   *
   * They are worth compressing, but far less than the JSON: a measured tile
   * goes 78.8 KB -> 57.4 KB, 27%, because protobuf is already compact. On a
   * map-first app tiles are still the dominant bandwidth cost, so 27% off the
   * largest number is the biggest absolute saving here — for about a
   * millisecond of zlib, once per tile, against a 24-hour client cache.
   *
   * The upstream host has almost certainly gzipped these already and `fetch`
   * decompressed them on the way in (`tiles.ts`). Re-doing that work is the
   * price of using `fetch`, which always decompresses; avoiding it would mean
   * dropping to a lower-level HTTP client for a millisecond.
   */
  customTypes: /^application\/vnd\.mapbox-vector-tile$/,
});

const query = z.object({
  dayOfWeek: z.string().optional(),
  hour: z.coerce.number().int().min(0).max(23).optional(),
  includeTerminalApproach: z.coerce.boolean().optional(),
  /** Step-free routing. A filter, never a scoring weight (P-05, D-07). */
  stepFree: z.coerce.boolean().optional(),
});

/**
 * Step-free access for every station, plus the live outages behind it.
 *
 * Baseline and outage stay separate in the response: one is permanent, the
 * other may clear within the hour, and a rider deciding whether to travel needs
 * to know which they are looking at.
 */
app.get("/accessibility", async () => {
  const { states, unmatchedOutages } = await stationAccessMap();
  const all = [...states.values()];
  return {
    counts: {
      accessible: all.filter((s) => s.state === "accessible").length,
      outage: all.filter((s) => s.state === "outage").length,
      notAccessible: all.filter((s) => s.state === "not-accessible").length,
      unknown: all.filter((s) => s.state === "unknown").length,
    },
    outages: all.filter((s) => s.state === "outage"),
    notAccessible: all.filter((s) => s.state === "not-accessible").map((s) => s.station),
    /** Stations the TTC reported an outage for that we could not match. */
    unmatchedOutages,
    note: "Absence of an alert is not evidence an elevator works; the feed reports known outages only.",
  };
});

registerTiles(app);
registerPlanner(app);

/**
 * The built frontend, served by the same process.
 *
 * `E-D25` measured first paint at 7.1 s on slow 4G and 20.9 s on 3G, and gzip
 * takes those to 2.2 s and 5.9 s — but only if something compresses the
 * bundle, and until now nothing served it at all outside Vite's dev server.
 * Serving it here puts it behind the same compression as everything else, on
 * one origin, with no CORS and no second thing to deploy.
 *
 * Skipped when `web/dist` is absent, so `npm run dev` still works without a
 * build and the API can run headless for the audits.
 */
const WEB_DIST = resolve(process.cwd(), "web/dist");
if (existsSync(WEB_DIST)) {
  await app.register(fastifyStatic, {
    root: WEB_DIST,
    // Vite fingerprints every asset, so the bundle can be cached for a year and
    // a deploy invalidates it by changing the filename. `index.html` is the one
    // file whose name never changes, so it must never be cached — otherwise a
    // rider keeps the old page and it keeps asking for assets that are gone.
    maxAge: "1y",
    immutable: true,
    setHeaders: (res, path) => {
      if (path.endsWith("index.html")) {
        res.header("cache-control", "no-cache");
      }
    },
  });

  // Anything that is not a file and not an API route is the app. There is no
  // client-side router today, but a reload on a deep link should not 404.
  app.setNotFoundHandler(async (req, reply) => {
    if (req.method !== "GET" || req.headers.accept?.includes("text/html") !== true) {
      return reply.code(404).send({ error: "Not Found" });
    }
    return reply.header("cache-control", "no-cache").sendFile("index.html");
  });
}

/**
 * Ready, not merely listening.
 *
 * The two expensive things this API does once — building the journey graph
 * (~12 s) and the route ranking (~1.1 s) — used to be built on the first
 * request that needed them, so a rider paid for them. `/health` now reports
 * `ok` only when both are done, so a platform health check holds traffic off
 * until the process can actually answer quickly.
 *
 * `warming` is reported rather than hidden: during a deploy it is the honest
 * state, and a 503 that says why is easier to read in a log than a slow 200.
 */
let ready = false;

app.get("/health", async (_req, reply) =>
  ready ? { ok: true } : reply.code(503).send({ ok: false, status: "warming" }));

/**
 * Routes that have enough attributed data to be worth opening.
 *
 * Only ~3% of surface segments reach high confidence, so listing all 233 routes
 * equally would send most riders to an empty map. Routes are ranked by how much
 * of them we can actually speak to (P-03, P-06).
 */
/**
 * Which routes cost riders the most time, and why.
 *
 * `PR-02`: unreliability is unevenly distributed and nobody publishes where.
 * The segment map answers that one route at a time; this answers it across the
 * network, which is where `J-04` starts — a rider suspects their route is bad
 * and has nothing to compare it against.
 *
 * The cause breakdown is the "wants why" stage of that same journey, specified
 * since the research and never built until now. The feed's own words are used:
 * "NO OPERATOR AVAILABLE" is a better sentence than any category of ours.
 */
/**
 * Held after the first build. The ranking is a property of the archive, which
 * changes on ingest and not on request, and computing it scans every attributed
 * incident — two thirds of a second that no rider should pay twice.
 */
let rankingCache: unknown = null;

/**
 * Built once, at boot rather than on the first rider to open explore mode.
 *
 * Measured: 1.09 s cold, ~3 ms once cached. That second is small next to the
 * graph build, and it lands on exactly the moment `J-04` is trying to earn
 * trust — the first screen a rider sees when they ask "is this route always
 * like this?".
 */
async function buildRanking(): Promise<unknown> {
  if (rankingCache !== null) return rankingCache;
  const [segments, routes, codes, latest] = await Promise.all([
    prisma.segment.findMany({ select: { id: true, routeId: true, mode: true } }),
    prisma.route.findMany({ select: { id: true, shortName: true, longName: true } }),
    prisma.delayCode.findMany({ select: { code: true, description: true } }),
    prisma.delayIncident.aggregate({ _max: { occurredAt: true } }),
  ]);
  const now = latest._max.occurredAt;
  if (now === null) return { modes: {} };

  const rows = await prisma.delayIncident.findMany({
    where: { segmentId: { not: null }, minDelay: { gt: 0 } },
    select: { segmentId: true, minGap: true, occurredAt: true, code: true },
  });

  const segById = new Map(segments.map((s) => [s.id, s]));
  const names = new Map(routes.map((r) => [r.id, r.longName || r.shortName]));
  const causes = new Map(codes.map((c) => [c.code, c.description]));
  const denominator = effectiveMonths(await observationMonths());

  interface Acc { gap: number; never: number; measured: Set<string>; cause: Map<string, number>; mode: string }
  const acc = new Map<string, Acc>();
  for (const r of rows) {
    const seg = segById.get(r.segmentId!);
    if (seg === undefined) continue;
    let a = acc.get(seg.routeId);
    if (a === undefined) { a = { gap: 0, never: 0, measured: new Set(), cause: new Map(), mode: seg.mode }; acc.set(seg.routeId, a); }
    const weighted = r.minGap * recencyWeight(r.occurredAt, now);
    a.gap += weighted;
    if (neverCame(r.code)) a.never += weighted;
    a.measured.add(r.segmentId!);
    a.cause.set(r.code, (a.cause.get(r.code) ?? 0) + weighted);
  }

  const segmentCount = new Map<string, number>();
  for (const s of segments) segmentCount.set(s.routeId, (segmentCount.get(s.routeId) ?? 0) + 1);

  const ranked = rankRoutes([...acc.entries()].map(([routeId, a]) => {
    const top = [...a.cause.entries()].sort((x, y) => y[1] - x[1]);
    return {
      routeId,
      mode: a.mode,
      name: names.get(routeId) ?? routeId,
      segmentCount: segmentCount.get(routeId) ?? 0,
      measuredSegments: a.measured.size,
      gapMinutesPerMonth: Math.round(a.gap / denominator),
      /**
       * Share of this route's waiting caused by a vehicle that never turned up
       * rather than one that ran late. A rider mitigates the two differently:
       * waiting works for one and not at all for the other.
       */
      neverCameShare: a.gap > 0 ? Number((a.never / a.gap).toFixed(3)) : null,
      leadingCause: top[0] === undefined ? null : (causes.get(top[0][0]) ?? top[0][0]),
      /** Every cause on this route, so "why" is one tap rather than a query. */
      causes: top.slice(0, 5).map(([code, gap]) => ({
        code,
        cause: causes.get(code) ?? code,
        minutesPerMonth: Math.round(gap / denominator),
      })),
    };
  }));

  rankingCache = { modes: Object.fromEntries(ranked) };
  return rankingCache;
}

app.get("/routes/ranking", async () => buildRanking());

app.get("/routes", async () => {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ routeId: string; direction: string; mode: string; segments: number; scored: number }>
  >(`
    SELECT s.routeId,
           s.direction,
           s.mode,
           COUNT(DISTINCT s.id)                                    AS segments,
           COUNT(DISTINCT CASE WHEN d.n >= 5 THEN s.id END)        AS scored
    FROM Segment s
    LEFT JOIN (
      SELECT segmentId, COUNT(*) AS n
      FROM DelayIncident
      WHERE minDelay > 0 AND segmentId IS NOT NULL
      GROUP BY segmentId
    ) d ON d.segmentId = s.id
    GROUP BY s.routeId, s.direction, s.mode
    HAVING scored > 0
    ORDER BY scored DESC
  `);

  const routes = await prisma.route.findMany({ select: { id: true, shortName: true, longName: true } });
  const names = new Map(routes.map((r) => [r.id, r.longName || r.shortName]));

  return {
    count: rows.length,
    routes: rows.map((r) => ({
      ...r,
      segments: Number(r.segments),
      scored: Number(r.scored),
      name: names.get(r.routeId) ?? r.routeId,
    })),
  };
});

app.get("/segments", async () => {
  const segments = await prisma.segment.findMany({
    orderBy: [{ routeId: "asc" }, { direction: "asc" }, { sequence: "asc" }],
  });
  return { count: segments.length, segments };
});

/**
 * The whole day on one stretch, for the hour strip.
 *
 * Separate from `/reliability` rather than folded into it: the sheet asks for
 * this only when a rider opens a segment, and every plan response would
 * otherwise carry 24 buckets nobody reads — the shape of waste `E-D25` found
 * in `path`.
 */
/**
 * Which routes are moving right now.
 *
 * Route-level, not stop-level, and that is a finding rather than a shortcut —
 * see `realtime.ts`. The feed's stop and trip ids are a different identifier
 * space from the static GTFS, so a stop board built on the obvious join is
 * confidently wrong at more than half of all stops. Route ids match 180 of 181.
 *
 * A route **absent** from the response is unknown, never zero: the feed carries
 * surface routes only and a route with nothing running does not appear at all.
 */
app.get("/routes/live", async (_req, reply) => {
  try {
    const live = await liveRoutes();
    return {
      vehicles: Object.fromEntries(live.vehicles),
      ageSeconds: live.ageSeconds,
      stale: live.stale,
    };
  } catch {
    // A third-party feed goes down. Saying so is the answer; an empty map
    // would read as "nothing is running anywhere" (P-03).
    return reply.code(503).send({ error: "realtime feed unavailable" });
  }
});

/**
 * How old the delay history is, and where it came from.
 *
 * Every figure on screen is drawn from this window, so a rider (and the open
 * data licence) is owed both the dates and the source. The end is the earliest
 * of the three modes' last records: the date by which all of them are covered.
 */
app.get("/about", async () => {
  const runs = await prisma.ingestRun.findMany({
    where: { source: { contains: "delay-data/" }, finishedAt: { not: null } },
    orderBy: { id: "desc" },
  });
  const latest = new Map<string, (typeof runs)[number]>();
  for (const r of runs) {
    const mode = r.source.split("/")[0]!;
    if (!latest.has(mode)) latest.set(mode, r);
  }
  const picked = [...latest.values()];
  const starts = picked.flatMap((r) => (r.windowStart ? [r.windowStart.getTime()] : []));
  const ends = picked.flatMap((r) => (r.windowEnd ? [r.windowEnd.getTime()] : []));
  const refreshed = picked
    .map((r) => r.notes?.match(/last_refreshed=(\d{4}-\d{2}-\d{2})/)?.[1])
    .filter((d): d is string => d !== undefined)
    .sort();
  return {
    delays: {
      // Stored as Toronto wall-clock in UTC fields (see delays.ts), so the
      // ISO date is already the local date.
      from: starts.length ? new Date(Math.min(...starts)).toISOString().slice(0, 10) : null,
      to: ends.length ? new Date(Math.min(...ends)).toISOString().slice(0, 10) : null,
      publishedOn: refreshed.at(-1) ?? null,
      source: "TTC delay data, Toronto Open Data",
    },
  };
});

app.get("/segments/:id/hours", async (req, reply) => {
  const parsed = query.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  const { id } = req.params as { id: string };
  const hours = await segmentByHour(decodeURIComponent(id), parsed.data.dayOfWeek);
  if (hours === null) return reply.code(404).send({ error: "unknown segment" });
  return { hours };
});

app.get("/segments/:id/reliability", async (req, reply) => {
  const { id } = req.params as { id: string };
  const parsed = query.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  const result = await scoreSegment(decodeURIComponent(id), parsed.data);
  if (result === null) return reply.code(404).send({ error: "unknown segment" });
  return result;
});

app.get("/routes/:routeId/:direction/reliability", async (req, reply) => {
  const { routeId, direction } = req.params as { routeId: string; direction: string };
  const parsed = query.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  const segments = await scoreRoute(routeId, direction.toUpperCase(), parsed.data);
  if (segments.length === 0) return reply.code(404).send({ error: "unknown route or direction" });

  // Coverage is surfaced alongside the data, never left for the client to infer.
  // A segment we know nothing about must not read as a healthy one (P-03).
  const unknown = segments.filter((s) => s.confidence === "unknown").length;
  return {
    routeId,
    direction: direction.toUpperCase(),
    coverage: {
      segments: segments.length,
      scored: segments.length - unknown,
      unknown,
    },
    segments,
  };
});

/**
 * Route geometry with reliability, as GeoJSON.
 *
 * Segments carry their sliced shape so they draw on real streets. A segment with
 * no geometry falls back to a straight line client-side and says so, rather than
 * being dropped — a missing stretch of a route reads as "no problem here", the
 * failure P-03 exists to prevent.
 */
app.get("/routes/:routeId/:direction/map", async (req, reply) => {
  const { routeId, direction } = req.params as { routeId: string; direction: string };
  const parsed = query.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  const dir = direction.toUpperCase();
  const [scored, geo] = await Promise.all([
    scoreRoute(routeId, dir, parsed.data),
    prisma.segment.findMany({
      where: { routeId, direction: dir },
      select: {
        id: true, geometry: true, sequence: true,
        fromLat: true, fromLon: true, toLat: true, toLon: true,
      },
      orderBy: { sequence: "asc" },
    }),
  ]);
  if (geo.length === 0) return reply.code(404).send({ error: "unknown route or direction" });

  const byId = new Map(scored.map((s) => [s.segment.id, s]));

  // Accessibility is resolved once per request and applied as a filter, not
  // folded into any score (P-05).
  const stepFree = parsed.data.stepFree ?? false;
  const { states } = stepFree
    ? await stationAccessMap()
    : { states: new Map<string, never>() as never };

  const segmentsById = new Map(
    (await prisma.segment.findMany({
      where: { routeId, direction: dir },
      select: { id: true, fromStation: true, toStation: true },
    })).map((x) => [x.id, x]),
  );

  const features = geo.flatMap((g) => {
    const s = byId.get(g.id);
    if (s === undefined) return [];

    const drawn = g.geometry !== null;
    const coordinates: Array<[number, number]> = drawn
      ? (JSON.parse(g.geometry!) as Array<[number, number]>)
      : g.fromLon !== null && g.fromLat !== null && g.toLon !== null && g.toLat !== null
        ? [
            [g.fromLon, g.fromLat],
            [g.toLon, g.toLat],
          ]
        : [];
    if (coordinates.length < 2) return [];

    // A segment is blocked when either endpoint is a station a step-free rider
    // cannot use. "unknown" counts as blocked: absence of an alert is not
    // evidence an elevator works, and U-04 abandons us the first time we route
    // them somewhere we could not verify (P-03).
    let blockedBy: { station: string; state: string; note?: string } | null = null;
    if (stepFree) {
      const names = segmentsById.get(g.id);
      for (const name of [names?.fromStation ?? "", names?.toStation ?? ""]) {
        const st = endpointState(name, states as never);
        if (st !== null && !isUsable(st.state)) {
          blockedBy = st.note === undefined
            ? { station: st.station, state: st.state }
            : { station: st.station, state: st.state, note: st.note };
          break;
        }
      }
    }

    return [
      {
        type: "Feature" as const,
        id: g.sequence,
        geometry: { type: "LineString" as const, coordinates },
        properties: {
          segmentId: s.segment.id,
          /** Null unless step-free routing is on and an endpoint blocks it. */
          blockedBy,
          from: s.segment.fromStation,
          to: s.segment.toStation,
          confidence: s.confidence,
          gapMinutesPerMonth: s.exposure?.gapMinutesPerMonth ?? null,
          incidentsPerMonth: s.exposure?.incidentsPerMonth ?? null,
          incidents: s.sample.incidents,
          isTerminalApproach: s.segment.isTerminalApproach,
          /** False means this line is a straight approximation, not the real path. */
          drawnOnStreets: drawn,
        },
      },
    ];
  });

  const lons = features.flatMap((f) => f.geometry.coordinates.map((c) => c[0]));
  const lats = features.flatMap((f) => f.geometry.coordinates.map((c) => c[1]));

  return {
    type: "FeatureCollection",
    bbox: lons.length > 0
      ? [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
      : null,
    coverage: {
      segments: features.length,
      scored: features.filter((f) => f.properties.confidence !== "unknown").length,
      approximated: features.filter((f) => !f.properties.drawnOnStreets).length,
    },
    features,
  };
});

const port = Number(process.env["PORT"] ?? 3000);

/**
 * Listen first, then warm.
 *
 * The other order would leave the port closed for twelve seconds, which most
 * platforms read as a failed deploy and retry. Listening immediately and
 * failing the health check is the state they are built to wait through.
 */
app.listen({ port, host: "0.0.0.0" })
  .then(async () => {
    const t = Date.now();
    await Promise.all([warmGraph(), buildRanking()]);
    ready = true;
    app.log.info({ ms: Date.now() - t }, "warm — accepting traffic");
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
