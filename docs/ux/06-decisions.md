# Decision Log

Every decision cites the principles behind it and states what would reverse it.
Superseded decisions are marked, never deleted.

---

## D-01 — The segment reliability layer is the core asset `ACCEPTED`
**Cites:** P-02, P-04 · **Problems:** PR-02 · **Evidence:** E-M01, E-M02, E-D01

Build inter-stop **segment**-level reliability as the foundational data product. Routing
sits on top of it later.

*Why:* reliability-aware TTC routing already exists (Reroute) and does it competently.
Nobody exposes reliability below the route level. rho = 0.78 says segment scores are
stable enough to be meaningful. A router without the segment layer is a worse version of
a product that already ships.

**Reversed if:** segment-level scores prove unstable once terminal/yard correction is
applied (rho drops below ~0.5 at segment granularity), or a competitor ships the layer
first and does it well.

## D-02 — Headway gap is the primary metric `ACCEPTED`
**Cites:** P-02, P-01 · **Problems:** PR-01, PR-08 · **Evidence:** E-D09, E-L06

`Min Gap` is the headline metric throughout. `Min Delay` is diagnostic only.

*Why:* the gap is what a rider experiences. Vehicle lateness understates bus pain by ~58%,
and 83.8% of bus incidents carry the bunching signature. This is public data nobody is
using correctly, and it directly answers the documented critique that official metrics
hide lived experience.

**Reversed if:** `Min Gap` turns out to be unreliably recorded.

> **Confirmed 2026-08-28 (M2 audit, `npm run audit:gap`).** Among incidents with a real
> delay: coherence (gap >= delay) 99.1% bus / 98.6% streetcar / 95.2% subway;
> completeness (gap > 0) 99.6% / 99.5% / 95.3%; zero absurd values; 57 mode-months
> checked with none below the stability floor. Pre-registered thresholds were 95%
> coherence and completeness. **Q-1 closed, D-02 holds.**

## D-03 — v1 serves J-01 and J-04 only `ACCEPTED`
**Cites:** P-06, P-03 · **Journeys:** J-01, J-04

Ship pre-trip departure advice and the exploratory segment map. Defer J-02 (at-stop) and
J-03 (mid-trip).

*Why:* both need **no realtime feed**, so they dodge the subway realtime gap (E-D06)
entirely. J-04 is where our differentiation is visible and where trust gets built; J-01 is
where value is delivered. J-02 and J-03 are higher-pain but depend on realtime
infrastructure and a much higher correctness bar.

**Reversed if:** user validation shows the at-stop moment (J-02) is the only one people
will actually open an app for.

## D-04 — Build the engine on subway, but target buses as the product `ACCEPTED`
**Cites:** P-02, P-03 · **Problems:** PR-02, PR-05 · **Evidence:** E-D05, E-D07, E-L08

Develop the segment model against subway data first — clean station names, fixed topology,
trivially derived segments. **But buses are the product**, and we do not ship a
subway-only release.

*Why:* buses carry ~17x the subway's delay burden and the 2h+ commute tail is suburban and
bus-dependent. The subway is a convenient *development substrate*, not the market.

> **Revises an earlier recommendation.** Before the data work, a "subway-only vertical
> slice" was proposed as the first shippable release. E-D05 and E-L08 invalidated that:
> it would have been a demo of the least painful part of the network. The engine still
> starts on subway; the release does not.

**Reversed if:** surface geocoding cannot be pushed meaningfully past 66% (E-D07), making
bus segments too sparse to score honestly.

## D-05 — Verdict first, distribution one level down `ACCEPTED`
**Cites:** P-01, P-06, P-09 · **Personas:** U-01, U-03, U-05

Primary view gives a single actionable answer. The distribution, confidence and history
live one interaction beneath it.

*Why:* resolves the standing tension between P-01 and P-06. U-03 will not study a chart;
U-01 will not trust a bare number. Layering serves both without averaging them into
something that serves neither.

> **Sharpened by P-09.** The layering defers the *method*, not the *uncertainty*. A verdict
> may hide its sample size; it may never hide that it is low-confidence. The current detail
> view puts methodology in front of the rider before they have asked — that is a P-09
> violation and is being corrected.

**Reversed if:** testing shows U-01 does not trust a verdict whose method is hidden, even
one tap away. Note this is Q-C in D-08 and is genuinely open.

## D-06 — Terminal and yard incidents are modelled separately `ACCEPTED`
**Cites:** P-04 · **Problems:** PR-09 · **Evidence:** E-D03

Incidents logged at terminals and yards are excluded from through-rider segment risk and
modelled as their own class.

*Why:* 20.7% of subway delay-minutes are an artifact of where the log entry gets written.
Including them produces a map that is confidently wrong, which under PR-08 is worse than
having no map.

**Reversed if:** analysis shows terminal incidents do propagate to through-riders in a
measurable way — in which case model the propagation rather than simply re-including them.

## D-07 — Accessibility filters before ranking `ACCEPTED · IMPLEMENTED (M12)`
**Cites:** P-05 · **Personas:** U-04 · **Evidence:** E-L09

Accessibility constraints reduce the candidate route set before any reliability ranking.
Never a weight, never a post-filter.

*Why:* the failure mode is binary and can strand a rider mid-journey. A blended score
implies a 95%-accessible route is 95% as good; for U-04 it is unusable.

> **Implemented 2026-08-28.** Baseline from GTFS `wheelchair_boarding`, live outages parsed
> from the GTFS-RT alerts feed (`E-D17`). A `stepFree` filter marks every segment whose
> endpoint station a step-free rider cannot use; blocked stretches render struck out rather
> than recoloured, because a blocked segment is *unavailable*, not "more unreliable", and
> putting it on the reliability scale would say the wrong thing. The constraint leads the
> detail sheet, above the number.
>
> **`unknown` counts as blocked.** Absence of an alert is not evidence an elevator works,
> and U-04 abandons us the first time we route them somewhere we could not verify.

**Reversed if:** never, while U-04 is a target user. Dropping this means dropping U-04 —
which would itself be a decision requiring an entry here.

## D-08 — Validate personas with real riders `OPEN`
**Cites:** P-08 · **Personas:** all

Personas are derived from literature and delay data, not interviews. Validate before
committing to the v1 information architecture.

**Building M6 changed what this needs to ask.** The original framing was "are these
personas real?" Four questions now block the interface, and three of them could not have
been written before there was something on screen.

### Q-A — Does an honest, mostly-empty map build trust or destroy it? *(highest priority)*
**From:** E-D12 · **Threatens:** P-03, D-05

**86% of bus segments are unknown.** P-03 says absence of data must never read as good
news, so the map renders them hatched — and a real bus route shows as alternating known
and unknown stretches. Two readings, opposite implications:

- The honesty reads as credibility, and directly answers the distrust in PR-08.
- The sparsity reads as a broken product, and the rider leaves before the honesty lands.

We cannot reason our way to the answer. **Show riders the actual Morningside screen and
watch what they do.** If it reads as broken, either the granularity changes (Q-B) or P-03
needs a gentler expression — but P-03 itself is not negotiable.

### Q-B — What is the unit riders actually reason about?
**From:** E-D12 · **Threatens:** D-01

The map currently shows `Morningside Ave at Halfway Ave -> Morningside Ave at Sewells Rd`
— roughly 200 metres, with the road name repeated on both ends. Nobody thinks about their
commute that way, and stop-to-stop granularity is what makes the data look sparse: pooling
the same incidents into corridors (Finch to Sheppard, say) would raise confidence and read
more like how riders describe trips.

But a corridor is not a segment, and D-01 stakes the product on the segment being the
unit. **Ask riders to describe where their trip goes wrong, unprompted, and note the unit
they reach for.** If it is consistently corridors, D-01 needs revising — the stable
signal is real either way, only its resolution changes.

### Q-C — Does "31 min/mo of wait caused" mean anything to a rider?
**From:** D-11 · **Threatens:** D-05, P-06

Exposure is the metric that survived the persistence test, so it is what the product can
honestly rank on. But gap-minutes per month is an analyst's unit. A rider asks "how often
does this go wrong, and how bad is it" — and our honest answer is split awkwardly across
two numbers with different bases: exposure is segment-specific, severity is pooled.

**Do not lead the witness.** Show the segment detail and ask what they take from it. If
the unit does not land, the underlying model still holds — only the presentation moves.

### Q-D — Is compass direction the right handle?
**From:** M6 build

The UI offers N/S/E/W because that is what the delay data records. Riders say "towards
Finch" or "going downtown". GTFS carries trip headsigns, so this is fixable — but only
worth fixing if it is actually a barrier.

### Q-G — Does "runs every 27 min" read as a cost, or as a promise?
**From:** D-34 · **Threatens:** D-34, D-24

The number is on screen to say what a vehicle failing to arrive costs. It could just as
easily be read as "one will be along in 27 minutes", which is the confident-single-ETA
failure `D-24` was rewritten to avoid — arriving by the same door, wearing a schedule fact
rather than a forecast.

**Ask a rider what they would do next**, having read it, and note whether the action is
"wait" or "have a second plan". Do not ask what the number means.

### Q-E — Do riders re-open the list after picking, or is the choice settled?
**From:** D-20 · **Threatens:** D-20

The sheet peeks so the map keeps the screen. If riders keep pulling the list back up, the
peek is hiding something they needed in order to compare.

**Observe, do not ask.** Whether the list is re-opened after a choice.

### Q-F — Does the two-outcome answer read as honest, or as hedging?
**From:** D-24, P-01 · **Threatens:** D-24, P-01

The departure answer states a typical time and what it costs when the trip goes wrong, and
deliberately stops short of recommending a buffer — because a threshold there produced
absurd advice and expected value fails the other way.

A rider who asks "so what time should I leave?" has not been given an answer. A rider who
picks a time and stops has.

### Still open from the original framing
- **U-02's core assumption is untested:** that rerouting is often not a real option in the
  suburbs. It drives the whole "permission to stop refreshing" design in J-02.
- **U-01's asymmetric tolerance is untested:** that a missed pickup costs far more than a
  wasted ten minutes.

**Priority:** Q-A first, and with the real screen in hand rather than a description of it.
Everything in `04-personas.md` stays provisional until this closes.

> **The protocol is written and pre-registered: `docs/ux/08-research.md`.** Six to eight
> sessions, at least four of them U-02, with the verdict conditions for every question above
> fixed before the first rider is watched — the same discipline the audits use. One item
> blocks it, and it is not a design item: the app runs on `localhost` and a rider needs it on
> their own phone.

## D-09 — Stack: Fastify + Prisma/SQLite + React `ACCEPTED`
**Cites:** — (engineering, not UX)

TypeScript throughout. SQLite via Prisma for zero-setup development, migrating to
Postgres when the segment tables demand it. React + Vite, mobile-first.

