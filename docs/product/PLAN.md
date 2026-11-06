# Product Plan — v1

**Status:** v1 scope complete, unvalidated · **Written:** 2026-08-28 ·
**Updated:** 2026-09-02 · **Supersedes:** nothing

Assembled from decisions already made in `docs/ux/06-decisions.md`. This document adds
no new product direction — it makes existing decisions legible as scope, sequence and
a definition of done.

---

## What v1 is

**A segment-level reliability layer for the TTC, plus the two journeys that need no
realtime feed.**

| | |
|---|---|
| **Core asset** | Inter-stop segment reliability scores (`D-01`) |
| **Primary metric** | Headway gap, not vehicle delay (`D-02`) |
| **Journeys served** | J-01 pre-trip departure advice, J-04 exploratory segment map (`D-03`) |
| **Network** | Engine developed on subway, **released covering buses** (`D-04`) |
| **Realtime** | Alerts (`D-29`, `D-30`) plus which routes are moving now (`D-47`). A stop countdown is not possible — the feed is a different id space (`E-D29`). Everything *ranked* is historical. |

### The one-sentence test
*"Show me which parts of my trip are actually unreliable, and when I should leave."*

If a feature does not serve that sentence, it is not in v1.

---

## Explicitly out of scope for v1

Recorded so we stop re-litigating them:

- **Live vehicle tracking / at-stop countdowns** (J-02) — needs realtime, higher
  correctness bar, and the subway has no feed (`E-D06`)
- **Mid-trip disruption handling** (J-03) — depends on realtime
- **Multi-agency routing** (GO, UP Express, YRT) — Reroute already does this well (`E-M01`)
- ~~**Full A-to-B trip planning**~~ — **built anyway, M7.** `D-14` reframed the product as a
  map-first trip planner two days after this line was written, and the segment layer became
  the thing routing hangs on rather than the deliverable. Kept struck through rather than
  deleted: the scope moved on a decision, not on drift
- **Accounts, saved trips, notifications** — no persistence story needed to prove the thesis
- ~~**Streetcars**~~ — **in scope and scored.** Surface geocoding reached 76.6% (E-D11),
  which solved streetcars at the same time as buses. 504 King and 501 Queen now top the
  route ranking (`D-31`), and E-D14 made them U-05's whole case

---

## The engine contract

The segment engine is done when it can answer this, for any segment, from historical data:

> **Revised 2026-08-28 by D-11.** This contract originally specified per-segment
> percentiles. Segment-level testing showed severity does not persist (rho = 0.10), so
> percentiles are pooled across the network and only exposure is segment-specific.

```
GET /segments/:id/reliability?dayOfWeek=Monday&hour=8

{
  "segment":    { "id": "1:N:DAVISVILLE->EGLINTON", "routeId": "1", "direction": "N", ... },
  "exposure":   { "gapMinutesPerMonth": 172.4, "incidentsPerMonth": 14.09 },
  "severity":   { "p50": 9, "p90": 17, "p95": 23, "basis": "pooled-network" },
  "sample":     { "incidents": 267, "window": {...}, "filters": [...] },
  "causes":     [ { "code": "MUIR", "description": "...", "share": 0.094 }, ... ],
  "confidence": "high" | "low" | "unknown"
}
```

Non-negotiable properties, each from a principle:

1. Percentiles, never a mean (`P-01`)
2. Headway gap as the metric (`P-02`)
3. `confidence: "unknown"` is a real, distinct state — never silently rendered as healthy (`P-03`)
4. Terminal and yard incidents excluded from through-rider scores (`P-04`, `D-06`)
5. Zero-minute records filtered, and the filter documented in the response (`P-08`, `E-D04`)
6. Every number traceable to window and sample size (`P-08`)

---

## Milestones

M0–M6 built the engine. M7 onward builds the app `D-14` describes — the milestones below
were rewritten 2026-08-28 because the old list still ended at "departure advice", which
predates `D-14` and describes a feature of a product that did not exist yet.

| # | Milestone | Done when | Unblocks |
|---|---|---|---|
| **M0** | Project scaffold — **DONE** | `npm run dev` starts API + web | — |
| **M1** | Data ingestion — **DONE** | Delay data + GTFS loaded from one command | M2 |
| **M2** | **`Min Gap` audit — DONE, PASSED** | Q-1 answered | everything |
| **M3** | Segment model — **DONE** | 18,982 segments, 99.6% drawn on streets | M4 |
| **M4** | Reliability scoring — **DONE** | Exposure per segment, severity pooled per mode | M5, M6 |
| **M5** | Surface geocoding — **DONE** | 76.6%, beating the 66.1% baseline | M6 |
| **M6** | Segment map — **DONE** | Any route explorable by segment, hour, day | M7 |
| **M6a** | Step-free filter — **DONE** | `D-07` honoured: blocked segments marked | M11 |
| **M7** | Routing engine — **DONE** | A→B itineraries from the schedule; 6–12ms warm | M8, M11 |
| **M8** | Reliability ranking — **DONE** | Journeys ranked and rated by disruption rate | M9 |
| **M9** | App shell — **DONE** | Search, origin/destination, results, trip detail | M10 |
| **M10** | Departure advice — **DONE** | Arrive-by planning; both outcomes, buffer priced | ship |
| **M11** | Day-of disruptions — **DONE** | Detours, bypasses and closures qualify today's answer | ship |
| **M12** | Step-free routing — **DONE** | Routes *around* blocked stations, completing `D-07` | ship |

