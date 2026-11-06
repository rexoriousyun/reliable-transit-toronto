# Problem Inventory — Toronto Commuters

What actually goes wrong for riders, ranked by how much pain it causes and whether we
can do anything about it. Each problem cites its evidence.

**Legend — can we address it?**
`DIRECT` we can materially solve · `PARTIAL` we can reduce the pain, not the cause ·
`INFORM` we can only warn · `OUT` outside our reach, documented so we stop revisiting it

---

## PR-01 — You cannot tell how long you will actually wait `DIRECT`
**Evidence:** E-D09, E-L06, E-L05

The core wound. Schedules say one thing, reality another, and the gap is invisible until
you are standing at the stop. Median bus headway gap during an incident is **26 minutes**
— double the vehicle's own lateness. Riders waited 50% longer than scheduled on 10 routes;
only 10 routes citywide met evening-rush targets.

Riders do not experience "the bus is 13 minutes late." They experience "I have been here
26 minutes and I do not know if one is coming."

> This is our product. Everything else is secondary.

## PR-02 — Unreliability is unevenly distributed and nobody publishes where `DIRECT`
**Evidence:** E-D01, E-D05, E-M01, E-M02

Bad segments stay bad (rho = 0.78), and the burden is wildly uneven — 52 Lawrence West
alone carries 45,974 delay-minutes. But no public tool exposes reliability *below the
route level*, so a rider cannot know that their specific segment is the problem, or that
a parallel route is materially safer.

## PR-03 — Riders cannot plan a buffer, so they over-buffer or arrive late `DIRECT`
**Evidence:** E-L03, E-L01, E-L02

Riders already reason in percentiles — "leave 20 minutes early to be safe." Every tool
available to them reports an average. So they either waste time buffering blindly or
miss things. Reliability-aware routing recovers 8.9% of travel time on average, up to
37.1%. That value is currently unclaimed because mainstream planners route on schedule.

## PR-04 — Being stranded mid-trip is a different, worse problem than being delayed `PARTIAL`
**Evidence:** E-L07, E-D02

330,000+ short-turns since 2012. Mid-trip failure is worse than pre-trip delay: you have
already committed, you are somewhere you did not choose, and your alternatives have
narrowed. Disorderly-patron and medical incidents (E-D02, ~32% of subway delay) hit
mid-trip by nature.

We cannot prevent it. We can make the recovery decision fast instead of panicked.

## PR-05 — Long commutes compound variance across transfers `PARTIAL`
**Evidence:** E-L08, E-D26

Toronto has Canada's longest commutes: 44.1 min average by transit, **30% at 1–2 hours,
10% at 2+ hours.** Long trips mean more transfers; each transfer is a fresh chance to
miss a connection, and variance compounds rather than averages out. The 2h+ tail is where
our value concentrates — and it skews to outer suburbs, which is exactly where the worst
bus routes are (E-D05).

> **Measured 2026-09-01 (E-D26).** Still `PARTIAL`, and now specifically so. `D-34` prices a
> missed vehicle at the stop; nothing prices a connection when trips are ordered. A transfer
> is not a term in `composeRisk` at all. But the two larger charges did not hold up: the
> ranking is not transfer-blind (73.1%, against a pre-registered 90% bar) and reported risk
> *rises* with transfer count rather than falling. What is left is a missing tiebreak —
> 59.2% of the time the ranking prefers more transfers it buys under a minute — and connections
> that are tight against the service behind them: 10.2% scheduled at zero slack, 13.0% of trips
> carrying a two-minute step onto 20-minute service. `D-38` proposes the narrow fix and refuses
> the wide one.

## PR-06 — One broken elevator cancels the whole trip `INFORM`
**Evidence:** E-L09

Only 55 of 75 stations are fully accessible. For riders who depend on elevators an outage
is **binary, not graded** — it does not make the trip longer, it makes it impossible, and
often mid-journey with no way back up. Advocates' number one ask is realtime elevator
information.

Our severity model must not treat this as "a delay, but bigger."

## PR-07 — Riders who have alternatives are leaving `PARTIAL`
**Evidence:** E-L05, E-D27