*Why:* the whole product is consumed on a phone at a bus stop. SQLite keeps local
development frictionless; Prisma makes the Postgres migration mechanical.

**Reversed if:** segment aggregation over multi-year history outgrows SQLite sooner than
expected — likely, and the reason Prisma was chosen over raw SQL.

## D-10 — Incidents attribute to the arriving segment `ACCEPTED`
**Cites:** P-04 · **Problems:** PR-09 · **Evidence:** E-D03

The TTC logs an incident against a single station. It is attributed to the segment
*arriving* at that station in that direction — the approach a through-rider is on when
the delay bites. Records we cannot place are left unattributed rather than guessed at.

*Why:* riders experience delay across a stretch of track, not at a point. Leaving a
record unattributed shows up as missing coverage, which is visible; mis-attributing it is
invisible and wrong (P-03).

Attribution reaches **81.4% of delayed subway incidents**. The remainder is mostly
structural: terminal departures have no approach segment, and those are the turnaround
artifacts D-06 excludes anyway.

**Reversed if:** analysis shows riders attribute delay to where they boarded rather than
where they were stopped.

## D-11 — Score exposure per segment; pool severity across the network `ACCEPTED`
**Cites:** P-01, P-03, P-08 · **Evidence:** E-D10

Segment scores publish **exposure** (gap-minutes and incidents per month). The **severity**
distribution (p50/p90/p95) is computed across the whole network and labelled
`basis: "pooled-network"`, not per segment.

*Why:* reliability has two dimensions and only one of them persists. Split-half testing at
segment level gives rho = 0.68 for exposure but **rho = 0.10 for mean wait, with only 3%
ties** — so severity instability is genuine, not an artifact of a compressed scale. How
*often* a segment costs you time is a property of place; how *long* you wait once it
happens is roughly the same everywhere.

A per-segment p95 would therefore be noise formatted as precision — exactly what P-08
forbids.

> **Revises the engine contract** written in `docs/product/PLAN.md` earlier the same day,
> which specified per-segment percentiles as the headline output. The contract was written
> before the segment-level stability test existed. This is the decision system working as
> intended: the measurement invalidated the design, and the design moved.

**Reversed if:** a larger window, or normalising by service volume, makes per-segment
severity persist. Worth re-testing when the archive extends past 2024.

## D-12 — Garages and loops are excluded, and coverage is reported two ways `ACCEPTED`
**Cites:** P-03, P-04, P-08 · **Evidence:** E-D11 · **Extends:** D-06

Surface locations are classified before geocoding. Garages and divisions are non-revenue
and excluded outright; loops are turnarounds and flagged. Coverage is published as both a
**raw** rate (share of all surface delay placed) and an **addressable** rate (share of
rider-facing delay placed).

*Why:* garages are the surface equivalent of subway yards, and loops of subway terminals —
the same attribution artifact E-D03 identified, wearing different names. Folding them into
either "covered" or "failed" misleads in opposite directions. Two rates with the exclusion
declared is the only honest presentation.

**Reversed if:** riders turn out to experience meaningful waiting at loops, which would
make loops ordinary segments rather than turnarounds.

## D-13 — Build a forecast, not a router `SUPERSEDED by D-14`
**Cites:** P-06, P-07, P-01 · **Problems:** PR-01, PR-04 · **Evidence:** E-L12, E-L13

The product's primary job is to tell a rider **whether their trip is viable, when to
leave, and when to give up** — not to choose between alternatives. Routing is a later,
narrower feature, most useful in the GO corridors where alternatives actually exist.

*Why:* Toronto has almost no network redundancy. The TTC's own CEO calls the system
"binary": when a line goes down there is one option, shuttle buses, and sometimes not even
those. New York has express and local tracks, parallel lines and 24-hour service, so a
reliability tool there answers *"which of my options is best?"*. Asking that question in
Toronto usually has no answer.

This is the sharpest way the two cities differ, and it changes what the product *is*.
A reliability-aware router is a New York product. Toronto needs a reliability-aware
forecast — which is also, conveniently, what our data can actually support: exposure
persists, severity does not (E-D10), and a forecast tolerates that asymmetry where a
router does not.

> **Reframes the original brief**, which asked for a route map showing the fastest and most
> reliable way from A to B. The A-to-B framing imports an assumption from cities with
> redundancy. The underlying goal — expose which lanes are unreliable — is unchanged and is
> better served by a forecast.

> **Downtown is the exception.** The core has 321 stops across 26 routes in the
> King/Queen/Dundas box against 131 across 17 in an equivalent Scarborough box, plus
> walking and bike share. For U-05, "which option" is a real question and comparison is
> worth building. Treat it as a downtown feature, not a citywide one — building it
> citywide would import the New York assumption through the back door.

**Reversed if:** the Ontario Line opens and gives downtown genuine parallel capacity, or GO
coverage expands enough that most riders have a real second option.

> **Superseded 2026-08-28 by D-14, on re-reading the brief.** The redundancy evidence
> (E-L12) stands and still shapes *how* routing should behave. What was wrong was the
> conclusion drawn from it: "Toronto has few alternatives" was read as "do not build a
> router", when the brief had twice asked for A-to-B. Low redundancy is an argument about
> what a router should *say*, not a reason to withhold one. Recorded rather than rewritten,
> because the reasoning error is worth keeping visible.

## D-14 — A map-first trip planner, with reliability as the differentiator `ACCEPTED`
**Cites:** P-01, P-06, P-09 · **Problems:** PR-01, PR-02, PR-03, PR-04 · **Evidence:** E-L12, E-D15
**Supersedes:** D-13

The product is **a transit app you pull out to get from A to B with fewer surprises** —
map-first, in the shape people already know from Google Maps. Reliability is not the
product; it is the layer underneath that makes the answers better than everyone else's.

Three things it must do that mainstream planners do not:

1. **Route on reliability, not just schedule.** Rank itineraries by what actually happens,
   using the segment exposure model. Mainstream planners route on the timetable (E-L02).
2. **Forecast rather than promise.** Departure advice with a confidence, not a single ETA
   (P-01). The forecast is a *feature the app depends on*, not the app.
3. **Absorb today.** Detours, bypasses, elevator outages, planned closures and shuttles,
   and event crowding change the answer on the day, and the feed already carries most of it
   (E-D15).

*Why this framing and not the earlier one:* "fewer surprises" is the promise, and a
surprise is only avoidable if the app is in your hand at the moment you choose a route. A
forecast screen nobody opens prevents nothing. The map is not decoration — it is the
retrieval mechanism.

**What low redundancy still changes.** E-L12 is not discarded. Where there is no real
alternative, the honest output is not a ranked list of three similar itineraries; it is one
route plus *when to leave* and *when to give up*. Where there is choice — downtown,
GO corridors — comparison is genuine. **The router adapts its answer to how much choice
actually exists**, rather than pretending every trip is a menu.

**Reversed if:** riders turn out to open the app only at the stop, in which case the
at-stop view (J-02) becomes the product and routing is secondary.


> **On the `Source` field, which appears on the next four decisions.** Most decisions here
> are derived from evidence, and rule 1 says one without a chain is a preference. D-15 to
> D-18 are the exception: they are product direction — set, not derived — and the field says
> so rather than dressing them up with a citation after the fact. They still earn their place
> below by resolving questions the research had already raised.

## D-15 — Mobile first `ACCEPTED`
**Cites:** P-06 · **Personas:** U-02, U-05 · **Source:** product direction, 2026-08-28

The phone is the target, not a breakpoint. Controls float over the map rather than spending
a header; the sheet sits in the thumb zone; every value must be legible one-handed, outdoors,
in daylight.

*Why:* U-02 is standing at a stop in winter and U-05 is deciding whether to walk. Neither is
at a desk. Contrast is therefore a gate rather than a preference.

**Reversed if:** usage shows the exploratory journey (J-04) is overwhelmingly desktop, which
would argue for a second, denser layout rather than for abandoning this one.

## D-16 — Monotone for most; colour reserved for key information `ACCEPTED`
**Cites:** P-03, P-06 · **Evidence:** E-D14 · **Source:** product direction, 2026-08-28

The basemap is desaturated server-side. Greyscale is map structure and is never borrowed to
encode data. Colour is spent only where it carries meaning: the reliability scale, and the
transit stops a transit map cannot do without.

*Why:* a vendor basemap paints roads orange and parks green, which competes with the one
encoding that matters. Spending colour on everything marks nothing.

**Reversed if:** riders cannot locate route data against the desaturated ground, or a second
encoded dimension becomes essential and cannot be carried by weight, pattern or position.

## D-17 — Start simple `ACCEPTED`
**Cites:** P-01, P-06 · **Evidence:** E-D10 · **Source:** product direction, 2026-08-28

One continuous scale plus one exception (unknown), not five discrete bands. Complexity in the
data is not a licence for complexity on screen.

*Why:* it was also forced by measurement — four states could not clear all-pairs colour
separation, so the simpler encoding is the accessible one as well as the calmer one.

**Reversed if:** riders demonstrably need finer gradation than a continuous ramp provides,
which Q-C would surface.

## D-18 — Look trustworthy; nothing casual or decorative `ACCEPTED`
**Cites:** P-08, P-09 · **Problems:** PR-08 · **Source:** product direction, 2026-08-28

Tabular figures, one step of emphasis, a single elevation, modest radii, no gradients or
glows used as ornament. The product should read as infrastructure rather than as a brand.

*Why:* riders already distrust transit numbers because official metrics "hide more than they
reveal" (E-L06). A playful interface spends credibility the product has not earned yet.

**Reversed if:** never, while rebuilding trust is the product's central problem. Dropping this
means dropping PR-08, which would itself require an entry here.

## D-19 — Weight evidence by recency; decay, don't truncate `ACCEPTED`
**Cites:** P-08, P-01 · **Evidence:** E-D18 · **Revises:** D-11

Exposure is computed from **recency-weighted** incidents with a **three-month half-life**,
normalised by the integral of the decay curve so the published figure stays an honest
per-month rate. Confidence is judged on the weighted sample, not a raw count.

*Why:* the network is not stationary. 35.9% of segments changed by 2x or more between the
archive's halves, and seventeen months of history predicts the near future *worse* than six
(E-D18). Decay beat every flat window in a holdout test.

**Decay rather than truncation.** A hard cutoff throws away the only evidence thin segments
have; decay keeps it and discounts it. That matters when 86% of bus segments are already
short of data.

**Recency is measured from the data's edge, not the wall clock.** The delay feed refreshes
monthly, so "now" is up to a month stale, and using the clock would silently discount the
newest month we actually have.

> **This made the product claim less, not more.** Scorable segments fell from 2,703 to
> 1,167 and 52 Lawrence West from 25 stretches to 7 — after recalibrating the confidence
> bar, not before. The evidence was always this thin; the flat average was hiding it. It
> sharpens Q-A considerably: the map is now emptier than the one that question was written
> about.