Six more shipped after M12, none of them planned here — each came from a measurement or a
question rather than from this list. That is the decision system working, and it is why the
table stops rather than being extended with guesses:

| # | Shipped | Why it exists |
|---|---|---|
| — | Benchmark (`D-28`) | a figure with no reference class cannot be judged; two wrong reference classes were built first (E-D21) |
| — | Time-of-day conditioning (`D-27`) | risk varies by band and persists, rho 0.406 (E-D20) — and peak turned out *better* than pooled |
| — | Route ranking + causes (`D-31`) | J-04 had no entry point for a rider without a route in mind |
| — | Vanishing service (`D-32`) | 36.1% of rider-waiting is a vehicle that never comes (E-D23), and waiting does not fix it |
| — | Conditions as tags (`D-33`) | four stacked prose blocks pushed the answer off a phone screen |
| — | What a missed vehicle costs (`D-34`) | the wait on screen was the schedule's promise, with nothing qualifying it (E-D24) |

**M7 is the long pole and unblocks the most.** Without routing there is no trip, and without
a trip there is nowhere for departure advice, the walk comparison, or step-free rerouting to
live. It is also the point where the product stops being an explorer and becomes the app the
brief asked for.

### What M7 is not

Not a general-purpose journey planner competing with Google Maps on coverage. It plans TTC
trips well enough to hang reliability on — bounded search window, bounded transfers, TTC
only. Multi-agency comes later or never (`E-M01`: Reroute already does it).

## Definition of done for v1

- A rider can enter where they are and where they are going, and get itineraries **ranked by
  what actually happens** rather than by the timetable
- Departure advice is a confidence, never a point estimate
- Today's disruptions change today's answer
- A step-free rider gets routes that are usable, not routes with warnings attached
- Coverage gaps are visible as gaps

## Success criteria

| Criterion | Target | Why |
|---|---|---|
| Segment score stability | rho > 0.5 split-half at segment granularity | **MET: 0.681 on exposure.** Severity failed at 0.10, reshaping the contract (D-11) |
| Surface coverage | > 66% of delay-minutes geocoded | **MET: 76.6% raw, 80.6% addressable** (E-D11) |
| Honest uncertainty | 100% of low-sample segments marked, none rendered as healthy | `P-03` |
| Rider validation | 5+ riders confirm a segment we flagged matches their experience | **NOT MET — the only one outstanding.** `D-08`, `P-08`. Protocol written: `docs/ux/08-research.md` |
| Trip planning | A→B on the TTC returns plausible itineraries within 1s | **MET: `/plan` p50 84.7 ms, p90 124.2 ms** end to end, graph warmed at boot (`D-36`, `D-39`) |

---

## Where v1 actually stands

Every line of the definition of done above is met **except validation**, and validation was
never a building problem.

| | |
|---|---|
| **Built** | J-01 (pre-trip) and J-04 (exploratory) in full, plus the half of J-02 the timetable alone can answer (`D-34`) |
| **Not built, blocked on a crosswalk** | J-02's countdown and J-03. Both realtime feeds are fetched; their stop and trip ids are a different id space from the schedule (`E-D29`), so only the route-level signal is sound (`D-47`) |
| **Not built, blocked on nothing** | J-05, wait against walk — and, on the same screen, the labelled reliability comparison `D-40` scopes there. The headway is computed and a walking time is geometry; it is unbuilt because U-05 is not primary |
| **Blocked on a rider** | everything else. Eight questions, all pre-registered |

The honest summary: **the product has run out of things it can learn from its own data.**
Two audits reversed designs they were written to confirm, which is the system working — but
no further audit answers whether a mostly-hatched map reads as honest or as broken, and that
is the question the whole interface rests on.

## Sequencing note

The full UX exploration (service blueprint, information architecture, wireframes) is
**not a prerequisite for M0–M5**. Those milestones produce a data engine with an API and
no interface. UX exploration blocks **M6**, where pixels first appear.

Running them in parallel is fine and probably preferable — the engine informs what the
interface can honestly show, and `D-08` (rider interviews) can proceed alongside.

> **Updated after M6.** Building the map first turned out to be the right order: three of
> the four questions now blocking `D-08` (Q-A, Q-B, Q-C) could only be written once there
> was a real screen to react to. Interviews should now run against the built artefact
> rather than against descriptions of it.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `Min Gap` unreliable (Q-1) | Reverses `D-02`, core metric | M2 gate before any modelling |
| ~~Geocoding stalls at 66%~~ | — | **Resolved: 76.6% achieved (E-D11)** |
| Segment scores unstable | `D-01` fails, product thesis dies | Split-half test at segment level in M4 |
| Personas wrong (`D-08`) | M6/M7 build the wrong interface | Interviews in parallel, before M6 |