Riders with a car or a rideshare option "are still mostly choosing those other options,
because they don't know if the bus will show up." The lost trip is not caused by the
average delay; it is caused by **not knowing**. This is a confidence problem, and
confidence is addressable with information even when the underlying service does not
improve.

> **Measured 2026-09-01 (E-D27).** "Alternatives" is not evenly distributed, and now has a
> rate rather than an assertion. A materially safer second option exists on **12.3% of
> downtown trips against 1.3% citywide** — nine times more often inside `E-D14`'s core box.
> Comparison serves this problem where the alternatives are real and cannot manufacture them
> where they are not, which is why `D-40` scopes it to `F-03` rather than the citywide list.

## PR-08 — Official metrics do not match lived experience, so riders distrust all numbers `DIRECT`
**Evidence:** E-L06, E-D04, E-D09

TTC on-time metrics "hide more than they reveal." Riders have learned that published
reliability numbers do not describe their morning. We inherit that scepticism.

Two traps we must avoid inheriting as well: **65% of delay records are 0-minute
non-events** (E-D04), and reporting vehicle delay instead of headway gap understates
rider pain by ~58% (E-D09). If we publish numbers that feel wrong, we are just another
dashboard nobody believes.

## PR-09 — Delay data points at terminals and yards, not at rider risk `DIRECT`
**Evidence:** E-D03

20.7% of subway delay-minutes land on 12 of ~70 stations — terminals and yards, where
trains turn around and where the log entry happens to get written. A rider passing through
Kipling is not at risk; Kipling is where the paperwork lives.

This is a problem *we* would create if we shipped the obvious thing. Listed here so it
stays visible.

## PR-10 — We are blind on the busiest part of the network `INFORM`
**Evidence:** E-D06, E-D07

The subway has **no realtime feed**. Surface delay history is only **66% geocodable**.
So our coverage is genuinely patchy, and the patches are not random.

A rider must never mistake "we have no data here" for "this is fine."

## PR-11 — Crowding, safety and comfort drive mode choice `OUT`
**Evidence:** E-D02, E-L04, E-L05

Disorderly-patron and security incidents are ~20% of subway delay-minutes, and safety
perception is a documented driver of ridership. We can surface it as a *cause* of delay
but we cannot measure or predict crowding or personal safety, and we should not pretend to.

## PR-12 — Weather turns a normal day into a bad one `INFORM`
**Evidence:** E-D02

Weather and ice/snow are 7.6% of subway delay-minutes, but with the worst severity
profile in the dataset — ice/snow incidents average **68.8 minutes** versus a 7.8-minute
overall mean. Rare, catastrophic, and forecastable a day ahead.

## PR-13 — In winter, an unexplained wait is a safety problem `INFORM`
**Evidence:** E-L11, E-D02

Toronto plans 100 heated shelter kits over seven years, aimed at high-ridership stops with
*low* frequency. Riders have been stranded at stops for hours during storms. Ice and snow
incidents average **68.8 minutes** against a 7.8-minute overall mean — rare, catastrophic,
and forecastable a day ahead.

"Your bus is 26 minutes away" is information in July and a decision about physical safety
in January. The product currently treats those identically.

*Supersedes and absorbs PR-12, which framed weather only as a delay cause.*

## PR-14 — Our own product excludes part of our audience `OUT`
**Evidence:** E-L10

66.6% of TTC riders are equity-deserving. Lower-income riders pay more per trip because
they cannot front a monthly pass, and app-based, cashless service isolates people who are
unbanked or have low digital literacy — newcomers and older adults among them.

We are building a smartphone app with an analytics interface. That is a barrier for part of
the audience we claim to serve most. We cannot solve it, but designing as though it were
not true would be dishonest.

---

## Ranking for v1

| Rank | Problem | Why |
|---|---|---|
| 1 | PR-01 wait uncertainty | The wound; we have the unused data to fix it |
| 2 | PR-02 hidden bad segments | Our defensible position (E-M01) |
| 3 | PR-08 distrust of numbers | Determines whether anyone believes rank 1 and 2 |
| 4 | PR-03 no buffer planning | Direct, quantified value (E-L01) |
| 5 | PR-09 attribution artifact | A self-inflicted wound if ignored |

PR-06 and PR-10 are **correctness constraints on everything above**, not backlog items.