**Reversed if:** a longer holdout shows the three-month half-life is overfit to this
particular two-month window, which is worth re-testing as the archive grows.

---

## D-20 — The map keeps the screen; the answer peeks `ACCEPTED · IMPLEMENTED`
**Cites:** P-09, D-14, D-15 · **Problems:** PR-01, PR-04 · **Evidence:** E-L12

Results arrive as a list — where there is real choice, comparison is the point. The moment a
rider picks one, the sheet folds to a **peek**: the chosen answer stays, the alternatives go
behind a labelled handle ("2 other ways"), and the map takes the rest of the screen.

*Why:* the first build gave the map 232px of an 844px phone. D-14 calls the map "the retrieval
mechanism", and a map that small retrieves nothing — a rider cannot see where the route goes,
which is the one thing a drawn route is for. Vertical space is zero-sum on a phone, so the
comparison has to yield once it has been used.

The fit is **measured from the live layout**, not from constants: the topbar and sheet both
change height, and the hardcoded inset that preceded this drew half the route underneath the
sheet.

**Reversed if:** riders re-open the list on most trips, which would mean the choice is not
settled by picking and the list should stay.

> **Updated 2026-09-02 by `D-39`.** The handle reads "3 other ways" more often than "2" now:
> the generator returns four journeys where it used to average 3.6, and they overlap less by
> construction. The peek itself is unchanged, but `Q-E` — do riders re-open the list — is now
> being asked of a slightly longer list than the one this decision was written against.


## D-21 — Rider names, not GTFS names `ACCEPTED · IMPLEMENTED`
**Cites:** P-09, D-18 · **Problems:** PR-02

Search and the step list show the place, not the record: "Sherbourne Station", not
"Sherbourne Station - Eastbound Platform"; "Jane St at Eglinton Ave West", not the same with
"North Side" appended. Results are deduplicated on that name, exact-prefix matches rank first,
and station codes from the incident feed ("BLOOR-YONGE") are cased back for display.

*Why:* raw GTFS filled the top eight hits with the same corner listed once per direction and
once per platform, and led with the wrong place — searching "Sherbourne" put a stop on The
Esplanade above Sherbourne Station. The suffixes answer a question nobody asks while choosing
a destination.

> **Corrected 2026-08-29 (E-D22).** The match was a plain substring, so "CN" found
> M**cN**icoll Ave and "ROM" found San **Rom**anoway — and since neither is a prefix match,
> the ranking fell through to shortest-name and offered a stop 25 km away as the top hit,
> with nothing to signal that nothing had really matched. The query must now land at the
> start of a word; where nothing does, the honest output is an empty list.

**Scoring still keys on the raw name.** The segment index was built from it, and a prettier
string at that boundary would silently miss every lookup — the same class of bug that held
journey coverage at 7.7% until it was found.

**Search offers only stops a rider can board from.** GTFS carries a parent node per station
with a clean name and no departures; deduplicating on the display name made that node win,
and picking it returned "no journey found" for a trip that plans fine.


## D-22 — Waiting is a step `ACCEPTED · IMPLEMENTED`
**Cites:** P-09, D-02 · **Problems:** PR-01, PR-03

The step-by-step list shows the gap between arriving and the next departure as its own row —
"Wait at Eglinton Ave West at Jane St · 5 min" — recessed, and without a clock time, so it
reads as the gap it is rather than an instruction.

*Why:* `Min Gap` is the metric the whole product is built on (D-02). Folding the wait into the
adjacent leg would hide the one cost a rider actually feels, in the one screen that lists what
happens to them minute by minute.


## D-23 — Colour on this app means risk, and nothing else `ACCEPTED · IMPLEMENTED`
**Cites:** P-03, D-16, D-18

Two corrections fell out of building the trip view:

- **Disclosures are monotone.** "Why this number?" and "Step by step" were accent blue. Next
  to a green-to-red scale, a blue link is a second colour channel competing for the same
  attention and teaches a rider that colour marks *affordance*. Underline carries "tappable";
  blue is now focus rings only.
- **Walking takes no colour from the scale.** A walk leg was drawn in the scale's green, which
  claims "reliable" about a footpath the model has never measured. It is now a dark neutral
  dash (`--walk`), off the scale entirely.

The second one bends the rule that greyscale belongs to the basemap alone. The boundary: trip
*geometry* may take ink; a *data state* may not. `unknown` stays on the scale, dashed and
thinned, because it is a claim about measurement — walking is not.

---

## D-24 — Work backwards from the deadline `ACCEPTED · IMPLEMENTED`
**Cites:** P-01, P-09 · **Journeys:** J-01 · **Problems:** PR-01, PR-03, PR-05 · **Evidence:** E-L03

**The arrive-by *machinery* is the decision here.** The rider this is built for often knows
their arrival time and not their departure time — a shift, a clinic slot, a daycare that
charges by the minute — and a planner that only asks for a departure time asks them to solve
the problem before it will answer it.

> **The default moved to "leave at, now" on 2026-09-02.** Arrive-by was also the default, and
> that part was wrong: it is the right question for the morning trip this decision was written
> about, and not for *opening the app*, which is usually standing somewhere wanting to go.
> Defaulting to it asked every rider to state a deadline before anything would answer. Both
> modes are one tap apart, so nothing is hidden — the deadline stops being the toll gate.
> Everything below is unchanged and is what makes arrive-by worth having at all.

The planner searches backwards: earliest arrival is monotone in departure time, so the
latest departure that still makes the deadline is found by bisection over the existing
Connection Scan. Eleven probes, ~50ms warm.

**The answer is a departure time and both outcomes**, never one number:

> **Leave 08:33** — arrives 08:57, 2 min to spare
> About **1 morning in 181** this runs long — you would arrive 09:21.
> Leaving **07:37** covers that — at 57 min earlier every day.

J-01's named failure is a single confident ETA; for a rider with a penalty attached to being
late, that is the number that gets them in trouble. Each option in the list is also scored
against the deadline directly — "2 min spare", "16 min late" — because arrival time alone
does not answer the question being asked.

**What the model does not cover, stated on screen.** The reliability layer measures *logged*
TTC disruptions, not whether an undisrupted bus keeps its timetable. So the advice is never
phrased as a percentile of arrival time: a model that sees only large events puts the 90th
percentile at the scheduled time and tells a rider with a deadline to leave with no buffer at
all — the failure case dressed as statistics. The footer says so in one line rather than
deferring it.

### The buffer is priced, never prescribed

> **Reversed during implementation, and the first attempt is left here on purpose.**
> The first build had a threshold: recommend the earlier departure above roughly one
> disruption in two hundred trips. It shipped advice no honest person would give — *leave 58
> minutes earlier every morning* to cover something that happens twice a year. Rewriting it
> as expected value fails the other way: the expected cost of a disruption is a fraction of a
> minute, so no buffer is ever "worth it".
>
> Neither is bad arithmetic. **The recommendation is the wrong act.** What a buffer is worth
> depends on what being late costs *this* rider, which ranges from an annoyance to a missed
> shift and a warning (U-02), and we do not know which. We know the rate and the price; they
> know the penalty. So the advice states both numbers and stops — which is what U-02 needs
> from us: an honest number and permission to act on it, not an instruction.

> **Two corrections from E-D22.** The buffer was offered on options that miss the deadline
> on an ordinary day, and the arithmetic folded that everyday shortfall in — "34 min late"
> followed by "leave 93 min earlier to cover that", where 34 of the 93 were owed every
> morning and had nothing to do with the disruption named above. Those options now get no
> buffer; the line saying nothing this way makes it is the answer.
>
> And the sentence said "to cover **that**" while being sized to the worst tenth of bad
> mornings rather than the median one it had just described — 59 minutes against 24. The
> percentile basis stays deferred, as J-01 allows. The false antecedent does not: it now
> reads "to be safe on almost any bad morning".

The tail percentile the covered departure buys against is pre-registered in
`src/domain/departure.ts`, not argued here, so it cannot be renegotiated after seeing a
number. A rider with a hard deadline plans by the tail (E-L03), so "covered" means covered on
all but the worst tenth of bad mornings, not on the median one.

**Reversed if:** riders read the two-outcome answer as hedging and want to be told what to do,
which would be a real finding about P-01 and not just about this screen.


## D-25 — The trip form folds once the trip is stated `ACCEPTED · IMPLEMENTED`
**Cites:** D-15, D-20 · **Problems:** PR-04

Origin, destination and time are one card, and once a plan lands it collapses to a single
summary line that taps back open.

*Why:* three input rows is 195px of an 844px phone, and adding the time control for D-24 took
that space directly from the map. D-20 already established the map cannot do its job through a
slot. A form that has been filled in is reference, not input — it earns one line, not three.

Red is this app's single "this costs you" colour: the scale's top end and a missed deadline
share it deliberately, because to a rider scanning three options they mean the same thing.

---

## D-26 — Say which part of the trip, not just how much `ACCEPTED · IMPLEMENTED`
**Cites:** P-03, P-09 · **Journeys:** J-01, J-04 · **Problems:** PR-02, PR-05 · **Evidence:** E-D12

Before this, the drawn route was the only thing that said *where* the risk was, and nothing
on screen said what its colours meant. Three changes:

1. **Every ride leg carries its own rate** in the step list — "Goes wrong 1 in 486", or "Not
   enough data on this stretch". Variance compounds across transfers on a long trip (PR-05),
   so which leg is fragile is a different question from how much the trip carries. The legs
   compose into the trip figure by the same formula, so the two screens cannot disagree:
   1 in 486 with 1 in 382 is exactly the 1 in 214 on the card, and there is a test asserting it.
2. **A one-line key under the map**, listing only the states actually drawn. A legend is
   machinery and P-09 defers machinery — but an undecoded colour is not hidden method, it is
   a claim the rider cannot read. Walking is deliberately left out: of the three states it is
   the one readable from position alone, and three entries wrapped to two lines.
3. **Unmeasured stretches of a planned trip are drawn as unknown** — see below.

### The defect this uncovered

> **A planned trip drew its unmeasured stretches in the most reliable colour**, from M9 until
> now. The journey features never carried `confidence`, so the map's colour ramp coalesced a
> missing exposure to zero and painted it at the green end. On one Jane–Union itinerary that
> was 8 of 18 ride segments rendered as "as good as it gets".
>
> This is the exact failure P-03 exists to forbid, and neither the typecheck nor the tests
> could see it — the expression was valid and the data was correct. It was found by adding
> the per-leg numbers and noticing a leg reading "not enough data" under a solid green line.
> Journey rides now split into a known layer and a dashed unknown layer, the same two kinds
> the explore map uses, so the encoding a rider learns in one view holds in the other.

