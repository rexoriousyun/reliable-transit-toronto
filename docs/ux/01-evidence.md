# Evidence Base

Every claim the product design rests on. Nothing here is asserted without a source.

**Measured:** 2026-08-28 | **Data window:** 2025-01-01 to 2026-07-31

---

## Data evidence (our own analysis of TTC open data)

### E-D01 — Unreliability is a persistent property of place
Ranked stations by delay-minutes independently in 2025 and 2026, then correlated.
**Spearman rho = 0.78** across 87 stations with meaningful volume in both periods.

*Why it matters:* this is the load-bearing finding. If unreliability were noise, there
would be nothing to predict and no product. It is not noise.

### E-D02 — The dominant causes are people, not infrastructure
Subway delay-minutes by cause: disorderly patron 9.9%, injured/ill customer 11.7%
(medical + transport), unauthorized at track level 5.2%, security other 5.2%,
weather + ice/snow 7.6%. **~32% is passenger and security incidents.** Equipment and
infrastructure is a materially smaller share.

*Why it matters:* it invalidates the original "maintenance and infrastructure wear"
hypothesis. Unreliability tracks *crowding and time-of-day*, which are far more
predictable than component failure — and are things a rider can actually route around.

### E-D03 — Delay location is an attribution artifact, not a rider risk map
**20.7% of subway delay-minutes are attributed to 12 of ~70 stations**, and those are
overwhelmingly terminals and yards (Kipling, Kennedy, Finch, Sheppard West, Wilson,
Davisville). Delays are logged where the *train* was, not where the problem was or
where a rider suffered.

*Why it matters:* the single largest correctness trap in this product category. Naive
"red station" maps tell riders to avoid places that are not actually risky to travel
through. Every competing visualisation we reviewed appears to fall into it.

### E-D04 — Two thirds of delay records are not delays
**65% of subway delay records have Min Delay = 0** — logged incidents with no service
impact.

*Why it matters:* unfiltered, every statistic downstream is wrong.

### E-D05 — The bus network carries ~17x the subway's delay burden
Subway: 117,924 delay-minutes. Bus: 2,052,791. Worst routes: 52 Lawrence West (45,974),
97 Yonge (44,891), 29 Dufferin (41,681), 102 Markham Road (37,327), 63 Ossington (31,901).
Skewed toward outer-suburban routes.

*Why it matters:* the subway gets the attention and the press; the buses carry the pain.
This relocates the product's centre of gravity and changes who the primary user is.

### E-D06 — The subway has no realtime feed
Routes 1/2/4 exist in GTFS static but are **absent from the GTFS-RT trip feed** (which
begins at route 7). Surface transit has live positions; the subway does not.

*Why it matters:* for the highest-ridership part of the network we have schedule +
history + service alerts only. We cannot show live subway positions, and must not
imply we can.

### E-D07 — Surface delay data is only two-thirds geocodable
Surface records identify location as free text (`KING AND PARLIAMENT`) with no
coordinates or stop_id. Matching against GTFS stop names resolves **50.1% of
delay-minutes** by intersection plus **16.1%** at named subway stations = **66.1%
addressable**, leaving **33.9% unresolved**.

*Why it matters:* our map will have real holes. How we render a hole is a UX decision,
not just an engineering one (see `P-03`).

### E-D08 — Feed and data availability
Delay history refreshes monthly, current through 2026-07-31. GTFS static refreshed
2026-08-27: 236 routes, 9,402 stops, includes `shapes.txt`. All three GTFS-RT feeds
live and unauthenticated; **2,223 of 2,279 trips carry real `trip_id`s**, so realtime
joins cleanly to the static schedule.

---

## Literature evidence

