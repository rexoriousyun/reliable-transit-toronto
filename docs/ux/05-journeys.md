# Journeys

**Reworked 2026-08-28** against three personas (U-02, U-04, U-05) and `D-13`. The previous
version was written when there were five personas and the product was still framed as a
router; J-05 is new, and every journey now states what it shows versus what it defers
under `P-09`.

**Built status refreshed 2026-08-29,** after M10–M12, the benchmark, route ranking, vanishing
service and D-34.

Five moments of need. They demand **different products**, and conflating them is the most
likely way to build something that serves nobody.

The recurring failure across all of them: **the rider's information is worst exactly when
their decision matters most.**

---

## J-01 — Pre-trip: "when do I need to leave?"
**Who:** U-02 · **Problems:** PR-03, PR-01, PR-05 · **Built:** **yes** — M10 (D-24), extended
by D-27 (time of day), D-28 (benchmark), D-29 (today), D-33 (tags), D-34 (what a missed
vehicle costs)

The forecast journey, and the one `D-13` says is the product's centre. The rider works
backwards from an arrival time — often one with a penalty attached.

| Stage | Rider state | Today | Our intervention |
|---|---|---|---|
| Has an obligation | Knows arrival time, not departure | Works backwards from a schedule that lies | Work backwards from the *distribution* |
| Checks | Wants to know if today is unusual | No signal until at the stop | Today against this segment's normal |
| Decides buffer | Guesses | Blanket 20 min every day, ~1 hr/week unpaid | "Leave 8:12 for 90% confidence" |
| Commits | Wants to stop thinking | Anxiety persists, keeps re-checking | State the confidence and let them go |

**Shows:** a departure time and a confidence.
**Defers:** the percentile basis, sample size, window.
**Never defers:** that it is an estimate; low confidence.

**Success:** they leave once, on time, and do not re-check.
**Failure:** a single confident ETA. For a rider with a deadline that is the number that
gets them in trouble.

## J-02 — At the stop: "is it coming, or should I give up?"
**Who:** U-02 · **Problems:** PR-01, PR-04, PR-13 · **Built:** **partly** — the historical
half only. *Most acute pain in the product.*

> **What D-34 delivered here, and what it did not.** "Is *this* vehicle coming" needs
> realtime and is still not built. "What does it cost me if it doesn't" needs only the
> timetable, and now ships: every wait carries its headway, and a fragile one is tagged.
> `E-D24` is why that is worth having on its own — three quarters of night departures are on
> service running every 20 minutes or worse, so the cost of a no-show is the larger part of
> this journey's pain and it was answerable without a feed. The abandon threshold below still
> needs one.

Already committed, standing outside, patience decaying — and for a third of the year, cold
enough that this is a safety decision rather than a comfort one (E-L11). Median bus headway
gap during an incident is **26 minutes** (E-D09), and 83.8% of bus incidents carry the
bunching signature, so "4 minutes away" is frequently false.

| Stage | Rider state | Today | Our intervention |
|---|---|---|---|
| Arrives | Expects a short wait | Optimistic prediction | Show the *gap*, not the vehicle ETA |
| 5 min | Doubt | Countdown resets upward — the ghost bus | Name it: bunching, gap now ~N min |
| 10+ min | Considering abandoning | No basis to decide | An explicit abandon threshold |
| Decides | Wants to stop refreshing | Refreshes compulsively | Permission: "~18 min, go back inside" |

**Shows:** the wait, and whether to keep waiting.
**Defers:** why the estimate moved, bunching mechanics.
**Never defers:** that we cannot see the vehicle (no subway realtime, E-D06).

**Success:** the rider stops checking their phone — because they left, or because they
trust the number enough to wait somewhere warm.
**Failure:** mirroring the optimistic countdown everyone else shows. Then we are the ghost
bus.

> Surface-only for the foreseeable future: the subway has no realtime feed (E-D06). That is
> acceptable — the pain is on the surface network anyway (E-D05).

## J-03 — Mid-trip disruption: "I'm stuck, now what?"
**Who:** U-02, U-04 · **Problems:** PR-04, PR-06 · **Built:** no

The worst state: already committed, somewhere not chosen, alternatives narrowed — on a
network the TTC's own CEO calls binary (E-L12). Short-turning strands riders 330,000+ times
(E-L07). For U-04 an elevator outage here is not a delay but a trap.

| Stage | Rider state | Today | Our intervention |
|---|---|---|---|
| Disruption hits | Is this normal? | Vague or absent announcement | Severity immediately: minor vs 40 min |
| Assesses | Needs options fast | Re-plan from scratch under stress | Pre-computed options *from here* |
| Re-plans | Low patience, poor conditions | Typing a new trip while standing | One tap, no re-entering the destination |
| Recovers | Wants ETA confidence | None | Honest revised arrival |