### Dominance is a comparison with the runner-up, not with the total

> **Reversed during implementation.** "Which leg carries the risk" was first decided by the
> leg's share of the trip's total, at 50%. On a two-leg trip with equal legs each carries
> just over half the total, so the rule fired on a perfectly even split and pinned the rider
> to an arbitrary half of their journey. A unit test written before the numbers were looked
> at caught it.
>
> The rule is now `WORST_DOMINANCE = 2`, pre-registered in `src/domain/itinerary.ts`: a leg
> or a stretch is named only when it carries twice the risk of the next one. It fires far
> less often, which is the honest outcome — on most Toronto trips the risk really is spread.
> The same rule replaced the equivalent threshold on the results card, and the decision now
> happens once on the server rather than twice with two different constants.

---

## D-27 — Condition on time of day, and let the rider see the other figure `ACCEPTED · IMPLEMENTED`
**Cites:** P-01, P-03, P-09 · **Journeys:** J-01 · **Problems:** PR-01, PR-08 · **Evidence:** E-D20, E-D18

Every rate the app showed was pooled across the service day, so an 08:30 departure was quoted
a number that included 23:00 running. E-D20 measured it: the variation is real and persists
(rho = 0.406), and it misstates a morning commute by around 20%.

**One toggle, defaulted to the rider's own travel window.** "6 to 9am" or "All day". It
governs the numbers *and* the colours on the map, because a route coloured on one basis
beside a rate written for another is worse than either alone. The all-day figure stays
because it is the right thing to *compare* against — it is the same number for the route at
every hour — but it is not the one to quote by default.

The trip form now defaults to the current time rather than a hardcoded morning peak, so a
rider who opens the app gets figures conditioned on when they are actually travelling.

**Conditioned where the evidence reaches, pooled everywhere else, and the mix is stated.**
Only about a third of scorable segments carry enough exposure in a band (E-D20), so the band
view substitutes the all-day figure for the rest. Dropping those stretches instead would
quietly shorten the trip and make it look safer. The share that is genuinely conditioned is
reported on screen — a rider told "at this time" deserves to know how much of it is (P-09).

**Both sides of the ratio are sliced the same way.** Peak-hour incidents over all-day trips
would understate peak by roughly the factor peak service exceeds the daily mean, and that
error is most of why the intuition "peak is much worse" does not survive measurement.

**The map's band figure is rescaled to the all-day trip volume** — "if the whole month ran at
this band's rate" — so it lands on the same ramp. Raw band minutes are smaller merely because
a band is shorter, and every stretch would slide toward the reliable end for the wrong reason.

**The toggle only appears when there is something to switch to.** On a trip where no stretch
can be conditioned there is no second view, and a control with one working setting is a
promise the data cannot keep.

### Two defects this surfaced

> **The planner refused trips that exist.** GTFS runs a service day past midnight — this
> feed's weekday service spans 03:28 to 30:35, meaning 06:35 the next morning. Comparing a
> wall-clock 01:45 against that window directly, the planner reported "no journey" for a
> 01:14 departure sitting in its own data. Found only because defaulting the time control to
> *now* ran the app at 01:34. `inServiceDay` now places a wall-clock time in the service day
> the schedule uses.
>
> **And a claim made here about Blue Night was wrong — corrected 2026-08-29.** This decision
> originally said the overnight hours were missing because Blue Night runs on a GTFS service
> id we had not ingested. That was asserted from a service window printed with hours wrapped
> modulo 24, which made 30:35 read as 06:35 and looked like a gap. **All 35 Blue Night routes
> (300–396) are in the weekday service already**, and every wall-clock hour is covered once
> the service-day shift is applied. The "we do not have Blue Night" message was therefore
> false, and is gone.
>
> **A second, narrower defect was found alongside it, and is now fixed.** A request to arrive
> between about **03:30 and 06:00** was read as this service day rather than the one still
> running from yesterday morning, so the planner searched a window with almost no service and
> reported nothing. Both readings are valid in those hours; only one was tried. That is
> U-02's shift-start window. `serviceDayTimes` now returns every reading an hour can have and
> the planner tries each, keeping whichever leaves as late as possible and still makes the
> deadline. Every hour of the clock now plans.

**Reversed if:** riders find two numbers for one trip confusing rather than clarifying, in
which case the band figure stands alone and the all-day one moves behind "why this number".

---

## D-28 — Compare every trip with a typical one of its length `ACCEPTED · IMPLEMENTED`
**Cites:** P-01, P-03, P-09 · **Problems:** PR-02, PR-08 · **Evidence:** E-D21 · **Answers:** Q-C

"Goes wrong 1 trip in 197" is an analyst's number. Beside it now sits a verdict and the
figure behind it: *"Safer than most trips this long — typically 1 in 139."* The ranking makes
it a judgement; the reference figure keeps the judgement checkable rather than asking the
rider to take our word for it.

This is the direct answer to Q-C, which has been open since D-11 and asks whether our units
mean anything to a rider. It does not close the question — only riders can — but it removes
the version of the problem we could fix ourselves.

**The reference class is trips of similar length.** A typical 90-minute trip goes wrong about
twelve times as often as a typical 15-minute one (E-D21), so ranking them together would tell
a rider that long trips are badly run rather than anything about the routes they chose.

**Sampled offline, per band as well as all-day.** `npm run benchmark` writes a table the API
loads at startup, so a plan request never pays for it. Band references are kept separate:
ranking a 5pm trip's pm-peak figure against a reference sampled at 8am would compare two
different measurements, which is the error D-27's toggle exists to avoid.

**Both sides must be measured to the same standard.** A trip covered on a fifth of its length
looks safe because most of it was never checked. The reference holds only trips at coverage
≥ 0.5, and only trips at that coverage are ranked — the same bar the interface already uses
to call coverage thin, so a trip that earns a comparison is exactly a trip we do not caveat.

**A verdict needs rank and magnitude.** Comparable trips cluster tightly, so a trip 15%
riskier than the median can sit below 86% of its class. Both must clear a bar or the answer
is "about typical" — see E-D21 for why rank alone would have us overselling.

### What the reference class is, and is not

> It approximates trips people take, not trips that exist. There is no ridership data, so
> stops are drawn in proportion to the service that runs there — the TTC puts buses where
> people are. It is a proxy, and the wording on screen says "trips this long" rather than
> claiming to know what is typical for a person.
>
> **The first two attempts were both wrong, and both are recorded in E-D21**: uniform stop
> sampling ranked an ordinary downtown hop below 99% of its class, and an unfiltered
> reference with median coverage 0.23 ranked every real trip in the worst tenth. Neither was
> a bug in the arithmetic. Both were the reference class quietly answering a different
> question from the one on screen.

**Reversed if:** riders read the comparison as a score to optimise rather than context for a
number, which would make it a game about routes rather than information about them.

---

## D-29 — Today is stated, never estimated `ACCEPTED · IMPLEMENTED`
**Cites:** P-03, P-09 · **Journeys:** J-01 · **Problems:** PR-04, PR-08 · **Evidence:** E-D15

The reliability figures are a record of normal days. When the TTC has flagged a route on the
rider's way, today is not one, and the number is quietly wrong in a direction they cannot
see. Every trip now carries what the feed says about it:

> **TODAY** — checked 3 hours ago
> **No service on part of the 510** — due to the CNE.
> *The figures below are from normal days and do not include this.*

**We say what is happening and stop.** The feed says a route is on detour; it does not say by
how many minutes, and no amount of history tells us what today's blocked track adds. A
plausible number here would be the most trusted figure on the screen and the least earned —
exactly what P-03 exists to prevent. Where a disruption actually stops service, the planner
instead offers a way that does not use those routes, because an alternative is something we
can produce honestly and a delay estimate is not.

**Ranking is left alone.** We know a flagged route is not running normally; we do not know
whether the rider's own stretch is affected. Demoting on that would be deciding for them with
a number we do not have — the same call D-24 makes about the departure buffer.

**One event, not one alert per route.** A single security incident at Scarborough Centre
arrived as **18 separate alerts**, identical but for the route name. E-D15 predicted this;
alerts whose text matches once the route prefix is stripped are now collapsed into one event.
Eighteen warnings for one incident would bury the one that matters.

**An unrecognised alert is a notice, not a disruption.** The feed carries real public-service
announcements — "Have proof of payment ready for inspection", attached to eight routes at
once. The kind is read from the description text because the TTC populates every alert with
`UNKNOWN_EFFECT`, and anything unmatched is treated as a notice. The cost of that direction
is a missed alert; the cost of the other is an app that cries wolf, which is how riders learn
to stop reading warnings (PR-08).

**Silence is a claim, so it is qualified.** The feed carries no `active_period` — an alert's
presence in the latest snapshot is the only evidence it is live. Past twelve hours the app
says it could not check, rather than showing nothing and letting that read as "nothing is
wrong today". Even when fresh, the block carries its own age.

**Reversed if:** riders act on the detour notice as though it carried a time cost we implied,
which would mean the wording is doing the estimating we refused to do in the data.

---

## D-30 — Step-free routes around a station, not just past it `ACCEPTED · IMPLEMENTED`
**Cites:** P-05, P-07 · **Personas:** U-04 · **Journeys:** J-01 · **Problems:** PR-06 · **Completes:** D-07

D-07 has said since the beginning that accessibility filters the route set before anything is
ranked. Until now the build only *marked* blocked stations and kept routing through them —
the one promise in this log the code did not keep. The planner now excludes them.

**A blocked station is one a rider cannot use, not one a train cannot pass.** The flag
suppresses boarding, alighting and walking at that stop; the vehicle still runs through it.
Severing the hop instead would cut lines that are perfectly usable end to end — a rider who
cannot use Museum can still ride Line 1 through it.

**Unknown counts as unusable.** `isUsable` already held that absence of an alert is not
evidence an elevator works, and routing now honours it: we would rather offer a longer trip
than send U-04 somewhere we could not verify.

**The rider's own ends are exempt, by station and not by stop.** Exempting only the single
stop id they picked left the other platforms of the same station blocked, and a Greenwood
trip came back five minutes longer by riding past and doubling back on the opposite platform.
They chose that station. What they need is to be told it is not step-free — which the results
now say — not to be routed around their own destination (P-07: "no good option" is a valid
answer).

> **Corrected 2026-08-29 (E-D22).** The field reporting what the constraint cost was every
> inaccessible station in the city — the same eighteen on every trip — behind a comment
> promising the rider "what that cost them", and it was never rendered. It is now measured:
> the trip is planned once without the constraint, and the blocked stations *that* way would
> have boarded or alighted at are named. Riding through a station costs nothing and no longer
> counts. Where the fastest way was already step-free the screen says so, because a rider who
> flips the switch and sees nothing change cannot tell that from a broken toggle.

