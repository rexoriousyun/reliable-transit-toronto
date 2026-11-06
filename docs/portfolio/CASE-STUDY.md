# Reliable Transit — a UX case study

**Role:** research, product definition, interaction design, implementation
**Timeframe:** two working sessions, 2026-08-28 to 2026-08-29
**Status:** v1 built and complete. **Rider validation is the one success criterion
outstanding**, and the protocol for it is written and pre-registered.
**Artefacts:** evidence base, problem inventory, principles, personas, journeys, user
flows, research protocol, system architecture, decision log — all in `docs/`
**Presented as:** [a designed page](https://claude.ai/code/artifact/304700bb-f9a5-40e7-a42b-16a92e780dd0)
— source in `case-study.html` beside this file. It carries the argument in a form a reader
can be handed; this file is the full record. The page wears the product's own palette and
has **no accent colour**, because `D-23` reserves colour for risk and a case study that
breaks the rule it documents is not making the argument.

---

## The brief

> "Transit delays cluster on specific lanes because of usage, maintenance, and
> infrastructure. I want a route map showing the fastest *and* most reliable way from A to
> B, and exposing which lanes are worst."

A good instinct with a testable assumption inside it. So the first work was not design. It
was finding out whether the premise was true.

**What the project became:** a map-first TTC trip planner where reliability is the layer
underneath the answers, not the product on top of them. Every milestone is built. What it is
waiting on is a Toronto rider, and that is the honest ending of this study rather than a
hedge.

---

## 1. Interrogating the premise before designing for it

Toronto publishes every TTC delay incident since 2014. I pulled 163,725 records covering
January 2025 to July 2026 and tested the assumption directly.

**The load-bearing question:** is unreliability a stable property of a place, or noise? If
it is noise, there is nothing to predict and no product. I ranked stations independently
across two periods and correlated the rankings.

> **Spearman rho = 0.78.** Bad places stay bad.

The premise held. The *explanation* did not.

**Stated cause:** maintenance and infrastructure.
**Actual causes:** disorderly patron 9.9%, injured/ill customer 11.7%, unauthorised at
track level 5.2%, security 5.2%. **~32% is passenger and security incidents.** Equipment
is a much thinner slice.

This mattered for design, not just accuracy. Infrastructure wear is opaque to a rider.
Crowding and time-of-day are *legible* — things a person can plan around. The product got
more useful the moment the real cause was known.

## 2. The finding that relocated the whole product

Every public tool reports `Min Delay` — how late the vehicle is. The same dataset carries
`Min Gap`: the headway hole left behind, which is **what the rider actually stands in**.

| | median delay | median gap | ratio |
|---|---|---|---|
| Subway | 5 min | 8 min | 1.38x |
| Bus | 13 min | **26 min** | **1.58x** |

**83.8% of bus incidents carry the bunching signature.** The industry-standard metric
understates bus pain by ~58%, and the correction is sitting unused in public data.

It also settled the target. Subway: 117,924 delay-minutes. **Bus: 2,052,791 — ~17x.** The
subway gets the attention; the buses carry the pain. I had earlier recommended a
subway-first release. The data killed that recommendation, and I recorded the reversal
rather than quietly changing course.

## 3. The trap I nearly shipped

20.7% of subway delay-minutes are attributed to 12 of ~70 stations — and they are
**terminals and yards**. Kipling is not dangerous to ride through. It is where trains turn
around and where the log entry gets written.

A naive "avoid the red stations" map would have been confidently wrong, and every
competing visualisation I reviewed appears to make exactly this mistake. The same artifact
reappeared on the surface network wearing different names: **garages and loops**, nearly
5% of surface delay logged where no rider is ever waiting.

Cheap to get wrong. Invisible once shipped. This is the finding I am most glad the
research surfaced early.

## 4. Building a system, not a pile of opinions

This is my own project, which is exactly why the decisions needed a structure. Nobody was
going to make me justify them six weeks later, so the record had to do it. Every claim
resolves along a traceable chain:

```
Evidence (E-*) -> Problem (PR-*) -> Principle (P-*) -> Decision (D-*) -> Implementation
```

Four rules make it work:

1. **No orphan decisions.** Every decision cites a principle; every principle cites
   evidence. A decision with no chain is a preference, and gets labelled one.
2. **Evidence expires.** Each claim records when it was measured.
3. **Every decision names its kill condition.** A decision nobody can imagine reversing is
   usually an unexamined assumption.
4. **Superseded, never deleted.** The reasoning history survives.

**Final count: 35 decisions, 9 principles, 14 ranked rider problems, 3 personas, 5
journeys, 4 flows, and 39 pieces of evidence — 24 measured from the data, 13 from published
research, 2 from market review. Each traceable to what produced it.**

Two of those decisions are marked superseded and remain in the log with their reasoning
errors visible. That is the part of this system I would defend hardest.

## 5. Cutting the personas down

The first pass produced five personas. Three survived.

**U-01, the Deadline Commuter, was not a persona.** A hard arrival time changes how a rider
reads a number; it does not make them a different rider. The segmentation research divides
riders by *regularity*, not by deadline — and the two descriptions were plainly the same
human, since precarious work and unforgiving deadlines travel together in Toronto. Merged
into U-02 as a modifier.

**U-03, the Regional Commuter, had not earned its place.** Its evidence described the same
axis another persona already occupied — having an alternative — without showing a different
need. Demoted to a documented hypothesis with a revisit condition, so it does not get
silently reinvented.

What remained splits on the one axis the research actually supports: **does this rider have
an alternative?**

| | rider | needs |
|---|---|---|
| **U-02** | captive — one route, no car | a **forecast** |
| **U-05** | downtown — can walk | a **comparison** |
| **U-04** | access-constrained — binary failure | a **constraint** |

A persona has to earn its place by producing a different design need, evidenced. Five
personas felt thorough. Three were true.

## 6. The measurement that invalidated my own contract

`D-01` staked the product on segment-level reliability. Before building on it, I tested
whether reliability persists at that granularity — and split the question in two.

| metric | rho | ties |
|---|---|---|
| incident count | 0.762 | 41% |
| total gap-minutes | 0.681 | 7% |
| median gap | 0.361 | 94% |
| **mean gap** | **0.104** | **3%** |

**How often a segment costs you time is predictable. How long you wait once it happens is
not.** Mean gap has only 3% ties, so the near-zero correlation is real, not an artifact of
a compressed scale.

That invalidated the engine contract I had written **that same morning**, which promised
per-segment p50/p90/p95. Publishing those would have been noise formatted as precision.
Severity is now pooled per mode and explicitly labelled `pooled-subway` /
`pooled-surface`; only exposure is segment-specific.

This is the case study's real argument: **the measurement changed the design, and the
system made that cheap instead of embarrassing.**

It kept happening. Six times, a thing I had reasoned my way to turned out to be wrong when
measured:

| I believed | The measurement said | What moved |
|---|---|---|
| per-segment severity is the headline | rho 0.10 — it does not persist | the engine contract, same morning |
| Toronto's low redundancy means build a forecast, not a router | the brief asked for A-to-B twice; redundancy shapes what a router *says* | `D-13` superseded by `D-14` |
| peak is much worse than the pooled average | am peak is **0.83x** — two of five bands are *better* | conditioning shipped for dispersion, not for a peak curve |
| a trip in the worst tenth of its class is a bad trip | the reference class had median coverage 0.23 — mostly unmeasured and fake-safe | the benchmark was rebuilt twice |
| a buffer should be sized to a percentile | that advises leaving 58 min early for a twice-a-year event | stopped recommending; state the rate and the price |
| night is riskier, so build for the night rider | night is the **safest** band per trip (0.78x) — but 74.3% of its service runs every 20+ min | the feature survived; its justification changed entirely |

That last row is the one I would put in front of a hiring manager. I proposed a feature on
a hunch about night safety, wrote the audit to test the threshold rather than to confirm the
hunch, and the audit said the hunch was backwards. Night is not more likely to go wrong — it
is emptier, so the same failure costs half an hour instead of seven minutes. **Same feature,
opposite reason, and the reason is what the interface says out loud.**

## 7. Designing for a product that mostly does not know

The uncomfortable result: **86% of bus segments have too little data to score.** Only 3.1%
reach high confidence.

`P-03` says absence of data must never look like good news. The honest rendering of a real
bus route is therefore a checkerboard of known and unknown.

I did not soften it. Unknown segments are **hatched and labelled "no data"** — a different
*kind* of thing, not a low value. A pale colour would have read as "fine".

The principle nearly failed anyway, in a way that is worth showing. A MapLibre colour ramp
written as `coalesce(get(exposure), 0)` turns *missing* into *best*: for a whole milestone,
the unmeasured stretches of a planned trip drew at the green end of the scale. On one
Jane-to-Union itinerary, eight of eighteen stretches. Valid expression, correct data,
invisible to a typechecker and to every test. **A principle is only as good as the last
place someone forgot to apply it**, which is why unknown is now a separate layer that
cannot sit on the ramp at all.

Whether that honesty builds trust or reads as broken remains the single biggest open
question, and it is not answerable from a desk.

## 8. Hiding the machinery without hiding the doubt

One of the four rules I set for the design: *magic is great when it is hidden.* The answer
is the product, and sample sizes, windows, filters and pooling rationale wait behind a quiet
"why this number".

But it needed one line drawn, because two things look identical in a mock and are opposites
in the hand:

| Hide until asked | Never hide |
|---|---|
| Sample size, observation window | That a segment has **no data** |
| Which filters were applied | That confidence is **low** |
| Why severity is pooled | That severity is **not segment-specific** |

Hiding *how we know* is good design. Hiding *that we do not know* is a lie — and it is
precisely the failure riders have already learned to expect, since official TTC metrics
"hide more than they reveal". Hiding the method earns trust; hiding the uncertainty spends
it.

The interface expression of that line went through one full reversal. Four separate
conditions — today's disruptions, a route that often does not turn up, thin history, what a
step-free constraint cost — each shipped as its own paragraph, and they can all apply at
once. Four stacked paragraphs pushed the actual answer off a phone screen. They are now
**tags that open**, with one rule: *the label carries the claim, the tap carries only the
detail.* A tag reads "Little data", never "Details". Anything that cannot be said in three
words does not become a tag.

## 9. What I refused to build

A portfolio usually shows what was made. This project's clearer signal is what was declined,
because each refusal cost a feature that would have demoed well.

- **No safety score.** I wanted something for riders travelling alone at night, and the delay
  archive cannot speak to personal safety. `PR-11` is marked `OUT` for exactly this. I built
  the measurable thing instead — how long you stand there — and wrote down why the other was
  not on the table, so it does not get proposed again.
- **No buffer recommendation.** The rider knows what being late costs them; we do not. The
  app states the rate and the price and stops.
- **No claim about shelter.** The app says a wait is *outside*. Whether that stop has a roof
  is not in a dataset we ingest, so it says nothing about one.
- **Accessibility never blended into a score.** Elevator failure is binary. It filters the
  route set *before* ranking, and it never contributes a weight.
- **No estimate in place of a gap.** Unattributed records stay unattributed. A
  mis-attributed record is invisible and wrong; an unattributed one is visible.

## 10. What the synthetic testers could and could not do

I ran four agents through the app with distinct personas, driving it through a text harness.
They found **eleven real defects**, six of them in code that was carefully argued and
covered by tests — including one that white-screened the entire app on any segment tap,
because MapLibre strips null properties and a `!== null` guard let `undefined` through.

They also could not answer a single question in the research plan. **An agent's reaction is
training data, not a rider's.** They are an excellent defect-finder and a categorically
invalid substitute for the person the product is for, and conflating those two would be the
easiest mistake to make with these tools available.

## 11. Verification: the part that kept catching me

Typechecks and tests passed on code that was visibly broken, three times. The habits that
actually worked:

- **Render it and look**, at street zoom downtown. The wide view flatters everything and hid
  the blue POI icons, a muddy selection tint, and a "green" that read as black.
- **Compute the colour, then look at it.** The palette validator checks separation, not
  whether a colour still reads as the colour it is meant to be. It passed a near-black green.
- **Read the canvas back before believing a screenshot.** Headless Chromium composites a
  stale white band over the WebGL canvas; two independent checks proved the map was drawing
  correctly and the capture was lying.
- **Print times in the service day.** `% 24` turned a window of 03:28–30:35 into
  "03:28 to 06:35", which read as a gap and got written into a decision as "we have not
  ingested Blue Night". All 35 Blue Night routes were in the data. The decision was corrected
  in place rather than deleted.

## 12. What I would do differently

- **Interview earlier — but not first.** The personas are still literature-derived. Yet six
  of the seven questions now blocking validation could only be written *after* there was a
  screen. Building first was right; not scheduling interviews in parallel was not, and it is
  why this study ends with a protocol instead of findings.
- **I let a decision outrun the build.** `D-07` committed to accessibility as a hard routing
  constraint while nothing was implemented and no elevator data was ingested. It is closed
  now — the planner routes *around* stations that are not step-free — but it should not have
  drifted for as long as it did.
- **I let the design run ahead of my own brief.** Five user flows were derived from the
  research and never checked back against what the brief actually asked for. The sharpest
  instance: the brief asked twice for **A-to-B routing**, and I argued it into a forecast on
  redundancy evidence. The evidence was right; the conclusion was not — low redundancy is an
  argument about what a router should *say*, not a reason to withhold one. Caught on
  re-reading the brief, superseded, and kept in the log with the reasoning error visible.
- **I proposed a feature before measuring the thing it was for.** The night case in section
  6. The audit that corrected it took twenty minutes and should have come first.
- **I trusted a measurement because it agreed with me.** Reviewing whether transfers were
  priced anywhere in the product, a quick script reported that the ranking preferred the
  more-complex trip on **46 of 46** comparable journeys. It was a bug: the counter for "a
  simpler option existed" and the counter for "we chose the transfer anyway" were incremented
  on the same line, so the ratio could only ever be 1.0. The pre-registered audit put it at
  **73.1%** — under the bar I had set for calling the ranking transfer-blind, which means the
  charge I was about to write up was false. Unanimity should have been the tell. Kept in
  `E-D26` rather than quietly corrected, because the near-miss is the point: the discipline
  of registering a threshold *before* measuring is what caught it, not my own review.

## Outcome

A working reliability engine over public data with **no API keys**, a mobile-first trip
planner that ranks routes by what actually happens, six reproducible audits with
pre-registered thresholds, 171 tests, and a decision record explaining every choice and what
would reverse it.

Alongside it: an evidence base of 28 own measurements plus 15 from literature and market
review, a ranked problem inventory, nine
principles, three personas, five journeys, four flows, and a pre-registered research
protocol — each traceable to what produced it.

**Every success criterion is met except one.** Rider validation is outstanding, and it is
outstanding because it needs riders, not because it needs more building. The protocol names
the trap it has to avoid: U-05 is easy to recruit and U-02 is not, so recruiting for
convenience would produce a study that validates the persona this product was not built for.

The most valuable output is not the interface. It is knowing **which half of the original
hypothesis was true** — and having the trail to prove it, including the seven times I was the
one who turned out to be wrong.