**Shows:** severity, and what to do.
**Defers:** cause detail, historical context.
**Never defers:** when there is no good option. "Nothing you can do, ~25 minutes" is a
valid and useful answer (P-07).

**Success:** decision made in under 30 seconds without typing.
**Failure:** alerting without severity or an option — transferring anxiety without
transferring agency.

## J-04 — Exploratory: "is this route always like this?"
**Who:** all three · **Problems:** PR-02, PR-08 · **Built:** **yes (M6)**

Low frequency, high trust-building value. Someone choosing an apartment, changing shifts,
or arguing with the TTC. **The journey our segment layer uniquely serves** (E-M01, E-M02),
and where the credibility that makes J-01 and J-02 believable is earned.

| Stage | Rider state | Today | Our intervention |
|---|---|---|---|
| Suspicion | "This route feels bad" | Only anecdote | Confirm or deny with history |
| Investigation | Wants where and when | Route-level dashboards only | Segment level, by hour and day |
| Understanding | Wants why | Nothing | Cause breakdown (E-D02) |
| Action | Change route, time, or complain | — | Shareable evidence |

**Shows:** which stretches cost riders time.
**Defers:** methodology, sample, pooling rationale — behind "why this number".
**Never defers:** unknown segments, which stay hatched (P-03).

**Success:** the rider learns something true they could not have learned elsewhere.
**Failure:** showing terminal and yard artifacts as rider risk (PR-09) — confidently wrong,
and the fastest way to lose trust permanently.

> **Open risk:** 86% of bus segments are unknown (E-D12). Whether this journey reads as
> honest or as broken is Q-A, the highest-priority question in D-08.

## J-05 — Downtown: "transit or walk?" *(new)*
**Who:** U-05 · **Problems:** PR-01, PR-07 · **Built:** no

The only journey where "which option" is a real question. The core has **321 stops across
26 routes** plus walking and bike share (E-D14); a 10–25 minute trip is usually walkable,
and 504 King and 501 Queen are the worst surface routes in the system.

| Stage | Rider state | Today | Our intervention |
|---|---|---|---|
| Reaches the stop | Considering the walk | Countdown that keeps resetting | Wait against walk time, side by side |
| Deliberates | Losing minutes deciding | Stares up the street | One comparison, no interpretation |
| Chooses | Wants to stop thinking | Often walks anyway, 10 min late to decide | A verdict in under five seconds |

**Shows:** two numbers — typical wait, walk time — and which wins.
**Defers:** everything else.
**Never defers:** low confidence in the wait estimate.

**Success:** the decision takes less time than looking up the street.
**Failure:** defaulting to the streetcar because it is the transit option. Sometimes the
honest answer is "walk", and an app willing to say so earns more trust than one that never
does.

> Strictly a downtown feature. Building comparison citywide would import the New York
> redundancy assumption through the back door (D-13).

---

## What this implies

| Journey | Shape | Needs realtime? | Persona | Built |
|---|---|---|---|---|
| J-01 pre-trip | Forecast + departure advice | no | U-02 | **done** — M10, D-24 |
| J-02 at stop | Live gap, abandon threshold | **yes**, surface | U-02 | **partly** — D-34 gives the cost, not the countdown |
| J-03 mid-trip | Severity + one-tap options | **yes** | U-02, U-04 | no |
| J-04 exploratory | Segment map + history | no | all | **done** — M6, D-31 |
| J-05 downtown | Wait vs walk | yes, ideally | U-05 | no |

**Everything buildable without a realtime feed is now built.** J-01 and J-04 both shipped,
and D-34 took the part of J-02 that the timetable alone can answer. What remains behind the
feed is genuinely behind it.

**J-02's countdown and J-03 are the two real gaps,** and they are deliberate: both need GTFS-RT
stop-level arrivals, which this realtime feed cannot give: its stop and trip ids are a
different identifier space from the schedule (`E-D29`), so a countdown built on the obvious
join is silently wrong at over half of all stops. Route-level *"is anything running"* is
built instead (`D-47`). The correctness bar is also
higher there — a wrong number at a stop in January is worse than no number.

**J-05 is unbuilt and is the cheapest of the three.** Wait against walk needs no feed to be
useful in its rough form: D-34 already computes the headway a rider faces, and a walking time
is geometry. It is unbuilt because U-05 is not the primary persona, not because it is hard.

**U-04 is now served by J-01,** which was not true when this file was written: `D-30`
routes *around* stations that are not step-free rather than marking them, and D-34's
minutes-outside figure answers a rider who cannot stand for long. J-03 still names them
without serving them.