**What it costs, measured.** Lower Sherbourne/Queens Quay to College St at Bay St: 20 minutes
normally, **23 minutes step-free**, because College is not accessible and the trip now alights
elsewhere and walks. 18 stations are excluded network-wide — 16 built without step-free access
and 2 with elevators out today.

**Reversed if:** the constraint proves too coarse, most likely because station-level access
hides that one entrance of a station works and another does not.

---

## D-31 — Rank routes by what they cost riders, and say why `ACCEPTED · IMPLEMENTED`
**Cites:** P-03, D-05, D-11 · **Journeys:** J-04 · **Problems:** PR-02, PR-08 · **Evidence:** E-D14, E-D02

`PR-02` says unreliability is unevenly distributed and nobody publishes where. Until now this
app answered that one route at a time, through a dropdown of 404 entries in arbitrary order:
a rider could see their route was bad and had nothing to measure it against, which is exactly
where `J-04` begins. Explore mode now leads with the costliest routes, and the picker is
ordered by the same figure.

**Total harm, not per-trip risk.** Both are honest and they answer different questions. Per-trip
risk is what the planner ranks on — how likely *your* ride goes wrong, with frequency
normalised away. Total harm is minutes of waiting a route causes across everyone riding it,
which is the civic question and the one `PR-02` actually poses. A busy route dominates because
it carries more people through more failures; that is the finding, not a distortion. The unit
is the one the map already draws, so the list and the map say the same thing.

| # | Surface | min/month | Mostly |
|---|---|---|---|
| 1 | 504 King | 2,795 | on diversion |
| 2 | 52 Lawrence West | 2,557 | unclassified |
| 3 | 501 Queen | 2,410 | on diversion |
| 4 | 102 Markham Rd | 2,284 | unclassified |

Cross-checks against `E-D14`, which found 504 King the worst surface route by rider-wait. It
also lands on **U-02's own routes** — 52, 102 and 86 are all in the top ten, which is the
first time the persona and the ranking have been derived independently and agreed.

**Ranked within mode, never across it.** Surface delay is only partly geocodable (`E-D07`)
while every subway incident names a station, so the modes are measured to different standards
— 100% coverage against 51% across the top of the list. One combined ranking would put the
subway above the buses *for being better recorded* and present it as being worse to ride.
`D-11` already refuses to compare modes on severity; this is the same refusal for exposure.

**A partly measured route is a floor, not a total.** Marked with a `+`. Dividing by coverage
would invent the minutes we failed to attribute, which is the estimate `P-03` forbids.

### The cause breakdown, seven weeks late

> `J-04` has specified "wants why → cause breakdown" since the research, and it was never
> built. The data was there the whole time: 271 delay codes with descriptions, and every
> incident carries one. Across the network the leading causes by rider-wait are **on diversion**
> (439,076 min), **other** (285,536), **no operator available** (144,254) and **used as shuttle
> bus** (104,043).
>
> The TTC's own words are used rather than categories of ours — "No operator available" is a
> better sentence than anything we would invent. With one exception: their single largest
> bucket on several routes is the code `OTHER`, and "Mostly other" is faithful and useless. It
> reads as **unclassified**, which keeps the fact that the biggest cause is a shrug — itself
> worth knowing, and squarely `PR-08` — without dressing it up as an explanation.

**Reversed if:** riders read the ranking as a league table to avoid rather than context for
their own route, which would make it a reason not to ride rather than information about riding.

---

## D-32 — Separate the bus that is late from the bus that never comes `ACCEPTED · IMPLEMENTED`
**Cites:** P-01, P-03 · **Journeys:** J-01, J-04 · **Problems:** PR-01, PR-04, PR-13 · **Evidence:** E-D23, E-L07

One number said how often a trip goes wrong. Two different failures were inside it, and a
rider answers them differently: a late vehicle arrives eventually, so waiting works; a
cancelled, diverted, shuttled or unstaffed one never arrives, so waiting is wasted and the
only response is a second plan.

**36% of all rider-waiting is the second kind** (E-D23), and on some routes near three
quarters of it. Trains are late; buses disappear. The app now says so — on the route ranking,
in its own "where waiting does not help" list, and on a planned trip where the share passes
the point at which waiting stops being the right move more often than not.

The bar is 50%, registered in `src/domain/vanishing.ts`. The network average is 36%, so a
lower one would fire everywhere and mean nothing.

**Weighted by minutes, not by incidents.** One cancellation on a half-hourly route costs a
rider more than three small delays, and counting events would flatter exactly the routes this
exists to expose.

**Ranked separately from total harm.** The costliest routes are the busy ones and they sit
near the network average, so a rider looking at that list would never see this. The routes
where the bus simply does not come are quieter and need their own question asked.

### On using this as a safety signal

> Asked for during the build: could these metrics help a solo traveller pick a safer route at
> certain hours? **No, and the app must not imply it.** `PR-11` is marked `OUT` for exactly
> this reason — we cannot measure or predict personal safety, and a route labelled "safer"
> from delay data would be a claim the data cannot carry and a harmful one to act on.
>
> The measurement also declines the premise: vanishing service is **flat across the day**,
> 33% to 38% in every band, so there is no night-time effect to surface even if we wanted to.
>
> What survives is `PR-13`, which is the honest version of the same instinct: "your bus is 26
> minutes away" is information in July and a decision about physical safety in January. The
> product's job is to make the wait legible and let the rider judge what it means, which is
> the same stance `D-24` takes on the departure buffer. Naming an open-ended wait as
> open-ended — this route may simply not turn up — serves that directly, without grading a
> street we have never measured.

**Reversed if:** the distinction turns out not to change what riders do, in which case it is
detail rather than advice and belongs behind "why this number".

---

## D-33 — Conditions on a trip are tags that open `ACCEPTED · IMPLEMENTED`
**Cites:** P-09, D-05, D-15, D-17 · **Journeys:** J-01 · **Problems:** PR-04

A trip can carry several conditions at once — a route not running today, a route that often
does not turn up, thin history, stations the step-free constraint routed around — and each
was a paragraph. Four blocks of qualification pushed the answer and the map off a phone
screen, and a rider skimming could not see at a glance how many things were wrong.

They are now tags in one row, each opening to its explanation. `D-05`'s shape: the verdict
first, the detail one interaction beneath.

> **510 not running** ›  **Often doesn't turn up** ›  **Little data** ›

**The label carries the claim; the tap only carries the detail.** `P-09` permits deferring
how we know and forbids deferring what we do not know — "that confidence is low" and "that a
segment has no data" are both in its never-hide column. So a tag reads "Little data", never
"Details", and anything that cannot be said in three words does not become a tag.

**Tags sit above the answer, not below it.** A figure that does not cover the situation in
front of the rider has to be qualified before it is read.

**Severity earns the colour, and unknown keeps its dash.** A closure can end the trip and is
red; a detour slows it and is not. The "little data" tag is dashed, the same treatment
unknown segments get on the map, so the two read as one idea rather than two conventions.

**Reversed if:** riders do not open them, which would mean the labels are carrying the whole
message and the explanations should be somewhere they will actually be found.

---

## Open questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| ~~Q-1~~ | ~~Is `Min Gap` recorded reliably enough to build on?~~ | — | **Closed 2026-08-28: yes** |
| ~~Q-2~~ | ~~Can surface geocoding beat 66%?~~ | — | **Closed 2026-08-28: yes, 76.6%** |
| Q-3 | Do riders want a verdict or the evidence? | D-05 | D-08 |
| Q-5 | Does per-segment severity persist over a longer window? | D-11 | data, later |
| Q-7 | Is a 3-month half-life overfit to one holdout window? | D-19 | data, later |
| Q-4 | Is J-02 (at-stop) the only moment people open an app? | D-03 | D-08 |
| Q-A | Does a mostly-unknown map build trust or read as broken? | P-03, D-05 | D-08 |
| Q-B | Is the segment or the corridor the rider's unit? | D-01 | D-08 |
| Q-C | Does gap-minutes-per-month mean anything to a rider? | D-05 | D-08 · partly addressed by D-28 |

## D-34 — Say what one missed vehicle costs `ACCEPTED · IMPLEMENTED`
**Cites:** P-02, P-08, P-09, D-05, D-22 · **Personas:** U-02, U-04 · **Journeys:** J-01, J-02 ·
**Problems:** PR-01, PR-13 · **Evidence:** E-D13, E-D23, E-D24

The step list has shown the wait since `D-22` — "Wait at Danforth Ave at Dawes Rd · 2 min".
That number is the schedule's promise about one named vehicle, and `PR-08` is the finding
that riders have already learned not to believe it. Nothing on the screen said what happens
when it breaks.

Three additions, all facts rather than estimates:

- **The headway, under every wait.** "2 min · 27 min to the next one." What one no-show
  actually costs, in the place the rider is reading the wait.
- **A tag when a wait is fragile.** `Runs every 27 min`, in the D-33 tag row, expanding to
  the route, the stop, the band, and the sentence that matters: *if that one does not come,
  the wait is 27 min, not 2.*
- **Minutes outside, on the card.** Two ways to Kennedy Rd measured 60 and 71 minutes and
  *the same* 1-in-65 risk; one of them stands a rider on a street for 7 minutes and the
  other for 14. U-02's stated optimisation is "whether the trip is viable at all, **and how
  long they will be outside**", and the app had never answered the second half.

**Why the schedule and not the archive.** `D-11` measured that mean wait does not persist
per segment — rho = 0.10, against 0.68 for exposure — so a "typical wait here" from incident
history would be noise formatted as precision, which `P-08` forbids. The headway is a
different quantity: a published fact about the timetable, exact for the band it describes,
and it bounds the cost of a vehicle that never arrives without predicting anything. This is
the one honest way to put a wait figure on screen given what `D-11` established.

**Why 20 minutes.** Pre-registered in `wait.ts` and then audited (`npm run audit:headway`,
E-D24). Ten minutes — the TTC's own frequent-service standard, and the obvious candidate —
turns out to be the **median** headway behind a weekday departure, so a tag there would
appear on half of all service and carry no information. Twenty fires on 25.0% of departures,
and on **74.3% of night departures**. `E-D13` is the other anchor: at 20 minutes the
timetable alone hands a rider something the size of the pooled surface wait once an incident
occurs (p50 = 24 min) — a bad-day wait with no bad day required.

**This corrects a framing error made while deciding it.** The feature was first proposed as a
night-safety one, for the solo traveller. `E-D20` had already measured night as the *safest*
band per trip (0.78× pooled) and `E-D23` measured never-came as flat across the day and
lowest at night — so a night feature justified on risk would have been built against our own
evidence. E-D24 found where night is genuinely different, and it is frequency: the same
failure that costs a peak rider seven minutes costs a night rider half an hour. The feature
survived; its justification changed completely.

