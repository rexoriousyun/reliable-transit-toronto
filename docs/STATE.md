# Project State

**Read this first.** A single anchor for where the project stands, so no finding depends
on anyone remembering a conversation. Everything below is reproducible from the repo.

**Last updated:** 2026-09-02. **Every milestone is built, and the design upgrade is in.**
The product is ready for rider testing, and that is now the only thing it is waiting on —
see `docs/ux/08-research.md`.

---

## What this is

A reliability-aware view of the TTC. Not "how fast is this route" but **"how likely is it
to actually work, and where does it break."**

The differentiated asset is the **segment layer**: reliability below the route level,
which no existing tool publishes. Reliability-aware TTC routing already exists
([Reroute](https://rerouteapp.ca/ttc), E-M01); segment-level reliability does not.

## Where everything lives

| Path | What |
|---|---|
| `CLAUDE.md` | Working conventions, verification habits, gotchas |
| `docs/STATE.md` | This file — the anchor |
| `docs/ux/README.md` | How the decision system works |
| `docs/ux/01-evidence.md` | Every factual claim, with source and date (`E-*`) |
| `docs/ux/02-problems.md` | Rider problems, ranked (`PR-*`) |
| `docs/ux/03-principles.md` | Design rules derived from evidence (`P-*`) |
| `docs/ux/04-personas.md` | Who we build for — `U-02`, `U-04`, `U-05`, **provisional** |
| `docs/ux/05-journeys.md` | Moments of need (`J-01`..`J-05`) |
| `docs/ux/06-decisions.md` | What we chose and what would reverse it (`D-*`) |
| `docs/ux/07-flows.md` | Screen-level user flows (`F-*`), built vs proposed |
| `docs/ux/08-research.md` | The protocol that closes `D-08`, verdicts pre-registered (`Q-*`) |
| `docs/architecture/SYSTEM.md` | Data flow, filtering funnel, scoring model, audit gates |
| `docs/architecture/DEPLOY.md` | How this ships: Fly, the image, and why the data is built first |
| `docs/design/00-concept.md` | Design concept, and the design work still needed |
| `docs/design/01-system.md` | The four design rules, encoding, tokens, validation |
| `docs/design/02-components.md` | What each component is for, and which decision put it there |
| `docs/product/PLAN.md` | v1 scope, milestones, engine contract |
| `docs/portfolio/CASE-STUDY.md` | Portfolio narrative — the full record |
| `docs/portfolio/case-study.html` | The same, as a designed page ([published](https://claude.ai/code/artifact/304700bb-f9a5-40e7-a42b-16a92e780dd0)) |
| `src/` | Engine: ingest, domain, api, audits |
| `web/` | Mobile-first app: plan a trip, explore a route |

**The chain:** `Evidence -> Problem -> Principle -> Decision -> Implementation`.
No decision without a principle; no principle without evidence; every decision names what
would reverse it.

## Status

| Milestone | State |
|---|---|
| M0 scaffold | done |
| M1 ingestion | done — 163,725 incidents + GTFS |
| M2 `Min Gap` audit *(gate)* | **passed** |
| M3 segment model | done — 142 subway, 18,840 surface |
| M4 reliability scoring | done |
| M5 surface geocoding | done — 76.6% (baseline 66.1%) |
| M6 segment map | done |
| M7 routing engine | **done** — Connection Scan, 1.2M connections, 6–12ms |
| M8 reliability ranking | **done** — disruption rate per journey, 53ms |
| M9 app shell | **done** — plan/explore, stop search, results, trip detail on a map |
| M10 departure advice | **done** — arrive-by search, both outcomes, buffer priced |
| Per-leg risk and route key | **done** — which part of the trip, and what the colours mean |
| Time-of-day conditioning | **done** — one toggle, defaulted to the rider's own window (D-27) |
| Benchmark | **done** — every trip ranked against typical ones of its length (D-28) |
| M11 day-of disruptions | **done** — detours, bypasses and closures qualify today's answer (D-29) |
| M12 step-free routing | **done** — the planner routes *around* blocked stations (D-30) |
| Route ranking + causes | **done** — costliest routes for riders, and why (D-31) |
| Vanishing service | **done** — the bus that never comes, separated from the one running late (D-32) |
| Trip conditions as tags | **done** — several can apply at once, each opens (D-33) |
| What one missed vehicle costs | **done** — headway under every wait, and minutes outside (D-34) |
| Identity and mobile metadata | **done** — named, mark, home-screen title, theme colour (D-35) |
| Responsiveness | **done** — gzip everywhere, 74 KB of dead payload dropped, warm before serving (D-36) |
| Deployable | **done** — one image serves app, API and tiles; Fly config; `docs/architecture/DEPLOY.md` (D-37) |
| Alternatives that differ | **done** — branch-and-ban, then keep the most route-diverse four (D-39) |
| Design upgrade, pass 1 | **done** — dark default, one confidence mark, the verdict card (D-42–D-46) |
| Design upgrade, pass 2 | **done** — usual trips, states, step rail, hour strip, desktop, walk-or-wait |
| Live service signal | **done** — which routes are moving now, route level only (D-47, E-D29) |
| Plan from an address | **done** — 525,470 address points; the walk at each end is part of the answer (D-48) |

## The numbers that matter

| | value | source |
|---|---|---|
| Station unreliability persistence | rho **0.78** | E-D01 |
| Segment **exposure** persistence | rho **0.68** | E-D10 |
| Segment **severity** persistence | rho **0.10** | E-D10 |
| Bus vs subway delay burden | **~17x** | E-D05 |
| Surface vs subway wait (p95) | **73 min vs 23** | E-D13 |
| Bus incidents with bunching signature | **83.8%** | E-D09 |
| Subway records that are zero-minute | **65%** | E-D04 |
| Delay attributed to terminals/yards | **20.7%** | E-D03 |
| Bus segments at high confidence | **3.1%** | E-D12 |
| Best predictor of the next 2 months | **3-month half-life decay** | E-D18 |
| Segments that shifted 2x between halves | **35.9%** | E-D18 |
| TTC riders who are equity-deserving | **66.6%** | E-L10 |
| Scarborough transit access score | **20.97** vs 102.8 affluent | E-L10 |
| Ice/snow incident average duration | **68.8 min** | E-D02 |
| Rider-waiting where the vehicle never came | **36.1%** | E-D23 |
| Median headway behind a weekday departure | **10.0 min** | E-D24 |
| Planned connections scheduled at zero slack | **10.2%** | E-D26 |
| Trips with a ≤2 min step onto ≥20 min service | **13.0%** | E-D26 |
| Trips with a materially safer option — downtown | **12.3%** | E-D27 |
| The same, citywide | **1.3%** (2.3% after D-39) | E-D27 |
| Journeys whose risk would display as "0%" | **74.4%** | E-D28 |
| First paint on slow 4G, gzipped | **2.2 s** (was 7.1 s) | E-D25 |
| `/plan` on the wire | **13.6 KB** (was 185 KB) | E-D25 |
| First `/plan` after a deploy | **102 ms** (was 12.3 s) | E-D25 |
| `/plan` end to end, warm | **84.7 ms** p50 (was 60.5 before D-39) | E-D27 |
| First paint on slow 4G, after the upgrade | **2,576 ms** — over the 2.2 s bar | E-D30 |
| Of that regression, the webfont | **64 ms** | E-D30 |
| Realtime trip ids matching the schedule | **1 of 2,301** | E-D29 |
| Address points ingested | **525,470** | E-D31 |
| Door-to-door vs ride-only on a worked trip | **43 min vs 37** | E-D31 |
| Container start to healthy | **3.1 s** (was 4 s + a rider's 12.3 s) | E-D25 |
| Runtime data in the image | **113 MB** (was 298 MB) | E-D25 |
| Night departures on service every 20 min or worse | **74.3%** (vs 14.2% at pm peak) | E-D24 |
| Worst route for vanishing service | **31 Greenwood, 74%** | E-D23 |
| Downtown vs Scarborough route density | **26 vs 17** routes per box | E-D14 |
| Worst surface route by rider-wait | **504 King**, 105,302 min | E-D14 |

## The three findings that reshaped the product

1. **Exposure persists; severity does not** (E-D10). How *often* a segment costs you time
   is predictable (rho 0.68). How *long* you wait once it happens is not (rho 0.10, with
   only 3% ties, so not a measurement artifact). Per-segment percentiles would be noise
   formatted as precision, so severity is pooled per mode and labelled. This **revised the
   engine contract written the same day** — see `D-11`.

2. **Toronto has no redundancy, so this is a forecast and not a router** (E-L12). The
   TTC's own CEO calls the system "binary" — when a line goes down there is one option.
   New York has parallel lines and express tracks, so a reliability tool there picks
   between options; Toronto usually has no second option, so the product must say whether
   the trip is viable and when to leave. See `D-13`.

3. **Delay data points at terminals and yards, not at rider risk** (E-D03). 20.7% of
   subway delay-minutes land on 12 of ~70 stations, because that is where the log entry is
   written. Shipping the obvious map would have been confidently wrong. See `D-06`, `D-12`.

## Personas and journeys

Three personas, split on the axis the research supports — **does the rider have an
alternative?** IDs are non-contiguous because U-01 was merged into U-02 and U-03 demoted to
a hypothesis; the gaps are deliberate, so existing citations stay valid.

| | rider | needs | journeys |
|---|---|---|---|
| **U-02** | captive — one route, no car | a **forecast** | J-01, J-02, J-03 |
| **U-05** | downtown — can walk | a **comparison** | J-05 |
| **U-04** | access-constrained — binary failure | a **constraint** | J-03 (named, unserved) |

| | journey | built |
|---|---|---|
| J-01 | pre-trip: when do I leave? | **yes** — M10 (D-24), extended by D-27, D-28, D-29, D-33, D-34 |
| J-02 | at the stop: is it coming? | **partly** — D-34 gives what a no-show costs; the countdown needs realtime |
| J-03 | mid-trip disruption | no — needs realtime |
| J-04 | exploratory: is this route always like this? | **yes (M6, D-31)** |
| J-05 | downtown: transit or walk? | **partly** — walk-or-wait is built and scoped to the core (F-03, D-40); it compares against the planned trip rather than being its own at-a-stop screen |

## What is open

**Eight questions, all of them for riders.** Each has a pre-registered verdict condition in
`docs/ux/08-research.md`, written before any session so the result cannot be argued into
whichever answer is convenient.

| # | Question | Blocks |
|---|---|---|
| **Q-A** | Does a mostly-unknown map build trust or read as broken? | the interface |
| Q-C | Does "2,795 min/mo" mean anything to a rider? | D-05, P-06 |
| Q-G | Does "runs every 27 min" read as a cost, or as a promise? | D-34, D-24 |
| Q-F | Does the two-outcome answer read as honest, or as hedging? | D-24, P-01 |
| Q-B | Is the segment or the corridor the rider's unit? | D-01 |
| Q-E | Do riders re-open the list after picking, or is the choice settled? | D-20 |
| Q-H | With duration equal, do riders prefer fewer transfers — or not care? | D-38 |
| Q-D | Is compass direction the right handle, or headsigns? | polish |

Plus two persona assumptions that have never been tested: that U-02 usually has no real
alternative, and that their tolerance for lateness is as asymmetric as assumed.

**Two proposals are scoped and waiting on the same sessions**, both measured rather than
argued (E-D27, E-D28):

- **A labelled comparison — "fastest" beside "most reliable" — belongs downtown only**
  (`D-40`). Citywide the two labels name the same journey on ~95% of trips; downtown a
  materially safer option exists on 12.3%. It lands in `F-03`, which is unbuilt.
- **The risk unit stays "1 in N" for now** (`D-41`). A percentage is ruled out on
  measurement — 74.4% of journeys would read "0%". The surviving candidate is the rider's own
  calendar, and `Q-C` now carries it as a second prompt.

One question is **not** for riders and is worth re-running when the archive grows: does
per-segment severity persist over a longer window (`D-11`)? It failed at rho 0.10 on 19
months.

**Known gaps, carried deliberately:**

- **GTFS-RT is consumed at route level only, and a countdown is not possible from it.**
  Both feeds are live and fetched, but they are a different identifier space from the
  schedule: 1 trip id in 2,301 matches, and the stop ids collide *coincidentally* — feed stop
  6857 returns Scarborough routes for a stop on Queen St West (`E-D29`). Route ids match 180
  of 181, so the app says which routes are moving and never when a bus arrives (`D-47`).
  J-02's countdown and J-03 stay blocked, now on a missing crosswalk rather than on a fetch.
- **Nobody has deployed it.** The image is built and verified locally — one container serves
  the app, the API and the tiles, healthy 3.1 s after start, 113 MB of data, 441 MB peak
  RSS. `fly.toml` targets Toronto and holds one machine warm. What has not happened is
  `fly deploy`, which needs an account. See `docs/architecture/DEPLOY.md`.
- **No shelter data.** The app says a wait is *outside* and claims nothing about cover,
  because Toronto's 100 heated shelter kits over seven years are not in a dataset we ingest.

> **Fixed 2026-08-29.** Arriving between roughly 03:30 and 06:00 used to return no journey:
> the hour was read as this service day rather than the one still running from yesterday, so
> the search covered a window with almost no service. Every hour of the clock now plans.
> An earlier version of this file blamed those hours on Blue Night not being ingested, which
> was wrong — **all 35 Blue Night routes are in the loaded weekday service**, and the claim
> came from reading a service window whose hours had been printed modulo 24.

## Running it

```bash
npm install && npx prisma db push && npx prisma generate
npm run ingest            # downloads TTC open data + GTFS, builds segments, attributes
npm run audit:gap         # M2 gate — is Min Gap trustworthy?
npm run audit:stability   # M4 — does segment reliability persist?
npm run audit:coverage    # M5 — surface geocoding rate
npm run audit:timeofday   # does pooling across the day misrepresent the risk?
npm run audit:headway     # is "runs every N min" a discriminating thing to say? (D-34)
npm run audit:transfers   # does a transfer cost anything in the ranking? (PR-05, D-38)
npm run benchmark         # what a typical trip looks like, for the comparison (D-28)
npm test                  # 171 tests
npm run dev               # API on :3000
cd web && npm install && npm run dev   # UI on :5173
node scripts/shot.mjs     # screenshot the app, including a downtown street zoom
node scripts/drive.mjs '{"steps":[…]}'   # drive the app and report the screen as text
npm run check:diagrams    # every mermaid block parses — GitHub fails one silently
```

All data is public Toronto Open Data + TTC GTFS. **No API keys.**