### E-L01 — Reliability-aware routing produces real time savings
Reliability-based transit trip planning yields **~8.9% average travel-time savings,
up to 37.1%** on individual routes.
[Springer, Public Transport](https://link.springer.com/article/10.1007/s12469-016-0134-y)

### E-L02 — Mainstream planners ignore variance
Public planners such as Google Maps route on **scheduled times and cannot consider
reliability** of alternatives. A route can take 15% longer but carry only 20% of the
variance — invisible in every mainstream tool.
[Springer](https://link.springer.com/article/10.1007/s12469-016-0134-y) ·
[ScienceDirect, Hamburg](https://www.sciencedirect.com/science/article/abs/pii/S095741742300698X)

### E-L03 — Riders plan by buffer, not by average
Travellers add **buffer time** to arrive on time ~95% of the time; the standard measure
(buffer index) uses the **95th percentile**, not the mean.
[FHWA, Travel Time Reliability](https://ops.fhwa.dot.gov/publications/tt_reliability/ttr_report.htm)

*Why it matters:* riders already think in percentiles. An average ETA answers a question
nobody is asking.

### E-L04 — Rider segments have different concerns
Regular commuters weight reliability, safety and comfort; irregular riders weight raw
travel time. Segments are not interchangeable.
[Segmenting Preferences and Habits of Transit Users](https://www.researchgate.net/publication/277620360_Segmenting_Preferences_and_Habits_of_Transit_Users)

### E-L05 — Unreliability drives churn among riders who have alternatives
Riders with other options "are still mostly choosing those other options, because they
don't know if the bus will show up." Official on-time-performance metrics "hide more
than they reveal" versus lived experience. More accurate realtime information is among
the top things riders say would increase their transit use.
[CBC](https://www.cbc.ca/news/canada/toronto/the-ttc-is-increasing-service-levels-but-advocates-say-riders-need-more-changes-to-trust-the-system-1.6949907) ·
[TTCriders, *Lucky or Late*](https://www.ttcriders.ca/bunchingreport)

---

## Market evidence

### E-M01 — Reliability-aware TTC routing already exists
[Reroute](https://rerouteapp.ca/ttc) does reliability-aware routing on a model trained
on 393,000+ TTC delay records, with live positions and multi-agency GTA coverage.
**It does not expose segment-level reliability.**

### E-M02 — Everything else is a retrospective dashboard
[ttcdelay.kbains.com](https://ttcdelay.kbains.com/),
[TTC Delay Insights](https://ttcdelayinsights.ca/),
[sacul-git/ttc-delays](https://github.com/sacul-git/ttc-delays) — historical analysis and
visualisation, no routing, line/station granularity only.

*Why it matters:* our defensible position is the **segment layer**, not "a trip planner
with reliability in it." That space is occupied.

---

## Added 2026-08-28 (rider-problem investigation)

### E-D09 — Rider-felt wait is far worse than vehicle lateness
The delay datasets carry both `Min Delay` (vehicle lateness) and `Min Gap` (headway gap
left behind). Comparing them:

| | median delay | median gap | gap/delay | incidents with gap >= 2x delay |
|---|---|---|---|---|
| Subway | 5 min | 8 min | 1.38x | 44.0% |
| Bus | 13 min | **26 min** | **1.58x** | **83.8%** |

*Why it matters:* the metric everyone reports (`Min Delay`) **understates what a rider
actually experiences by ~58% on buses.** The gap is the wait at the stop; the delay is
the vehicle's lateness. 83.8% of bus incidents carry the bunching signature. This is our
sharpest differentiator and it is sitting unused in public data.

### E-L06 — Bunching is the dominant service failure, and it is under-reported
Riders waited **50% longer than scheduled on 10 routes** and **30% longer on 41 routes**
(Sep 1 – Nov 16). **Only 10 routes citywide met on-time targets in evening rush.**
Delays were the top complaint to the TTC, raised by **11,470+ people**.
[TTCriders, *Lucky or Late*](https://www.ttcriders.ca/bunchingreport) ·
[CBC](https://www.cbc.ca/news/canada/toronto/ttc-service-report-bunching-1.7439818) ·
[TorontoToday](https://www.torontotoday.ca/local/transportation-infrastructure/transit-riders-group-says-ttc-bunching-likely-worse-than-reported-10122617)

### E-L07 — Short-turning strands riders mid-trip
**330,000+ short-turned TTC buses since January 2012** — riders put off at the roadside
while the vehicle reverses direction.
[Global News](https://globalnews.ca/news/1702327/stranded-how-the-ttc-is-trying-to-solve-its-short-turn-problem/)

### E-L08 — Toronto has Canada's longest commutes, and transit is the slowest mode
Toronto average commute **34.9 min** (national 26.7). **Transit commuters average 44.1 min
vs 24.7 by car.** **30% of Torontonians travel 1–2 hours; 10% travel 2 hours or more.**
[StatCan](https://www150.statcan.gc.ca/n1/daily-quotidien/250826/dq250826a-eng.htm) ·
[CBC](https://www.cbc.ca/news/canada/toronto/commute-times-toronto-1.7307002)

*Why it matters:* long trips mean more transfers, and each transfer is a place where
variance compounds. The tail (10% at 2h+) is where the product's value is concentrated.

### E-L09 — Accessibility failures convert a delay into a cancelled trip
**Only 55 of 75 subway stations are fully accessible**; the TTC missed Ontario's 2025
accessibility deadline. Elevators break without warning, "instantly turning an accessible
station into an inaccessible one," forcing long detours or loss of the trip entirely.
Advocates' top ask is **realtime elevator information**.
[NOW Toronto](https://nowtoronto.com/news/for-ttc-riders-with-disabilities-one-broken-elevator-can-derail-an-entire-trip-now-theyre-pushing-for-better-accessibility/) ·
[The Local](https://thelocal.to/ttc-accessibility-aoda-deadline-missed/)

*Why it matters:* for this group a "5-minute delay" is not a smaller version of the same
problem — it is a different, binary problem. Our severity model must reflect that.

### E-D10 — Exposure persists at segment level; severity does not
Split-half test across 125 segments with >=10 incidents in each period, terminal
approaches excluded:

| metric | rho | ties |
|---|---|---|
| incident count | 0.762 | 41% |
| total gap-minutes | 0.681 | 7% |
| median gap | 0.361 | 94% |
| p90 gap | 0.214 | 82% |
| **mean gap** | **0.104** | **3%** |

*Why it matters:* the exposure dimension is strongly persistent and rankable. Severity is
not — and with only 3% ties its near-zero correlation cannot be dismissed as a
tied-ranks artifact. **How often a segment costs you time is predictable; how long you
wait once it does is not.** This is the finding that reshaped the engine contract (D-11).

Reproduce with `npm run audit:stability`.

### E-D11 — Surface coverage reaches 76.6%, and the gap is not what it looked like
Resolving surface delay locations against GTFS (measured 2026-08-28,
`npm run audit:coverage`), by share of surface delay-minutes:

| bucket | share | |
|---|---|---|
| intersection resolved | 57.4% | |
| station resolved | 17.9% | |
| landmark resolved | 1.3% | |
| loop (turnaround) | 3.0% | excluded, D-06 |
| garage / division | 1.8% | excluded, D-06 |
| **unresolved** | **18.7%** | the real gap |

**Raw coverage 76.6%** against the 66.1% baseline in E-D07; **addressable coverage 80.6%**
once non-rider locations are removed.

*Why it matters:* nearly 5% of surface delay is logged at garages and loops — places no
rider is ever waiting. Counting those as geocoding failures understates coverage;
counting them as covered would put phantom risk on the map. They are a third category,
not a gap (D-12).

The residual 18.7% is largely irreducible: `RENFORTH STATION` is a MiWay terminal absent
from TTC GTFS, and pairs such as `YONGE AND YONGE BLVD` cannot be told apart once
street-type suffixes are stripped. Pushing the matcher further trades false matches for
coverage, which P-08 forbids.

### E-D12 — Most of the bus network cannot be scored at stop-to-stop granularity
Built 18,840 surface segments across 233 routes; 6,511 have any attributed incidents.
Against the pre-registered confidence thresholds:

| | segments | share |
|---|---|---|
| high confidence (>=30 incidents) | 576 | **3.1%** |
| low confidence (>=5) | 2,703 | 14.3% |
| unknown (<5) | 16,137 | **85.7%** |

Surface attribution reaches 56.2% of delayed incidents and 53.9% of surface delay-minutes.

*Why it matters:* a stop-to-stop bus map is ~86% unknown. Honouring P-03 makes that
visible, which is correct but produces a mostly-hatched screen with known and unknown
segments alternating. This is the central open question for the interface, not a polish
item.

### E-D13 — Surface waits are roughly three times subway waits
Pooled wait once an incident occurs, terminal approaches excluded:

| | p50 | p90 | p95 |
|---|---|---|---|
| subway | 9 min | 17 min | 23 min |
| surface | 24 min | 59 min | **73 min** |

*Why it matters:* pooling these together — as the engine briefly did — shows a subway
rider percentiles drawn mostly from buses. It also sharpens E-D05 and PR-01: the network
carrying most of the delay is also the one where each incident hurts about three times as
much. Strong support for U-02 as the primary persona rather than U-01.

---

## Added 2026-08-28 (Toronto rider context)

### E-L10 — Two thirds of TTC riders are equity-deserving, and the inner suburbs are underserved
**66.6% of Toronto transit riders are equity-deserving**, and 71.9% of them live outside
the city's designated Neighbourhood Improvement Areas — concentrated in north Scarborough.
Scarborough's average transit access and connectivity score is **20.97 against 102.8** in
affluent neighbourhoods. Riders in these areas are disproportionately newcomers, racialized,
in precarious employment, and without access to a car.

Lower-income riders also **pay more per ride**, because they cannot front the cost of a
monthly pass. Cashless payment and app-based service isolate people who are unbanked or
have low digital literacy — including newcomers and older adults.
[Wellesley Institute](https://www.wellesleyinstitute.com/ttc/transit-access-and-affordability-an-equity-based-approach/) ·
[pointA](https://pointa.ca/2020/11/04/transit-inequity-who-gets-left-behind-when-neighbourhoods-arent-well-connected/) ·
[Scarborough Transit Action](https://www.scarboroughtransitaction.ca/transit-equity)

*Why it matters:* our modal rider is not a downtown professional choosing between transit
and Uber. It reorders the personas — and it puts a constraint on the product itself, which
currently assumes a smartphone, a data plan, and comfort with an analytics interface.

### E-L11 — Waiting is a physical risk for a third of the year
Toronto winters make an unexplained wait dangerous, not merely annoying. The city plans
**100 heated shelter kits over seven years**, targeted at high-ridership stops with *low
frequency*. During storms riders have been **stranded at stops for hours** with no service
and no communication. TTC staff see **30–60 unhoused people a day** sheltering in stations
in cold months, against 8–10 the rest of the year.

Our own data agrees on severity: ice and snow incidents average **68.8 minutes** against a
7.8-minute overall mean (E-D02).
[TTCriders snow plan](https://www.ttcriders.ca/snowplan) ·
[CTV](https://www.ctvnews.ca/toronto/video/2026/01/23/cold-weather-impacting-commute-for-ttc-transit-riders/) ·
[Global](https://globalnews.ca/news/10232210/ttc-rise-shelter-cold-snaps/amp/)

*Why it matters:* "your bus is 26 minutes away" is information in July and a safety
decision in January. The same number carries different stakes by season, and the interface
currently treats them identically.

### E-L12 — Toronto has almost no network redundancy
The TTC's own CEO describes the system as **"binary"**: if Line 1 or Line 2 goes down,
"pretty much you only have one option — shuttle buses." Shuttle buses cannot carry subway
volume, and there is no parallel downtown line. Weekend closures sometimes run with **no
shuttle service at all**.
[CBC](https://www.cbc.ca/news/canada/toronto/downtown-relief-line-would-have-made-difference-wednesday-morning-ttc-ceo-1.3610202) ·
[TorontoToday](https://www.torontotoday.ca/local/transportation-infrastructure/portion-line-1-subway-closed-weekend-no-shuttle-bus-service-11451891)

*Why it matters — this is the finding that most changes the product.* Toronto resembles
New York in density, commute length and transit dependence. It does **not** resemble it in
redundancy: New York has express and local tracks, parallel lines, and 24-hour service, so
a reliability tool there answers *"which of my options is best?"* Toronto usually has no
second option, so the same tool must answer a different question: **"is this trip viable,
when should I leave, and should I give up?"**

A reliability-aware *router* is a New York product. Toronto needs a reliability-aware
*forecast*. See D-13.

### E-L13 — One Fare removed the penalty for using GO as an alternative
Since February 2024 the **One Fare** program eliminated double fares between the TTC, GO
Transit and other GTA agencies, saving $3.30 per transfer and an estimated $1,600 a year
per rider.
[TTC](https://www.ttc.ca/riding-the-ttc/Updates/One-Fare-Program) ·
[Global](https://globalnews.ca/news/10316270/toronto-gta-transit-one-fare-monday)

*Why it matters:* in corridors GO actually serves, riders now have a genuine alternative
that used to cost extra. It is the one place where Toronto has meaningful redundancy — and
the one place where "go another way" is honest advice rather than a downtown assumption.

### E-D14 — Downtown is the one place with real alternatives, and its routes are the worst
Streetcar routes by rider-wait minutes: **504 King 105,302**, 501 Queen 103,678,
505 Dundas 79,223, 506 Carlton 74,073. Mean wait per streetcar incident is **32.1 minutes**
against 38.0 for buses — downtown is not spared, only differently shaped.

But alternative density differs sharply. Counting stops and distinct routes in equivalent
bounding boxes:

| | stops | distinct routes |
|---|---|---|
| Downtown core (King/Queen/Dundas) | 321 | **26** |
| Scarborough (Markham/Lawrence) | 131 | **17** |

Downtown also has walking and bike share as genuine substitutes for a 10–25 minute trip.

*Why it matters:* it qualifies D-13. The forecast framing holds citywide, but the core is
where "which option should I take" is a real question — so comparison is a **downtown
feature, not a citywide one**. It also gives U-05 its defining behaviour: the walk is
usually the decisive alternative, and a transit app willing to say "walk" earns more trust
than one that never does.

### E-D15 — The alerts feed already carries day-of disruptions, including elevator status
The GTFS-Realtime alerts feed (verified 2026-08-28, unauthenticated) carries ~34 live
alerts with full description text and affected route ids. Sampled content:

- **Detours:** "506 Carlton: Detour via Ossington Ave, Dundas St W and Bay St due to a
  blocked track."
- **Stop bypasses:** "16 Mccowan: Bypass near Scarborough Centre Station at Bus Bay 9 while
  we respond to a security incident." — the same incident appeared across **9 routes**,
  so alerts can be clustered into one rider-facing event.
- **Elevator outages:** "Cedarvale: Elevator 06-ELV-B out of service between platform and
  upper concourse while we perform maintenance."

*Why it matters, twice over:*

1. It is the data source for day-of routing — detours and bypasses change which segments a
   trip actually uses, today.
2. **It closes the U-04 data gap.** `D-07` committed to accessibility as a hard routing
   constraint and was recorded as blocked for want of a source. Elevator status is in a
   feed we already fetch. The gap was never data availability; it was that nobody looked.

*Caveats:* every alert reports `UNKNOWN_EFFECT` — the TTC does not populate the effect
enum, so severity must be classified from description text. `active_period` is empty, so
alerts carry no start or end. Header text is truncated around 30 characters; the
description is complete and is the field to use.

Planned subway closures and their shuttle buses are published as **web pages**, not as a
feed ([TTC closures](https://www.ttc.ca/service-advisories/subway-service)), so they need
scraping or manual entry — the one day-of input without a clean machine source.

### E-D16 — Segment geometry can be drawn on real streets for 99.6% of segments
GTFS publishes a `shapes.txt` polyline per trip that follows actual roads, but TTC leaves
`stop_times.shape_dist_traveled` empty, so there is no published link between a stop and
its position along that polyline. Projecting each stop onto the shape and slicing between
consecutive stops yields real street geometry for **18,897 of 18,982 segments (99.6%)**.

A first attempt reached only 50.4%, because it picked one representative shape per route.
A route publishes at least one shape per direction plus short-turn variants, so every
segment travelling the other way projected out of order and could not be sliced — almost
exactly the half that failed. Trying every shape the route uses, and keeping the tightest
successful slice, fixed it.

*Why it matters:* it is the difference between a map and a diagram. Straight lines between
stops cut through buildings and read as unfinished, and `D-14` commits to a map people
recognise.

### E-D17 — Step-free access is knowable from two feeds, and 16 stations are structurally excluded
GTFS `stops.txt` carries `wheelchair_boarding` for every stop (8,091 marked accessible,
1,311 not — no blanks), which gives a **baseline**: is the station built step-free? The
GTFS-RT alerts feed gives the **live** picture, naming outages in its description text
("Cedarvale: Elevator out of service between platform and upper concourse").

Resolved across 293 stations: **275 accessible, 16 structurally not accessible, 2 with a
live outage.** The structural list validates against reality — Museum, King, College,
Greenwood, Old Mill and Islington are genuinely among the TTC's non-accessible stations.

*Why it matters:* the two must not be collapsed. A station can be built accessible and be
unusable today; one is permanent and the other may clear within the hour, and a rider
deciding whether to travel needs to know which they are looking at.

**Known limit:** absence of an alert is not evidence an elevator works. The feed reports
outages it knows about, so `unknown` is treated as *not usable* rather than as fine (P-03).

### E-D18 — Long history predicts worse than recent history, and a third of the network has shifted
Two measurements, prompted by the observation that a transit network is not stationary —
service changes, reassignment, construction and nearby roadworks all move a segment's
behaviour.

**Predictive power peaks and then declines.** Holding out the last two months and testing
each lookback window on an identical segment set (n = 962):

| lookback | rho | | decay half-life | rho |
|---|---|---|---|---|
| 1 month | 0.375 | | 1 month | 0.503 |
| 3 months | 0.512 | | 2 months | 0.538 |
| 6 months | **0.530** | | **3 months** | **0.543** |
| 12 months | 0.519 | | 6 months | 0.535 |
| 17 months | 0.512 | | none (flat) | 0.512 |

Seventeen months of history predicts **worse** than six. Exponential decay beats every flat
window, peaking at a three-month half-life.

**The churn is large.** Comparing the archive's two halves on 3,210 comparable segments:
**35.9% changed by 2x or more, 18.5% by 3x.** The extremes are dramatic — one Sherbourne
segment 51x worse, one Exhibition-area segment 55x better.

*Why it matters:* it invalidated the flat all-history average the scoring engine used, and
the confidence thresholds built on raw counts. Thirty incidents from eighteen months ago is
not thirty incidents of evidence about next Tuesday, and calling that "high confidence" is
exactly the failure `P-08` exists to prevent.

**The honest cost:** taking recency seriously *reduces* what we can claim. Scorable segments
fall from 2,703 to 1,167 even after recalibrating the bar. 52 Lawrence West drops from 25
scored stretches to 7. We do not have as much recent evidence as raw counts implied — that
was always true; it was just hidden.

### E-D19 — Per-trip disruption risk is small, so the tail is the story, not the average
Scoring whole journeys required converting exposure (harm per *month*) into per-trip risk by
dividing by how often each segment is served. The result changes what the product can
honestly say.

For a Jane/Eglinton → Union trip, three routings:

| via | typical | when disrupted | disruption rate | coverage |
|---|---|---|---|---|
| 32 + 5 + 1 | 49 min | 73 min | **1 in 150 trips** | 67% |
| 935 + 2 + 1 | 49 min | 73 min | 1 in 99 | 90% |
| 935 + 2 + 510 | 69 min | 93 min | 1 in 147 | 45% |

**Expected added minutes is a useless number to show a rider.** At a 0.1–0.3% per-trip risk
it rounds to zero, and ranking on it is indistinguishable from ranking on the timetable.

**The same figure as a rate is both legible and discriminating.** "1 in 393 trips" versus
"1 in 1,236" is a threefold difference a rider can act on, and it matches how the risk
actually arrives: almost every trip is fine, and occasionally one costs you 24 extra
minutes.

*Why it matters:* it settles the framing for M9/M10. The product is not "this route is five
minutes slower on average" — that claim is false. It is **"this route goes wrong three times
as often, and when it does it costs you 24 minutes."** Which is also exactly what `P-01`
asks for: a distribution, not a point estimate.

**A correction worth keeping.** The first run of this measurement reported 10–11% coverage
and blamed `D-19` for thinning the evidence. That was wrong, and the diagnosis was lazy: a
funnel over the actual journeys showed **65% of segments were failing a frequency lookup**,
not failing for want of data. Subway segments store station names with null stop ids, while
the frequency map was keyed on GTFS stop ids — the same name-versus-id mismatch already
handled in the segment lookup and forgotten here. Every subway segment silently dropped out
of scoring.

Fixed, coverage is **45–90% per journey**, and the residue is genuine: 17% of segments have
no logged incident at all and 10% sit below the confidence bar.

*The lesson:* "the data is thin" is a comfortable explanation and was, here, a bug wearing
a plausible story. Measure the funnel before believing it.

### E-D20 — Risk really does vary by time of day, and it is not the pattern anyone expected
*Measured 2026-08-29 · `npm run audit:timeofday` · thresholds pre-registered in `src/audit/time-of-day.ts`*

The scoring model divides incidents by trips across the whole service day, so an 08:30
departure is quoted a figure that includes 23:00 running. The concern was that peak would be
much worse than the pooled average and riders were being told a number diluted by hours they
never travel in.

**Peak is barely worse. Two of the five bands are better than the pooled figure.**

| Band | segments | median ratio to pooled | ≥1.5× | ≤0.67× |
|---|---|---|---|---|
| am peak (06–09) | 134 | **0.83** | 11.2% | 31.3% |
| midday (09–15) | 357 | 1.01 | 8.1% | 16.0% |
| pm peak (15–19) | 229 | **1.08** | 10.5% | 14.4% |
| evening (19–24) | 237 | 0.88 | 9.7% | 28.7% |
| night (00–06) | 34 | **0.78** | 8.8% | 44.1% |

A commuter planning an AM-peak trip is currently quoted a figure about 20% *worse* than
their actual exposure. PM peak is the only band worse than the average, and only by 8%. The
intuition that a late-night run flatters the number is backwards: per trip, night is the
safest band measured. More incidents happen at peak, but far more trips run at peak, and
risk is a ratio — both sides move together and mostly cancel.

**The real effect is dispersion, not a peak curve.** 31.2% of segment-band pairs sit at least
1.5× away from their segment's pooled figure, against a pre-registered bar of 25%. Segments
have individual time patterns; there is no single network-wide shape to apply.

**And that dispersion persists.** Split-half rank correlation across 953 segment-bands gives
**rho = 0.406**, above the pre-registered 0.3. This test decides the finding: with three
expected incidents in a band, Poisson noise alone throws ratios of 0.5 and 1.5 around
freely, so a wide spread is exactly what pure chance looks like. Severity showed the same
dispersion and rho = 0.10, and `D-11` pooled it rather than fit noise. This one is real.

**What conditioning would cost.** Only **378 of 1,173** scorable segments (32.2%) have any
band carrying enough exposure to score on its own. Night has 34. So conditioning cannot
replace pooling — it can only refine it where the sample reaches, which is the tension
`D-19` already created by decaying old evidence.

> **A methodological correction, kept visible.** The first run gated each band on *observed*
> incidents, so a band only appeared if it had accumulated some. Quiet bands were dropped and
> every surviving band came out worse than pooled — the median ratio was above 1.0 in all
> five, which is impossible for a trip-weighted decomposition and was the tell. Gating on
> *expected* incidents instead keeps the quiet bands, and an observed zero where three were
> predicted becomes evidence of lower risk rather than absence of evidence. The biased run
> would have reported night at 1.87× and confirmed the original hypothesis.

### E-D21 — A typical trip, so a rider can tell whether theirs is bad
*Measured 2026-08-29 · `npm run benchmark` · 2,400 sampled journeys, thresholds in `src/benchmark/table.ts`*

Q-C asks whether our units mean anything to a rider. "Goes wrong 1 trip in 197" does not,
on its own. This is the reference that turns it into a judgement.

O/D pairs are drawn from boardable stops in proportion to the service that runs there, with
a target separation, and planned at four times of day. Trips are compared only against
others of similar duration.

**All-day disruption risk, by trip length:**

| Length | n | p25 | median | p75 |
|---|---|---|---|---|
| under 20 min | 280 | 1 in 1429 | **1 in 833** | 1 in 476 |
| 20–35 min | 514 | 1 in 417 | **1 in 270** | 1 in 172 |
| 35–50 min | 591 | 1 in 182 | **1 in 137** | 1 in 108 |
| 50–70 min | 675 | 1 in 116 | **1 in 92** | 1 in 78 |
| over 70 min | 340 | 1 in 81 | **1 in 71** | 1 in 64 |

Length dominates: a typical 90-minute trip goes wrong about **twelve times as often** as a
typical 15-minute one. That is why the reference class is trip length — ranking a long trip
against a short one would tell a rider that long trips are badly run, which is not a fact
about the routes they chose.

Within a bucket the spread is real: p25 to p75 is roughly threefold, so a trip can be
meaningfully better or worse than typical without the comparison saturating.

> **The first build ranked every real trip in the worst tenth of its class, and the reason
> was our own data.** The sampled reference had a **median coverage of 0.23** — three
> quarters of a typical reference trip was unmeasured, so its risk came out near zero, and
> anything measured properly looked terrible beside it. This is `P-03` at the reference-class
> level: absence of data reading as good news, one layer above where that rule is usually
> applied. Requiring coverage ≥ 0.5 on both sides moved the 20–35 minute median from
> 1 in 769 to 1 in 270 and gave percentiles that spread from 0.03 to 0.68 across real trips.
>
> A second correction: the first sampler drew stops uniformly, which filled the reference
> with quiet suburban stops nobody starts from and ranked an ordinary downtown hop below 99%
> of its class. Weighting by departures is the closest thing to ridership in the open data.

**Rank alone is not a verdict.** Comparable trips cluster tightly enough that a trip 15%
riskier than the median can sit below 86% of its class. Printing "riskier than most trips
this long" beside "1 in 218, typically 1 in 250" reads as overselling a rounding difference,
and a rider who checks our arithmetic and finds it strained stops believing the rest (PR-08).
A verdict now needs an unusual rank **and** a ratio of at least 1.25 against the typical
trip; otherwise the honest answer is that the trip is ordinary.

### E-D22 — Four synthetic testers found eleven defects, most in the places we reasoned hardest
*2026-08-29 · four Sonnet agents driving the running app through `scripts/drive.mjs`*

Four agents were given personas deliberately **outside** U-02, U-04 and U-05 — a visitor with
no Toronto vocabulary, a parent with a stroller and a soft step-free preference, a hospital
cleaner on rotating night shifts, and a sceptic checking whether the numbers hold together.
None was shown the persona docs. The point was independence: to find what the design assumes
because of *who we chose to design for*.

**What this is not.** These are not riders, and nothing here touches `D-08`. An agent playing
a Toronto commuter produces plausible reactions from training data, and treating that as
validation would be filling a data gap with a plausible estimate — the thing `P-03` forbids.
Every finding below is a defect reproducible from the app's own output, not an opinion about
how anyone feels. Where the agents offered usability reactions, they labelled them, and those
are recorded as questions rather than findings.

**The blocker.** Loosening a deadline could turn a working trip into "no journey". Arriving
by 03:34 found an overnight bus; arriving by **03:34:01** found nothing, and the whole
03:34–06:00 range was dead on a route with service. The arrive-by search looked back a fixed
three hours from the deadline, so a departure further back than that fell out of the window.
A later deadline is a strictly weaker constraint and must never return fewer options.

**Ten more, verified and fixed:**

| | Found by | Defect |
|---|---|---|
| 1 | night shift | Deadline monotonicity, above |
| 2 | visitor | `contains` matched mid-word: "CN" → M**cN**icoll Ave, 25 km away, offered as the top hit |
| 3 | visitor, parent | Default time read the device clock, not Toronto's — three hours out for a visitor |
| 4 | sceptic | An option that misses the deadline was still offered a buffer, with its everyday shortfall folded in: "34 min late" then "leave 93 min earlier to cover that", where 34 of the 93 were owed daily |
| 5 | sceptic | "Leave 07:37 to cover **that**" was sized to the 90th-percentile bad morning while "that" named the median one — 59 minutes against 24 |
| 6 | sceptic | `disruptionRisk` stored at four decimals fed the benchmark while the displayed rate used full precision: "1 in 1323" ranked as 1 in 1250 |
| 7 | parent | `blockedStations` was every inaccessible station in the city, identical on every trip, behind a comment promising "what that cost them" — and unwired to the interface |
| 8 | parent | Flipping step-free and seeing nothing change was indistinguishable from a broken toggle |
| 9 | parent | "3 ways to make this trip" counted options arriving after the deadline |
| 10 | sceptic | A route partly out of service carried the same visual weight as thin history |
| 11 | night shift | Times crossing midnight printed "23:33 → 00:22" with nothing marking the next day |

**What survived checking.** The sceptic verified that per-leg risks compose into the trip
figure exactly, that zero-coverage never fabricates a rate, that the time-of-day toggle moves
rate, percentile and verdict consistently across eight pairs, and that dominance uses the
runner-up ratio rather than the share test corrected earlier. The night tester found no
service-day time leaking to screen and no unmeasured stretch drawn as measured.

*Why it matters:* six of the eleven are in code written carefully, argued through the
foundation, and covered by tests — the buffer arithmetic, the benchmark's precision, the
step-free reporting. Tests written by the same reasoning that produced the code cannot catch
the reasoning being wrong. Four cheap outside readers could.

> **The finding underneath the findings.** Two of the eleven exist because every persona in
> this project knows Toronto. Landmark search and device-versus-local time were never
> considered, not because they were judged and dropped, but because nobody in `04-personas.md`
> would ever hit them. That is what a persona set costs when it is never checked against
> anyone outside it — which is `D-08`, again.

### E-D23 — A third of all rider-waiting is a vehicle that never comes
*Measured 2026-08-29 · `src/domain/vanishing.ts`*

Every reliability figure in this app had been one undifferentiated number: how often a trip
"goes wrong". Two failures hide inside it, and a rider mitigates them differently. A *late*
vehicle arrives eventually and waiting works. A vehicle that is **cancelled, sent on
diversion, taken away to run a shuttle, or never staffed** does not arrive at all, and waiting
does nothing.

Splitting the archive on the TTC's own codes:

**36.1% of all rider-waiting is a vehicle that never came** — 40,012 of 110,771 minutes a
month.

**It is not a night-time problem.** The share is flat across the day, which was the opposite
of the expectation that prompted the measurement:

| Band | never came | all waiting | share |
|---|---|---|---|
| am peak | 5,703 | 15,004 | 38.0% |
| midday | 11,802 | 33,249 | 35.5% |
| pm peak | 9,905 | 27,119 | 36.5% |
| evening | 8,382 | 22,634 | 37.0% |
| night | 4,221 | 12,764 | 33.1% |

**It varies enormously by route, and that is where the value is.**

| Route | share of waiting where the vehicle never came |
|---|---|
| 31 Greenwood | **74%** |
| 33 Forest Hill | 71% |
| 65 Parliament | 71% |
| 120 Calvington | 68% |
| 75 Sherbourne | 64% |
| 510 Spadina | 17% |
| 512 St Clair | 9% |
| Line 1, Line 2 | **0%** |

Trains are late; buses disappear. On the 31 Greenwood, three quarters of the time a rider
spends waiting is for a bus that was never going to arrive.

*Why it matters:* it changes the advice, not just the number. On a route where waiting works,
the answer is to leave earlier. On the 65 Parliament it is to have a second plan. No public
tool distinguishes these, and riders describe the second one to each other constantly —
"sometimes the bus just doesn't come" — without any way to know which routes do it.

> **What this is not.** It is not a safety measure, and it is not evidence about personal
> safety at any hour. `PR-11` is marked `OUT` precisely because we cannot measure or predict
> that, and a route labelled "safer" from delay data would be a claim the data cannot carry.
> What the flat night figure does say is that an open-ended wait is no more likely after dark
> than at noon — the wait itself is what changes meaning at 2am, which is `PR-13`, and the
> product's job there is to make the wait legible, not to grade the street.

### E-D24 — Night is not riskier; it is emptier, and that is a different problem
*Measured 2026-08-29 · `npm run audit:headway` · thresholds pre-registered in `src/audit/headway.ts`*

`E-D23` closed by saying an open-ended wait is no more likely after dark than at noon, and
that what changes at 2am is the wait itself. This measures the wait.

Every segment-band's scheduled headway, weighted by the departures that run on it — so
frequent service counts for as much as riders use it. Departures stand in for ridership,
which the open data does not publish; the benchmark makes the same substitution.

**Across the weekday, the median headway behind a departure is exactly 10.0 minutes** — the
TTC's own frequent-service standard. A quarter of departures are on service running every
20 minutes or worse; a tenth on service at 27.7 minutes or worse.

| | p25 | p50 | p75 | p90 |
|---|---|---|---|---|
| headway behind a departure | 7.7 min | **10.0 min** | 18.9 min | 27.7 min |

**The day is not evenly served, and the gap is not where the risk is.**

| Band | departures | at or above 20 min | share |
|---|---|---|---|
| night (00–06) | 152,563 | 113,359 | **74.3%** |
| am peak (06–09) | 197,387 | 29,394 | 14.9% |
| midday (09–15) | 339,985 | 66,679 | 19.6% |
| pm peak (15–19) | 260,596 | 36,978 | 14.2% |
| evening (19–24) | 250,003 | 53,177 | 21.3% |
| **all day** | **1,200,534** | **300,587** | **25.0%** |

Three quarters of night service runs at 20 minutes or worse, against roughly one seventh at
peak — a five-fold difference in what one vehicle failing to arrive costs.

*Why it matters:* it separates two things this project had been running together, and
corrects a framing error made in this session. `E-D20` measured night as the **safest** band
per trip (0.78× pooled); `E-D23` measured never-came as **flat** across the day and lowest at
night (33.1%). Both are about how often something goes wrong. Neither says anything about
what it costs, and the cost is where night is different: the same failure that costs a peak
rider seven minutes costs a night rider half an hour. A night feature justified on *risk*
would have been building against the evidence. One justified on *headway* is building with it.

It also settles `D-34`'s threshold on measurement rather than taste. Ten minutes — the TTC's
published standard, and the obvious candidate — is the median, so a tag drawn there would
appear on half of all service and mean nothing. Twenty fires on a quarter, and on three
quarters of the night.

*Standing caveat:* this is the timetable, not the street. It says what the schedule promises
between vehicles, which is exactly why it can be stated as a fact — and it is silent on
whether the stop has a shelter, which Toronto is addressing at a rate of 100 kits over seven
years (E-L11) and which we do not ingest.

### E-D25 — The computation was fast; the delivery was not
*Measured 2026-08-29 · Chromium under CDP network throttling, and per-endpoint on the API*

Responsiveness had never been measured. Every number below is from the built app, not an
estimate.

**Nothing was compressed.** No compression plugin was registered, so every response —
including the 1.16 MB JavaScript bundle — went out raw. Serving the production bundle through
a throttled browser, both ways:

| Connection | as shipped | with gzip |
|---|---|---|
| fast 4G (8 Mbps) | 1,491 ms | **494 ms** |
| slow 4G (1.5 Mbps) | 7,116 ms | **2,192 ms** |
| 3G (0.5 Mbps) | 20,897 ms | **5,942 ms** |

Per endpoint: `/plan` 185 KB → 20 KB, `/routes/ranking` 120 KB → 12 KB, the map style
43 KB → 3.8 KB, a vector tile 78.8 KB → 56.9 KB.

**A third of the `/plan` response was never read.** The handler spread the whole scored
journey, which carried `path` — 18.5 KB per journey, four journeys, **74 KB of 185 KB** that
the browser ignores; it is not even declared in the client's own type. `geojson` is built
*from* `path`, so the same geometry shipped twice in two encodings. Coordinates also carried
fourteen decimal places, which is sub-micron.

**Two cold starts landed on riders, not on the platform.** The journey graph built lazily on
the first `/plan`, so the first rider after a deploy waited **12.3 s**. Warming the graph
alone moved the cliff rather than removing it — the first plan still took **2.89 s**, because
the pooled-severity scan (85,000 rows) and the latest-observation lookup are lazy too. The
route ranking was a third: 1.09 s cold, 3 ms after.

Where the cold start goes:

| phase | ms | share |
|---|---|---|
| `buildConnections` (1.2 M connections from a 207 MB CSV) | 13,898 | **74%** |
| `buildFrequency` | 2,100 | 11% |
| `prisma.segment.findMany` | 1,843 | 10% |
| `prisma.stop.findMany` | 934 | 5% |
| `buildFootpaths` | 41 | 0.2% |

**What was already fast, and stayed:** warm `/plan` 72–95 ms, stop search 8–13 ms, route
ranking 3 ms cached, the routing scan itself 6–12 ms.

**After the fixes (D-36, D-37), measured the same way:**

| | before | after |
|---|---|---|
| first paint, slow 4G | 7,116 ms | **2,138 ms** |
| first paint, 3G | 20,897 ms | **5,941 ms** |
| `/plan` on the wire | 185,137 B | **13,590 B** |
| first `/plan` after a deploy | 12.3 s | **102 ms** |
| boot → healthy | 4 s, then a rider paid 12.3 s | **3.1 s**, paid by the platform |
| runtime data | 298 MB | **113 MB** |

The cold start was attacked at its cause: serialising the connection set as typed-array
buffers turns 13.9 s of CSV parsing into a 0.15 s file read, and removes `stop_times.txt`
from the runtime image entirely. The cached set was verified byte-identical to the parsed one
across all ten fields.

*Why it matters:* the engine was never the problem. Every cost a rider actually felt was in
delivery — bytes on a wire and work deferred onto the first person to ask for it. `U-02` is
standing at a stop in winter on whatever signal the shelter gets, and `PR-14` records that
66.6% of TTC riders are equity-deserving and pay per ride because they cannot front a monthly
pass. Seven seconds of blank screen, and a quarter-megabyte of their data, are product
failures rather than engineering details.

## Added 2026-09-01 (what a transfer costs)

### E-D26 — A transfer is priced at the stop and nowhere else
*Measured 2026-09-01 · `npm run audit:transfers` · thresholds pre-registered in `src/audit/transfers.ts`*

`PR-05` has said since the first pass that each transfer is a fresh chance to miss a
connection and that variance compounds rather than averages out. `D-34` acted on half of
it — every wait now carries the headway behind it, so a rider standing at a stop can read
what one no-show costs. Nothing acted on the other half: whether a trip carrying three of
those should rank below a trip carrying none. This measures the planner's own output, at the
benchmark's four departure times and with its service-weighted origin draw, so the sample
describes the trips a rider is offered rather than the shape of the graph.

**400 trips, 1,089 connections. 88.5% of top-ranked results carry at least one transfer.**

**1. A transfer contributes nothing to the risk number.** This is structural, not
statistical. `composeRisk` is `1 - Π(1 - risk)` over the *segments a journey rides*
(`itinerary.ts`). Connections are not terms in that product. Two journeys over identical
segments score identically at zero transfers and at three. Whatever the number on the card
means, it does not mean "and this many chances to miss a connection".

**2. The connections it picks are tight, and one in ten has no slack at all.**

| scheduled slack at a connection | p10 | p50 | p90 |
|---|---|---|---|
| minutes | **0** | **2** | 6 |

**111 of 1,089 connections (10.2%) are scheduled at zero minutes** — step off, step on. This
is not a defect so much as the objective working as written: Connection Scan minimises
arrival time, which is precisely the criterion that selects the tightest legal transfer
available, and `MIN_TRANSFER_S = 60` puts "legal" one minute above impossible.

**55 connections, on 52 trips (13.0%), are tight *and* exposed** — two minutes or less of
slack onto service running at 20 minutes or worse, the threshold `E-D24` already audited for
`D-34`. Miss one of those and the trip grows by more than the entire margin the ranking was
optimising.

**3. The ranking hypothesis did not survive its own test.** The pre-registered claim was that
the sort — `durationMinutes + expectedAddedMinutes`, where the second term measured 0.03–0.09
minutes on live trips — is transfer-blind in practice, and would be shown so if it preferred
the transfer-heavier journey on more than 90% of trips where a simpler alternative existed.

**It preferred it on 73.1% (98 of 134). The test passes; the ranking does discriminate.**

Recording the failure because the first version of this finding was wrong in a way worth
keeping visible. A throwaway script reported 46 of 46 — apparent unanimity — and it was
tautological: the counter for "had a simpler option" and the counter for "chose the transfer
anyway" were incremented on the same line, so the ratio could only ever be 1.0. The number
was not measured, it was constructed. The pre-registered audit is the only reason that did
not become a decision.

**4. Reported risk rises with transfer count, and the opposite was expected.**

| transfers | n | median 1 in N | median coverage |
|---|---|---|---|
| 0 | 46 | *unmeasured* | **0.00** |
| 1 | 123 | 1 in 1,206 | 0.13 |
| 2 | 119 | 1 in 598 | 0.18 |
| 3 | 67 | 1 in 355 | 0.20 |
| 4 | 33 | 1 in 281 | 0.32 |
| 5 | 9 | 1 in 146 | 0.26 |
| 6 | 3 | 1 in 145 | 0.10 |

The suspicion going in was that unknown legs enter `composeRisk` as `risk = 0` — a perfect
leg — and that since more transfers means more thinly-covered surface legs (`E-D12`), the
composed number would quietly fall as trips got more complex. It does the reverse: more
transfers means more segments means more risk terms, and coverage *rises* with transfer count
rather than falling. A single anecdote suggested otherwise and the population does not.

The unknown-as-zero mechanic is still real — an unscored leg genuinely is indistinguishable
from a perfect one inside that product — it simply is not what drives this comparison.

**The row that should be read twice is the first one. A zero-transfer trip has median
coverage 0.00** — the direct single-route journey is usually a surface route we cannot score
at all, so the simplest trip on offer is the one we know least about. That is `P-03`
territory and it is not what the transfer question was looking for.

*Why it matters:* the useful finding is the narrow one. The ranking is not blind, and the
risk model is not biased toward complexity — but **59.2% of the time it prefers the
transfer-heavier journey, it buys less than one minute** (58 of 98; median saving across all
98 is 0.0 minutes, p90 11.9). Expected cost ties, and nothing breaks the tie, so a rider is
handed an extra connection — 13% of the time a two-minute step onto twenty-minute
service — in exchange for nothing measurable. That is a tiebreak that was never specified,
not a weighting that was got wrong, and it is a far smaller claim than the one this
investigation started with.

*Standing caveat:* that 59.2% figure was counted after the distribution had been seen. It
carries no verdict in the audit and decides nothing on its own; a decision resting on it
needs its own threshold registered before the next measurement.

### E-D27 — How much choice exists, and what a wider search buys
*Measured 2026-09-01 · in-process against the planner · seed 20260901, the benchmark's
service-weighted origin draw and four departure times, 300 trips per configuration*

`D-14` says the router **adapts its answer to how much choice actually exists**, and
`D-13`'s surviving note says comparison is a downtown feature. Neither had been measured.
The question is whether a "fastest / most reliable" split is a real distinction or two
labels on the same journey.

Comparisons use the project's own bars: `MIN_COMPARABLE_COVERAGE` (0.5) to decide a journey
can be compared at all, and `MATERIAL_RATIO` (1.25) to decide a difference is worth acting
on. Both were set for other purposes before this question was asked.

**Citywide, the split is almost never real.**

| | citywide | downtown core |
|---|---|---|
| trips with ≥2 comparably-measured options | 15.3% | **38.3%** |
| fastest is not the most reliable | 5.3% | **21.7%** |
| …and the gap clears `MATERIAL_RATIO` | **1.3%** | **12.3%** |
| …and costs ≤5 extra minutes | 0.3% | **8.0%** |
| risk ratio when they differ (p50) | 1.13× | **1.34×** |

Downtown is the King/Queen/Dundas box from `E-D14`, 516 boardable stops. A permanent
"most reliable" badge would sit on the same card as "fastest" on roughly 95% of citywide
trips, and where it differed the gap would be below the project's own materiality bar four
times in five — the median 1.13× against a 1.25 threshold. Downtown it is a real feature:
one trip in eight has a materially safer option and one in twelve has one costing five
minutes or less.

**This reproduces, from data, a claim the foundation had only ever asserted.** `E-L12` took
"Toronto has no redundancy" from the TTC CEO's own words. The rate at which a second
genuinely different option exists is nine times higher downtown than citywide, which is the
same statement measured rather than quoted.

**A stronger search helps, and is not what was limiting.** The generator banned each of the
first three routes the best journey used, all from one starting point, so every alternative
was one edit away. Replacing it with branch-and-ban to depth two, then returning the most
route-diverse subset, was swept over pool width:

| pool / returned | journeys | search ms (p50) | ≥2 comparable | material | and ≤5 min |
|---|---|---|---|---|---|
| 4 / 4 *(before)* | 3.42 | 18.6 | 15.3% | 1.3% | 0.3% |
| **6 / 4** | **3.76** | **31.8** | 15.3% | **2.3%** | **1.0%** |
| 8 / 4 | 3.76 | 43.3 | 13.0% | 2.0% | 0.7% |
| 12 / 4 | 3.76 | 54.8 | 11.3% | 2.0% | 0.7% |
| 6 / 6 | 5.07 | 31.9 | 19.3% | 2.0% | 1.0% |

**Searching wider makes it worse past six, which was not the expectation.** A deeper pool is
mostly journeys reached by banning two routes at once; they crowd out the single-ban
alternatives a rider would actually consider, so the diversity pick has more to choose from
and chooses less well. Twelve costs 23 ms more per request to find a materially safer option
*less* often than six.

**The binding constraint is coverage, not search.** At every pool size the median trip has
**zero** candidates clearing the comparison bar. That is `E-D12` — 3.1% of segments at high
confidence — arriving at the journey level. Doubling the search doubles a rate that starts
near one percent; it cannot manufacture a comparison out of segments that were never scored.

**What the change cost**, measured end to end on 138 live trips through the server:

| | before | after |
|---|---|---|
| journeys returned (mean) | 3.57 | 4.14 |
| `/plan` latency p50 / p90 | 60.5 / 102.3 ms | 84.7 / 124.2 ms |
| response JSON p50 / p90 | 69.3 / 138.0 KB | 91.8 / 149.2 KB |

24 ms and 22 KB, spent against the budget `D-36` had just recovered. Gzipped the sampled
trip is 8.8 KB, still inside `E-D25`'s 13.6 KB, so the delivery win survives — but the
endpoint is measurably slower and the trade is recorded rather than absorbed. See `D-39`.

*A wrong turn worth keeping.* The first implementation generated a pool of twelve on the
assumption that a scan is cheap — it is, on the short trips it was timed against, and is not
on the long ones a citywide sample is full of. That version measured **125.6 ms** p50, worse
than simply returning six. "The search is cheap so search more" was a plausible story that
one measurement removed, which is the same lesson `E-D19` records about coverage.

### E-D28 — A percentage would round the whole product to zero
*Measured 2026-09-01 · 770 scored journeys from the citywide sample*

`Q-C` asks whether our unit vocabulary means anything to a rider, and "1 trip in 1,206" is
the most-questioned number on the screen. The obvious alternative is a percentage. It is
strictly worse, and by a wide margin.

| per-trip disruption risk | p10 | p50 | p90 |
|---|---|---|---|
| as a rate | 1 in 2,326 | 1 in 459 | 1 in 106 |
| as a percentage | 0.043% | **0.218%** | 0.940% |

**74.4% of scored journeys would display as "0%"** at whole-percent precision, and 12.6%
still read "0.0%" at one decimal. The entire discriminating range of the product sits inside
the first percent, so the unit a rider finds most familiar is the one that destroys the
signal. This is the same finding `E-D19` recorded against *expected added minutes* — at a
0.1–0.3% per-trip risk it rounds to zero — arriving for a second candidate unit.

**The complaint behind the question still stands.** "1 in 1,206" is legible in the sense that
it discriminates and illegible in the sense that nobody knows what to do with it. One reframe
keeps the discrimination and changes the frame of reference from trips to the rider's own
calendar: at ten trips a week, the same rates read as

| | p10 | p50 | p90 |
|---|---|---|---|
| once every… | 2.5 months | **10.6 months** | 54 months |

That spread is wide enough to act on, needs no new data, and invents nothing — it is the
measured rate divided by a *stated* trip frequency rather than an assumed one. It does
import an assumption about how often the rider travels, which is why it is a question for
`D-08` and not a decision to take here. See `D-41`.

## Added 2026-09-02 (the realtime feed, and what the upgrade cost)

### E-D29 — The realtime feed is a different identifier space, and the join fails silently
*Measured 2026-09-02 · `bustime.ttc.ca/gtfsrt/{trips,vehicles}` against the loaded static GTFS*

`J-02` ("is it coming?") and `J-03` have been blocked on "GTFS-RT trip updates and vehicle
positions are not fetched at all" since the gap was first written. That description was
wrong in a way that mattered: **both feeds are public, live and fetchable.** `trips` returns
2,301 trip updates (723 KB) and `vehicles` 127 KB of positions.

They cannot be joined to our schedule.

| | feed | static GTFS | overlap |
|---|---|---|---|
| trip ids | 2,301 | 138,036 | **1** |
| stop ids | 8,626 | 9,402 | 5,116 — *coincidental* |
| route ids | 181 | 235 | **180 (99%)** |

**The stop overlap is the dangerous number.** 59% of the feed's stop ids exist in our stop
table, so the obvious join returns rows. It returns the *wrong* rows: feed stop `6857` yields
routes 21, 939 and 996, while GTFS stop 6857 is *Queen St West at Triller Ave*. Those are
Scarborough routes. A stop-level arrivals board built on that join is confidently wrong at
more than half of all stops, and nothing about it looks broken.

Trip ids settle it — the feed's are negative hashes (`-1092852660`), the schedule's are
sequential (`50790576`). One id in 2,301 matches, which is noise. `bustime.ttc.ca` is a
BusTime deployment with its own internal identifiers; the static feed is Toronto Open Data.

**Route ids do match, 180 of 181.** So the feed answers *"is this route running right now"* —
which `E-D23` says is the question that matters, since 36.1% of all rider-waiting is a
vehicle that never came and 74% of it on the 31 Greenwood. It does not answer *"when is the
next one"*, and no amount of care makes it.

*The one remaining path is spatial* — match vehicle positions to the nearest GTFS stop. That
is inventing the mapping, which is what `P-03` forbids and what `PR-08` records riders have
already learned to distrust. Not taken.

*Why it matters:* a standing gap described as "we do not fetch it" is a scheduling problem. A
gap described as "the two feeds do not share identifiers" is a data problem with a known
shape, and it tells the next person what to look for — a crosswalk table, which neither
publisher provides today. `D-47` records what was built on the half that does join.

### E-D30 — The upgrade cost 438 ms of first paint, and the font is 64 ms of it
*Measured 2026-09-02 · Chromium under CDP throttling, `E-D25`'s profiles, three runs each*

`D-43` self-hosts Manrope and names its own kill condition: first paint on slow 4G must not
regress past `D-36`'s 2.2 s. It has.

| | E-D25 (2026-08-29) | now | verdict |
|---|---|---|---|
| fast 4G (8 Mbps) | 494 ms | 772 ms | — |
| **slow 4G (1.5 Mbps)** | **2,138 ms** | **2,576 ms** | **kill condition fired** |
| 3G (0.75 Mbps) | 5,941 ms | 4,728 ms | improved |

**The font is not the cause.** Blocking the woff2 and re-running gives 2,516 ms against
2,576 ms with it — **64 ms**, for one 24.8 KB variable file covering all five weights. The
other ~374 ms is everything else the upgrade added: a second and third surface, the verdict
card, the confidence pair, the hour strip, the states, and 83 KB more CSS. Reverting `D-43`
would recover 64 ms of a 438 ms regression and cost the type system.

**The obvious remedy was tried and reverted.** MapLibre is 985 KB of a 1.17 MB bundle and is
not needed to draw the sheet, so the map was moved behind a dynamic import. First paint on
slow 4G fell to **1,192 ms** — better than the figure `E-D25` set. It also broke the map:
Vite stopped emitting the renderer's web worker at the path MapLibre requests, and the
documented symptom followed exactly — *the canvas stays blank and nothing throws on the main
thread*. `setWorkerUrl` with `?worker&url` cleared the 404s and the map still did not draw;
rendered features fell from 5 to 4 and walks from 1 to 0. Reverted, because `D-14` calls the
map the product's retrieval mechanism and a blank one is not worth 1.4 s.

*Why it matters:* the budget is breached and the cheap explanation is wrong. Anyone reading
"first paint regressed after a font was added" would revert the font, recover 64 ms, and
still be over. The real fix is splitting the map bundle, which is a known win of ~1.4 s
blocked on one piece of worker plumbing — a much better-specified task than "make it faster".

### E-D31 — The first and last mile were invisible, and cost six minutes on a plain trip
*Measured 2026-09-02 · Toronto One Address Repository via CKAN, against the loaded schedule*

The planner took GTFS stop ids, so a trip began wherever the rider had already walked to.

**525,470 address points ingested, 0 skipped.** The source CSV is 183 MB and 34 of its 38
columns describe the address *record* rather than the place; four are kept. The database grows
from 62 MB to **92 MB**, which is a real cost against `E-D25`'s runtime-data figure and is
carried openly.

**487 Lauder Ave → 100 Queen St W**, 08:30 on a weekday:

| | |
|---|---|
| ride only | 37 min |
| **door to door** | **43 min** |
| walk in | 4 min, to Oakwood Ave at Jesmond Ave |
| walk out | 2 min, from Bay St at Hagerman St |

Six minutes, on a trip with a subway leg in the middle of a dense city. It will be worse
where `U-02` lives: `E-L10` puts Scarborough's transit access score at 20.97 against 102.8 in
affluent areas, and a lower score is partly a longer walk to the stop.

**The nearest stop is not the right stop.** Multi-origin seeding chose **Oakwood Ave at
334 m** over **Dufferin St at 289 m** — 45 m further, because the service there leaves sooner.
Snapping to the nearest stop, which is the obvious implementation, would have put the rider on
a route going the wrong way. Planning cost 11.7 ms.

**A near-miss worth keeping.** The first key reused `streetTokens` from `streets.ts`, which
strips N/S/E/W *anywhere* in a name because that is correct for matching an intersection. It
keyed "North Queen St" as `QUEEN`, so **"100 Queen St West" resolved to 100 North Queen St** —
a different street 12 km away, returned with no sign anything was wrong. Address matching now
has its own key that keeps every word and treats a *trailing* direction as identity. Caught by
testing a landmark whose location is known, which is why the test suite now contains it.

*Why it matters:* the honest door-to-door number is the one a rider plans against, and it was
never on screen. It also sharpens `F-03`: walk-or-wait compared two *stops* when the real
comparison is between two *doors*.

### E-D32 — Planning to a door exposed three defects, and one of them was the headline
*Found 2026-09-02 by reading a returned trip · College St at Elizabeth St → 487 Lauder Ave, 17:45*

`D-48` let a rider plan to an address. The first trip anyone looked at was wrong in three
separate ways, none of which any test caught.

**1. The arrival time excluded the walk it had just added.** The card read *"There by 18:17"*
on a trip whose final walk ended at **18:21**. The verdict, the benchmark and the option cards
were all still stop-to-stop while the sheet above them advertised "door to door". The feature
existed to correct exactly this number and did not reach it.

**2. The last mile was two walks with a two-minute bus ride between them.** Walk 1 min, wait
2, ride the 90 for 2, walk 3 — then walk 4.5 more from the stop the journey ended at.
**Twelve and a half minutes to cover what is a twelve-minute walk from Oakwood Station.** The
bus saved nothing.

**3. The cause was a shortlist, not the routing.** `accessStops` returned the **six nearest**
stops. For this door, 75 stops sit within the 1.2 km radius and the six nearest are all the
same two bus routes 289–356 m away. Every station is excluded — **Fairbank ranks 42nd,
Oakwood 54th** — so the planner could not consider alighting from the train and walking. It
was forced onto the 90. The comment justifying the limit said "beyond a handful they are the
same corner twice", which is true of the nearest six and false of the set that matters.

**What changed, and what it did not fix.** Raising the bound to the whole radius drops the
absurd second walk: the trip now ends at Vaughan Rd with one 8-minute walk. It still takes the
90 — and correctly, because with an honest walking estimate that hop saves about three minutes
on a fifteen-minute walk. The nonsense was the shortlist, not the bus.

**Walking distances were understated, which biased the choice.** Every figure was great-circle
— a floor, since pavements follow blocks — and the error grows with distance, so a long walk
was flattered more than a short one. A 1.3 detour factor (the standard figure for a gridded
network) now applies. It makes walking *look* worse, which is the honest direction: it was
already that bad.

*Why it matters:* three defects, three tests passing, and a build that typechecked. What found
them was reading one returned trip and asking whether a person would do it. `E-D22` recorded
that synthetic testers found eleven defects in carefully-argued code; this is the same lesson
from the other side — the arithmetic was right and the *recommendation* was absurd, and only a
reader notices that.

### E-D33 — The option list was padded with trips nobody would take
*Found 2026-09-02 by reading a returned list · 770 Bay St → 487 Lauder Ave, 17:34*

Four options came back at **37, 51, 66 and 79 minutes** door to door. Only the first was a
trip anyone would make.

**Where the tail came from.** `D-39` generates alternatives by banning a route the best
journey uses and re-planning. The best trip is Line 1 plus the 90; banning Line 1 on a trip
from downtown to Oakwood removes the only fast spine, so what comes back is not a second
choice but *the best trip that exists without the one route that works*. The diversity pick
then keeps it precisely because it shares fewest routes with the others. Nothing asked whether
it was worth a rider's attention.

**The 79-minute option contained legs that undo themselves.** It rode the 94 for one minute
and then walked four minutes back toward where it had boarded; it rode the 512 for one minute
between a five-minute walk and a four-minute one. Connection Scan optimises arrival and never
asks whether a leg earns its overhead, so a one-minute ride wrapped in nine minutes of walking
is, to the algorithm, a slightly earlier arrival.

**And it printed the best reliability of the four.** "1 in 1094" against the best trip's
"1 in 352" — three times safer, at the top of the reliability column. It is not. Its coverage
is **0.05**: `composeRisk` builds the figure from the segments it could score and the rest are
simply *absent from the product*, so a trip we know almost nothing about composes to a
near-zero risk. A rider skimming four cards for the lowest number lands on the worst trip.

| | before | after |
|---|---|---|
| options offered | 4 | **2** |
| worst option | 79 min, coverage 0.05 | *dropped as dominated* |
| second option | 51 min, 2 transfers, coverage 0.88 | **47 min, 0 transfers, coverage 1.00** |

The second option improved because collapsing its pointless one-minute hop on the 5 removed
the unscored segment that was dragging its coverage down. What is left is a real choice: ten
minutes slower, no transfers, and a figure we can actually stand behind.

**A bug inside the fix, worth keeping.** Collapsing a stretch leaves a walk that is not one of
the original legs. The first version matched a ride's leading walks against the *input* array,
so the synthesised walk was invisible and a second pointless ride was judged without the
thirteen minutes of walking in front of it — and survived. The stretch now takes its leading
walks off the output. Three tests cover it, including that case by name.

*Why it matters:* `D-14` says that where there is no real alternative the honest output is one
route and when to leave, not a menu. The list was doing the opposite — manufacturing a menu
out of the absence of alternatives, and topping the reliability column with the trip it knew
least about.