**What it deliberately does not do.**
- **No buffer advice.** `D-24` refused to recommend a buffer against a rate, because the
  rider knows the penalty and we do not. The same refusal holds here: we say the headway
  costs 27 minutes, not that they should leave 27 minutes earlier.
- **Not folded into risk.** Minutes outside is a duration, not a probability. Blending a
  comfort cost into a reliability score is the mistake `P-05` refuses for accessibility and
  `D-11` refuses for severity.
- **No claim about shelter.** Toronto is installing 100 heated shelter kits over seven years
  (E-L11) and we do not ingest which stops have one. The app says *outside* and stops there.
- **No safety grading.** `PR-11` is `OUT`. This says how long you stand, never how the street
  feels.

**Two defects it took looking to find,** both invisible to typecheck and tests:
- An in-station transfer — Line 1 to Line 2 at St George — is a footpath in the graph and a
  corridor in life. Counting it put five minutes of January on a trip that never left the
  building. A walk between two platforms of the same station is now indoors.
- `transfers` and `min outside` as separate spans let the separator wrap onto a line by
  itself once the route chips filled the row. One span, joined.

**Reversed if:** riders read a headway as a promise about the next vehicle rather than as the
cost of missing one — the failure mode `D-24` was rewritten to avoid. That is a question for
`D-08`, and it is now on the list as **Q-G**.

## D-35 — The app is called Reliable Transit, and the mark shows a gap `ACCEPTED · IMPLEMENTED`
**Cites:** P-03, D-16, D-18 · **Problems:** PR-08

The page title was `TTC Segment Reliability` — the name of the M6 explorer, written before
`D-14` reframed the product as a trip planner. It is also the string a rider sees when they
add the app to a home screen, which is how a testing session begins.

**The name is the repository's own, not an invention.** `Reliable Transit` was already in
`package.json`; adopting it costs nothing and asserts nothing. Naming is a product call
rather than an implementation one, and inventing a name here would have been a preference
wearing a decision's clothes — so this records the *problem* (the title named a feature that
no longer exists) and takes the cheapest correct answer, rather than claiming the naming work
that item 10 of the design concept describes.

**The mark is a route with a stretch missing** — two solid strokes and a dashed one between
them, monotone, at the same dash rhythm the map uses for an unmeasured segment. `P-03` is
the product's load-bearing principle and `D-26` gives it a visual form; the icon is the
smallest possible statement of it. It takes no colour, because colour on this app means risk
and nothing else (`D-23`).

Also added, all of it for the phone this will be tested on: a description, `theme-color` for
both palettes so the browser chrome matches the sheet rather than sitting in a strip of
someone else's colour, and `apple-mobile-web-app-title` so the home-screen label is the
product's name.

**Reversed if:** a different name is chosen. Nothing downstream depends on this one — it is a
placeholder that is merely correct, not a naming decision.

## D-36 — Compress everything, and warm before serving `ACCEPTED · IMPLEMENTED`
**Cites:** P-06 · **Personas:** U-02 · **Problems:** PR-13, PR-14 · **Evidence:** E-D25

Three changes, all delivery rather than design:

- **Every response is gzipped.** Nothing was. First paint on slow 4G goes 7.1 s → 2.2 s, on
  3G 20.9 s → 5.9 s; `/plan` goes 185 KB → 20 KB.
- **`/plan` stopped shipping what nobody reads.** `path` was leaving in a spread — 74 KB of
  185 KB — and geometry was duplicated between it and `geojson`. Coordinates are rounded to
  six places on the way out, which is 0.11 m. Combined with compression the response is
  **13.6× smaller**.
- **The graph, the scoring caches and the route ranking are built at boot**, and `/health`
  returns 503 until they are. The first `/plan` after a deploy goes **12.3 s → 116 ms**.

**Why this is a product decision and not a chore.** `PR-14` is marked `OUT` because we cannot
fix the fact that an app excludes people without data plans — but we can stop making it
worse. Sending a rider a quarter of a megabyte where twenty kilobytes would do spends *their*
money, and 66.6% of TTC riders are equity-deserving (E-L10). `PR-13` compounds it: `U-02` is
reading this at a stop, in winter, on shelter signal. Seven seconds of blank screen is not a
performance metric, it is whether the app gets used.

**The instructive failure.** Warming the graph at boot was the obvious fix and it was not
enough — the first plan still took 2.89 s because two more caches were lazy. One warmed cache
moved the cliff rather than removing it. The check that catches this is cheap and is written
into `warmScoring`: time the first `/plan` after a boot against the second, and if they differ
by more than a few milliseconds something lazy is missing.

**Not done here, and named so it is not assumed:** the 3.2× first-paint gain only lands once
something gzips the **bundle**. Nothing serves `web/dist` yet — that arrives with the
deployment work, along with precomputing the connection set, which is 74% of a boot that is
still 8.9 s.

**Reversed if:** compression shows up as a CPU bottleneck under real load — unlikely at test
scale, and measurable before it matters.

## D-37 — One image, and the data is built before it `ACCEPTED · IMPLEMENTED`
**Cites:** P-06, D-09 · **Problems:** PR-14 · **Evidence:** E-D25 · **Extends:** D-36

The app, the API and the tile proxy are one process behind one origin, deployed as one
container to Fly in Toronto. `docs/architecture/DEPLOY.md` is the operating detail; this
records the four decisions inside it.

**One origin, because the code already assumed it.** `tiles.ts` builds absolute sprite URLs
from the request origin, and `vite.config.ts` carried the comment "in production both are
the same origin" long before anything served them that way. Fastify now serves `web/dist`
and strips `/api` before routing, so development and production take the identical path —
the difference between them was its own class of bug. It is also what finally lets `D-36`'s
compression reach the 1.16 MB bundle, which is the larger half of first paint: **slow 4G
7.1 s → 2.1 s**.

**Toronto, and never scaling to zero.** Every basemap tile is proxied through this API, so
region latency is felt on every pan of the map — and "the map feels slow" is exactly the
noise that would contaminate `Q-A`. A machine that has scaled to zero makes a rider pay the
3 s warm-up that `D-36` moved onto the platform, so `min_machines_running = 1`.

**The data is built before the image, not inside it.** Ingesting during the build would pull
a fresh TTC feed on every deploy, so the schedule underneath a rider session could change
between deploys and the benchmark would no longer describe the data it was drawn from. For a
study, deterministic beats self-contained: the image ships exactly the data the app was
verified against.

**The connection cache is refused rather than repaired.** `connections.bin` turns 13.9 s of
CSV parsing into a 0.15 s read and removes 207 MB from the image — but a cache that outlived
its feed would have the planner quietly routing riders on a retired timetable, which is the
invisible wrongness `P-03` exists to prevent. It is keyed on a **content hash** of the GTFS
archive, not on size and mtime: a Docker `COPY`, a git checkout and an `rsync` all preserve
the bytes and change the timestamp, so an mtime check would fail in exactly the environment
the cache exists for, and the only symptom would be a slower boot nobody investigates.
Hashing 36 MB costs 34 ms against the 13.9 s it protects.

**Three things this is deliberately not sized for**, named so they are not discovered later:
SQLite lives in the image, so a data update is a deploy (`D-09` already names Postgres as the
migration); there is one machine; and the tile proxy is unmetered, which is the first thing
that would need a cache in front of it. All three are correct for a rider study and wrong for
traffic.

**Reversed if:** the study turns into a product. Every one of the three above becomes a
defect at that point.

## D-38 — Break the tie on connections, and price nothing `OPEN`
**Cites:** P-01, P-03, P-08, D-24, D-34 · **Personas:** U-02, U-04 · **Journeys:** J-01 ·
**Problems:** PR-05 · **Evidence:** E-D26, E-D24, E-D13

`PR-05` is marked `PARTIAL` and has been since it was written: each transfer is a fresh
chance to miss a connection, and the app prices that at the stop (`D-34`) and nowhere in how
trips are chosen or ordered. This proposes the smallest change that closes the gap, and
explicitly refuses the larger one.

**What E-D26 actually established.** Three of the four things this investigation set out to
find were not there. The ranking is *not* transfer-blind — it preferred the transfer-heavier
journey on 73.1% of comparable trips against a pre-registered blindness bar of 90%. Reported
risk *rises* with transfer count rather than falling, so the unknown-as-zero mechanic in
`composeRisk` is real but is not biasing this comparison. What survived is narrow and
specific:

- **59.2% of the time the ranking prefers more transfers, it buys under a minute** (58 of 98;
  median saving 0.0). Expected cost ties, nothing breaks the tie, and the extra connection is
  handed over for nothing measurable.
- **10.2% of connections are scheduled at zero minutes** of slack, and **13.0% of trips carry
  a connection with two minutes or less onto service running at 20 minutes or worse** — the
  threshold `E-D24` already audited for `D-34`.

**The proposal, in two parts.**

1. **A tiebreak, not a weight.** When two journeys' expected door-to-door minutes fall within
   a threshold of each other, prefer the one with fewer transfers. This adds no number to the
   model and changes no number on screen: it decides only what a rider sees first, in the
   case where the ranking currently has no opinion and picks arbitrarily.

2. **Surface the exposed connection, using the affordance that exists.** A two-minute step
   onto twenty-minute service is already describable with `D-34`'s vocabulary and `D-33`'s tag
   row — the headway is a published fact, the slack is arithmetic on the schedule, and neither
   requires an estimate. No new unit, no new scale.

**What this deliberately does not do.**

- **No missed-connection probability.** Estimating the chance a rider misses a two-minute
  connection needs the distribution of arrival lateness on the incoming leg, which is exactly
  the quantity `D-11` measured as non-persistent (rho = 0.10). Inventing it would be `P-08`'s
  failure mode with more arithmetic in front of it, and `D-24` already refused the
  structurally identical move for the departure buffer.
- **No transfer penalty inside `composeRisk`.** A connection is not a segment and adding a
  fabricated per-transfer risk to a product of measured ones would corrupt the one number in
  this app that is traceable end to end. `D-34` drew the same line for minutes outside — *"a
  duration, not a probability"* — and it holds in the other direction here.
- **No re-ranking on comfort.** Fewer transfers as a *preference* is a taste we do not have
  evidence for. It enters only as a tiebreak, where the alternative is an arbitrary choice.

**The threshold is not set here, and that is deliberate.** The 59.2% that motivates this was
counted after the distribution was seen (E-D26's standing caveat). Registering a tiebreak
window now would be picking a number knowing which way it resolves — the renegotiation the
audits in `src/audit/*.ts` exist to prevent. The window goes in `src/audit/transfers.ts`
before the next measurement, not into this entry.

**Why it is `OPEN` and not accepted.** Part 1 is a judgement about what a rider prefers when
two trips cost the same, and nobody has asked one. Part 2 lands in the tag row whose
readability is already the open question `Q-G` — *does "runs every 27 min" read as a cost or
as a promise?* If it reads as a promise, a second tag saying "and you have two minutes to
catch it" makes that worse rather than better. Both parts belong in the same session as
`D-08`, which is a further reason not to fix a number now.

**Reversed if:** riders shown two journeys of equal expected duration pick the
transfer-heavier one, or are indifferent — which would say the tiebreak is our preference and
not theirs, and that the honest ranking is the arbitrary one with the arbitrariness disclosed.

## D-39 — Search wider, show fewer `ACCEPTED · IMPLEMENTED`
**Cites:** P-06, P-09, D-14, D-20, D-36 · **Personas:** U-02, U-05 · **Journeys:** J-01 ·
**Problems:** PR-05, PR-07 · **Evidence:** E-D27, E-D12

Connection Scan answers exactly one question — earliest arrival — so every alternative has to
come from changing the question. The generator banned each of the first three routes the best
journey used, always from the same starting point, so every alternative was one edit away and
a trip whose second-best answer needed two changes was never found.

**Two changes, in `src/api/planner.ts`.**

1. **Branch-and-ban to depth two.** Each surviving journey is expanded in turn: ban a route,
   then ban a route of what that produced. The standard shape, and it finds the second edit.
2. **Return the most route-diverse subset, not the top of a ranking.** A pool of six is
   generated and four are kept, chosen greedily by lowest route overlap (Jaccard on route
   sets) against what is already kept. The earliest arrival is always kept first; the rest
   earn their place by being *different from it*. Four variations on one corridor is one
   option printed four times, which is what `P-06` calls a dashboard.

Citywide this lifts the share of trips carrying a materially safer alternative from 1.3% to
**2.3%**, and one costing five minutes or less from 0.3% to **1.0%**.

**Both numbers were measured, not chosen.** A sweep over pool width found the benefit peaks
at six and *declines* past it: a deeper pool is mostly two-ban journeys that crowd out the
single-ban alternatives a rider would consider, so twelve costs 23 ms more per request to
find a materially safer option less often than six does (E-D27).

**What it cost.** `/plan` latency p50 60.5 → **84.7 ms**, response JSON p50 69.3 → **91.8 KB**,
journeys returned 3.57 → 4.14. That is spending against the budget `D-36` had just recovered,
recorded here rather than absorbed quietly. The gzipped response stays inside `E-D25`'s
13.6 KB, so the delivery win survives; the compute does not come back.

**What this deliberately does not do.**
- **No "most reliable" label.** Citywide the badge would name the same journey as "fastest"
  95% of the time — see `D-40`, which scopes that separately.
- **No wider pool "just in case".** The sweep says it is worse, not merely more expensive.
- **No claim to have fixed the shortage of options.** At every pool size the median trip has
  *zero* candidates clearing the comparison bar, because most surface segments cannot be
  scored at all (`E-D12`). This makes the search stop being the limit; it does not make
  coverage stop being one.

**Reversed if:** the latency shows up in a rider session as hesitation on the results screen,
in which case the pool drops back to four — the 1 point of material rate is not worth a
screen that feels slow to `U-02` on a shelter's signal.

> **Generating is not the same as offering (2026-09-02, `E-D33`).** Banning a route the best
> trip needs returns the best trip that exists *without it*, and the diversity pick then keeps
> that precisely because it is different. On one trip it produced a 79-minute option beside a
> 37-minute one — full of one-minute rides wrapped in nine minutes of walking, and printing
> the best reliability of the four because only 5% of it was measured.
>
> Three filters now sit between the generator and the list, and each reuses a bar this project
> already set:
> - **Dominated options are dropped** — slower, no safer by `MATERIAL_RATIO`, and no better
>   measured by `MIN_COMPARABLE_COVERAGE`. All three, against a journey already kept: slower
>   alone is not enough, because a longer trip we can actually speak for is a real choice.
> - **A ride that costs more walking than it saves is replaced by the walk**, judged the way a
>   rider would — is walking this stretch faster, or close enough not to matter?
> - **A thin figure is bound to its extent** on the card: *"1 in 380 on the 38% of this route
>   we can measure"* rather than a rate and a separate caveat underneath.
>
> This is `D-14`'s rule applied to the list: where there is no real alternative, the honest
> output is one route and when to leave, not a manufactured menu.

---

## D-40 — Comparison is a downtown affordance, not a citywide one `OPEN`
**Cites:** P-03, P-06, P-08, D-13, D-14 · **Personas:** U-05, U-02 · **Journeys:** J-05, J-01 ·
**Problems:** PR-07 · **Evidence:** E-D27, E-D14, E-L12

A results list labelled **fastest** and **most reliable** is the obvious next feature and the
brief asked for it in those words. Measured, it is two labels on one journey nearly
everywhere in the city, and a real distinction downtown.

| | citywide | downtown |
|---|---|---|
| fastest is not the most reliable | 5.3% | 21.7% |
| …by a margin clearing `MATERIAL_RATIO` | **1.3%** | **12.3%** |

**A badge that is correct and uninformative is worse than no badge.** It appears on every
trip, so it distinguishes nothing, and it pushes the tags that *are* rare — a closure, a
route that does not turn up — down a row on a phone. That is the wallpaper failure
`audit:headway` exists to prevent for `D-34`, and the same argument applies here.

**So the proposal is F-03's scope, not a citywide list.** Where the measurement says choice
is real — the downtown core, `E-D14`'s King/Queen/Dundas box, where `U-05` can also walk —
comparison earns a place. Everywhere else the honest output is `D-14`'s: one route, when to
leave, and when to give up.

**This is the third independent argument for the same boundary.** `E-L12` had the TTC's own
"binary" description; `E-D14` had the route-density count; `E-D27` now has the rate at which
a materially different second option actually exists, nine times higher downtown. When three
different measurements draw the same line, the line is probably real.

**Why it is `OPEN`.** Whether a rider *wants* a labelled comparison, or reads two badges as
the app hedging, is `Q-F`'s question wearing different clothes and has never been asked. And
`F-03` is a flow nobody has built, so this decision is a scoping constraint on that build
rather than a change to anything shipped.

**Reversed if:** downtown riders shown the labelled list ignore the reliability label
entirely — which would say the comparison is ours and not theirs — or the Ontario Line opens
and gives more of the city genuine parallel capacity, the same condition `D-13` named.

---

## D-41 — The unit stays "1 in N" until a rider replaces it `SUPERSEDED by D-49`

> **Superseded 2026-11-07.** The product owner asked for the percentage to lead. The
> measurement below still stands; what it ruled out was a percentage at *fixed* precision.
> `D-49` keeps the signal with significant figures instead.

**Cites:** P-01, P-03, P-08 · **Personas:** U-02 · **Journeys:** J-01 ·
**Problems:** PR-08 · **Evidence:** E-D28, E-D19, E-D21

"Goes wrong about 1 trip in 1,206" is the most-questioned number on the screen and the
complaint against it is fair: it discriminates well and nobody knows what to do with it.
`Q-C` has been open on exactly this since the vocabulary was chosen.

**A percentage is not the fix.** Per-trip risk has a median of **0.218%**, and **74.4% of
scored journeys would display as "0%"** at whole-percent precision. The unit a rider finds
most familiar is the one that erases the entire signal — the same failure `E-D19` already
recorded against expected added minutes, arriving for a second candidate. Ruled out on
measurement, and recorded so it is not proposed a third time.

**The candidate that survives is the rider's own calendar.** At ten trips a week the same
rates read as *once every 2.5 months* (p10) to *once every 54 months* (p90), median 10.6.
Wide enough to act on, and it invents nothing — the measured rate over a **stated** trip
frequency, not an assumed one.

**What holds it up.** The reframe imports an assumption about how often this rider travels,
and putting a number on that for them is the move `P-03` forbids and `D-24` already refused
once for the departure buffer. Phrased as a conditional — *"take this daily and it is about
once every 11 months"* — it states the arithmetic and leaves the premise visible. Whether
that reads as helpful or as a dodge is not something we can reason our way to.

**Two framings already on screen do part of the job** and should be weighed before a third is
added: `D-28`'s benchmark verdict compares a trip with typical ones of its length without
using a number at all, and `D-34` prices a missed vehicle in minutes, which is a unit nobody
has ever had to explain.

**Reversed if:** riders read the calendar framing as a promise about their next trip rather
than a rate — the failure mode `D-24` was rewritten to avoid and `Q-G` is already watching
for in `D-34`'s headway.

---

## D-42 — Dark is the default; light is a choice `ACCEPTED`
**Cites:** P-06, D-15, D-18 · **Personas:** U-02 · **Journeys:** J-01, J-02 ·
**Problems:** PR-13 · **Evidence:** E-L11, E-D25 · **Source:** design upgrade, 2026-09-02

The app followed the system theme. It now defaults to dark, with light available as an
explicit choice rather than as an inherited one.

*Why:* the rider this is built for is **outdoors**, at a stop, often at dusk or in the dark —
`PR-13` is the finding that in winter an unexplained wait is a safety problem, and `E-L11`
is the 100 heated shelter kits over seven years that say nobody is fixing the stop. A screen
that matches the surroundings is easier to read one-handed at arm's length, and the
map-as-ground treatment `D-20` commits to only holds together on a dark base.

Following the system was never a decision; it was the absence of one.

**Reversed if:** riders report the dark map is harder to read than light in daylight, which
is the case this trades against and the one condition that would make it wrong.

## D-43 — One display face, self-hosted `ACCEPTED`
**Cites:** P-09, D-18, D-36 · **Evidence:** E-D25 · **Source:** design upgrade, 2026-09-02

**Manrope**, weights 400/500/600/700/800, self-hosted as a subset woff2. No runtime request
to Google Fonts.

**This relaxes a rule, and the rule should be named correctly.** `01-system.md` puts *"no
decorative faces — system UI stack"* under **Type**, and derives it from **rule 4** (look
trustworthy, nothing casual or decorative), not from rule 3 as the handoff records it. The
argument for relaxing it is that the system stack renders as three different products across
iOS, Android and desktop, and a forecast that changes shape by platform reads as less
trustworthy, not more. One face, no decoration, is still rule 4 — it is the *same* argument
reaching a different answer once the product has numbers as its subject.

**Self-hosted is the load-bearing half.** A Google Fonts request is a third-party round trip
before first paint, which is exactly the cost `D-36` spent a milestone removing for a rider
on a shelter's signal.

**Reversed if:** first paint on slow 4G regresses past `D-36`'s 2.2 s. The font is not worth
a rider's second — measure before believing the subset is small enough.

> **The kill condition fired, and the font is not why (2026-09-02, `E-D30`).** Slow 4G first
> paint is **2,576 ms** against the 2,200 ms bar. Blocking the woff2 gives 2,516 ms, so the
> face costs **64 ms** of a 438 ms regression; the rest is everything else this upgrade added.
> Reverting `D-43` would recover 64 ms and still be over budget, so the decision stands and
> the *breach* is carried openly rather than resolved by removing the cheapest suspect.
>
> The remedy is known and measured: moving MapLibre behind a dynamic import took slow 4G to
> **1,192 ms**, better than the figure `D-36` set. It was reverted the same day because it
> broke the map — the worker stopped resolving and the canvas went blank without throwing.
> That is the open task, and it is now well specified.

## D-44 — Saved trips are local, and there are no accounts `ACCEPTED`
**Cites:** P-06, P-09 · **Personas:** U-02 · **Journeys:** J-01 ·
**Problems:** PR-14 · **Source:** design upgrade, 2026-09-02

`localStorage`, maximum five, most recent first. No sign-in, no sync, no server-side record
of where anybody travels.

*Why:* `F-02` opens with a "saved trip?" branch that has never had an interface, and the
same rider takes the same trip most days — re-entering it every morning is the cheapest
friction in the product. An account would collect a home address and a commute pattern to
save four taps, and `PR-14` already records that this product's audience is the part of the
city least well served by asking for more.

**Reversed if:** riders ask to carry trips between devices, which is the one thing local
storage cannot do and the only reason to reconsider an account.

## D-45 — One confidence mark, everywhere `ACCEPTED`
**Cites:** P-03, P-09, D-26 · **Evidence:** E-D12 · **Source:** design upgrade, 2026-09-02

A single mark, used on map lines, tags, list rows, search hits and beside every number:

| mark | meaning |
|---|---|
| ● solid | measured |
| ○ hollow | thin data — the figure is a floor, not a total |
| ◌ dashed | unknown |

**This closes a defect the concept doc has carried open since 2026-08-28.** Confidence was
expressed three different ways — a dashed map line, a dashed tag border, and a sentence — so
the rider had to learn three vocabularies for one idea. `D-26` established that unknown is a
separate categorical state and never a stop on the ramp; this makes that state legible in the
same shape wherever it appears.

`E-D12` is why it matters more here than in most products: 3.1% of segments reach high
confidence, so the mark is not an edge case, it is most of the map.

**Reversed if:** `Q-A` finds that marking every number makes the interface read as broken
rather than as honest — the same risk the hatched map carries, now applied to text.

## D-46 — Motion only where it carries meaning `ACCEPTED`
**Cites:** P-09, D-18 · **Source:** design upgrade, 2026-09-02

Four moves, and everything else is instant:

| move | duration | what it says |
|---|---|---|
| sheet reveal | 240 ms | the answer arrived, and here is the route it describes |
| band fill | 400 ms | this much of the trip is actually measured |
| card → map | 300 ms | *this* stretch is the one being talked about |
| gap counter | 200 ms crossfade | the number changed |

**The counter crossfades and never rolls.** Rolling digits imply a live countdown, which is
the ghost-bus pattern `PR-08` says riders have already learned to distrust and `D-24` was
rewritten to avoid. The motion has to not make a promise the data cannot keep.

`prefers-reduced-motion` collapses all four to a 120 ms opacity change.

**Reversed if:** any of the four is measured slowing a rider down rather than orienting them
— motion that has to be waited through is decoration, which `D-18` rules out.

---

## D-47 — Say which routes are moving, never when the bus arrives `ACCEPTED · IMPLEMENTED`
**Cites:** P-02, P-03, P-08 · **Personas:** U-02 · **Journeys:** J-02 ·
**Problems:** PR-01, PR-08 · **Evidence:** E-D29, E-D23

The realtime feed is consumed at **route level only**: how many vehicles are currently
reporting on each route a trip uses. No countdown, no next-arrival time, no stop board.

**Because the feed cannot be joined to our stops.** `E-D29` measured it: 1 trip id in 2,301
matches the schedule, and the stop ids collide *coincidentally* — 59% of them exist in our
table and return the wrong routes. Feed stop `6857` yields Scarborough routes for a stop on
Queen St West. A countdown built on that is wrong at more than half of all stops and looks
entirely normal, which is the precise failure `PR-08` says riders have already learned to
expect from transit numbers.

**Route ids match 180 of 181, so the smaller question is answerable.** "Is anything running
on the 31?" is not a lesser version of "when is my bus" — `E-D23` measured that 36.1% of all
rider-waiting is a vehicle that never came, and 74% of it on that route. A rider at that stop
is not asking for a countdown. They are asking whether to keep waiting.

**Absent is unknown, never zero.** The feed carries surface routes; the subway is not in it,
and a route with nothing running does not appear rather than appearing at zero. The interface
says *"can't see the 31"* and never *"0 running"* — those are opposite facts and printing one
for the other is `P-03`'s failure with a live feed attached.

**Fetched per request with a 15-second memo, never stored.** An alert is true for hours and is
ingested to SQLite; a vehicle position is true for seconds. Writing these to a table would
guarantee every read is stale by however long since the last ingest.

**Reversed if:** a crosswalk between BusTime stop ids and GTFS stop ids becomes available from
either publisher — at which point `J-02`'s countdown is unblocked and this becomes the
fallback rather than the answer.

---

## D-48 — A trip starts at a door, not at a stop `ACCEPTED · IMPLEMENTED`
**Cites:** P-03, P-06, P-08 · **Personas:** U-02, U-04, U-05 · **Journeys:** J-01 ·
**Problems:** PR-05, PR-13 · **Evidence:** E-D31

`from` and `to` were GTFS stop ids, so every trip began at a stop the rider was assumed to
already be standing at. The first and last mile were invisible, and **every door-to-door
figure on screen was short by however long they take** — 6 minutes on a plain example, and
more in the inner suburbs where stops are sparse and `U-02` lives.

A rider can now type **487 Lauder Ave**.

**Toronto's own address points, not a geocoding API.** 525,470 of them, from the One Address
Repository on the same CKAN portal the delay data comes from. The whole project runs on
public Toronto Open Data and the TTC feed with no key anywhere, and putting a rate-limited
third party in the request path would be a new way for the app to fail at a bus stop.

**The nearest stop is the wrong answer, so it is not the one used.** Every stop within 1.2 km
is seeded into a single Connection Scan at the time the rider could be standing there, and
the timetable decides. On the worked example that picks Oakwood Ave at 334 m over Dufferin St
at 289 m, because the service at Oakwood leaves sooner. Snapping to the nearest stop would
have chosen a route going the wrong way.

**One scan, not one per candidate.** Seeding costs nothing extra, and the far end is free: a
scan already computes arrival at every stop, so choosing between candidate destinations is a
comparison over results — arrival plus the walk to the door.

**What it deliberately does not do.**
- **No snapping when a rider picked a stop.** Coordinates are sent only for an address. A
  rider who chose Union Station meant Union Station, and re-resolving it to "somewhere within
  1.2 km" answers a question they did not ask.
- **No invented precision.** Distances are straight-line, so every walking figure is a floor.
  The interface says *"about 4 min"* and never a flat minute (`P-03`).
- **No silent rounding of an address.** A house number we do not hold resolves to the nearest
  one we do, and that is **marked** — rounding somebody's home to the neighbour's without
  saying so is exactly the small dishonesty this product exists to refuse.
- **No claim the walk is pleasant.** Weather, luggage and mobility are not data we hold.

**Reversed if:** riders enter addresses and then discover the walk is wrong often enough to
distrust the trip — the straight-line floor is the weak point, and a real walking network
(the Toronto Centreline is on the same portal) is the fix rather than a retreat to stops.

> **Three corrections, 2026-09-02, from reading one trip (`E-D32`).**
> - **The headline now reports arrival at the door.** It said "There by 18:17" on a trip whose
>   walk ended at 18:21 — the verdict, the benchmark and the option cards were all still
>   stop-to-stop while the sheet above them said "door to door".
> - **Candidate stops are the whole radius, not the nearest six.** Six excluded every station:
>   75 stops sat within 1.2 km of one door and the nearest LRT station ranked 54th, so the
>   planner could not consider alighting from the train and walking, and rode a bus two
>   minutes at a cost of eight to save nothing.
> - **Walking carries a 1.3 detour factor.** Straight-line is a floor, and the error grows
>   with distance, so long walks were flattered and the choice of alighting stop was biased.
>
> `D-38`'s tiebreak is now implemented for this one case: where two ways to the door finish
> within `TIE_SECONDS` of each other, the one with fewer rides wins. The threshold is sized to
> the uncertainty in our own walking estimate rather than tuned — resolving a margin smaller
> than our error with an extra bus ride is the false precision `P-08` refuses.

---

## D-49 — The issue rate leads as a percentage, with "1 in N" beside it `ACCEPTED · IMPLEMENTED`
**Cites:** P-03, P-08 · **Evidence:** E-D28 · **Supersedes:** D-41 ·
**Source:** the product owner, 2026-11-07 — *"change to percentage of issue rate than showing
~ in ~. keep percentage as main and the other as side with smaller letters."*

A preference of the product owner's, not a finding: no rider has been asked (`Q-C` stays open).
Recorded as one, with the measurement it had to survive.

**Everywhere the rate appears**, the percentage is the figure in the reading weight, and
"1 in N" sits beside it in a smaller, quieter style: the trip card in the list, each leg in
step by step, the benchmark's typical figure, and a new line on the answer card. That card
gave only the *typical* rate before, which left the trip's own number one tap away from the
verdict that judged it.

**Two significant figures, never fixed decimals.** `E-D28` is why `D-41` refused a percentage:
per-trip risk sits almost entirely inside the first percent, so whole percents print "0%" on
74.4% of journeys and one decimal still prints "0.0%" on 12.6%. Significant figures keep the
whole range distinct: the sample's p10, p50 and p90 read **0.043%, 0.22%, 0.94%**. At 10% and
above, whole numbers. A rate is "0%" only when it is zero.

**What did not change.** "Safer than 4 in 5 trips this long" stays in fifths. That is a rank
against a few hundred sampled trips, not a rate, and `D-28` chose fifths so it would not claim
precision the reference cannot support. Coverage stays a percentage of the trip, and the
confidence mark stays within 8px of the figure (`D-45`).

**One line moved.** With a deadline, the sentence used to carry the rate ("about one morning
in 104, closer to 09:07"). The rate line now says how often, so the sentence says only what a
bad day costs ("When it goes wrong, closer to 09:07"), and the bound for a thinly measured trip
("on the 40% we can measure") moved onto the rate line beside the number it qualifies.

**Reversed if:** riders read "0.22%" as "never" more often than they read "1 in 459" as rare.
That is `Q-C`'s question, and the calendar framing `D-41` proposed is still the candidate to
test against both.
