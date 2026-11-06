# Research Plan — closing D-08

**Status: ready to run · Written 2026-08-29 · Blocks: everything**

Every persona in `04-personas.md` is provisional. They were derived from published research
and from our own analysis of 163,725 delay records, and **not one Toronto rider has been
spoken to.** `D-08` has been open since the first day of the project and is now the only
thing standing between this build and knowing whether it works.

This document exists so that the sessions cannot be argued into whichever answer is
convenient afterwards. It follows the same discipline the audits do: **the verdict
conditions are written down before any rider is watched.**

---

## What this decides

Seven questions are stacked behind D-08. Six of them could not have been written before
there was a screen, which is the argument that building first was right. All six are now
answerable, and none of them is answerable from a desk.

| | Question | Threatens | Priority |
|---|---|---|---|
| **Q-A** | Does an honest, mostly-empty map build trust or destroy it? | P-03, D-05 | **1** |
| **Q-C** | Does "31 min/mo of wait caused" mean anything to a rider? | D-05, P-06 | 2 |
| **Q-G** | Does "runs every 27 min" read as a cost, or as a promise? | D-34, D-24 | 3 |
| **Q-F** | Does the two-outcome answer read as honest, or as hedging? | D-24, P-01 | 4 |
| **Q-B** | What is the unit riders actually reason about? | D-01 | 5 |
| **Q-E** | Do riders re-open the list after picking, or is the choice settled? | D-20 | 6 |
| **Q-D** | Is compass direction the right handle? | — | 7 |

Plus the two persona assumptions that have never been tested and drive real design:

- **U-02's captivity.** That rerouting is usually not a real option in the suburbs. The
  whole "permission to stop refreshing" posture in J-02 rests on it.
- **U-02's asymmetric tolerance.** That a missed pickup costs far more than a wasted ten
  minutes, so they plan by the 95th percentile.

---

## Who to talk to, and the recruiting trap

**The trap is that U-05 is easy to recruit and U-02 is not.** Downtown riders are reachable
through the channels a project like this naturally has; the primary persona works shifts,
lives north of Sheppard, may be a newcomer, and is not at a design meetup. Recruiting
convenience alone would produce a study that validates the persona we did not build for.

**66.6% of TTC riders are equity-deserving** (E-L10), and `PR-14` records that this product
is a smartphone app with an analytics interface — a barrier for part of the audience it
claims to serve most. A study run only in English, only over video, only with people
comfortable being observed, reproduces that exclusion and then calls the result validation.

### Composition — minimum viable sample

| | who | how many | why |
|---|---|---|---|
| **U-02** captive | bus-dependent, no car in household, inner suburbs, ideally a fixed shift start | **at least 4** | primary persona; every unvalidated assumption is theirs |
| **U-04** access-constrained | depends on elevators, or cannot stand for long | **at least 1** | failure is binary, so one clear failure is decisive |
| **U-05** downtown | rides streetcars for 10–25 min trips, could walk | 1–2 | the only persona for whom comparison is the question |

**Six to eight sessions total.** `PLAN.md` already sets the bar at five riders confirming a
flagged segment matches their experience; this adds the composition requirement, because
five downtown riders would meet the letter and none of the intent.

Recruit through routes, not through networks: the 52 Lawrence West, 102 Markham Road and
86 Scarborough corridors are U-02's own routes (E-D05) and top the ranking the app itself
publishes (`D-31`).

### Non-negotiables

- **Compensate everyone, in cash or its equivalent, before the session starts.** A study
  about people who cannot front $156 for a monthly pass does not ask them to donate an hour.
- **Their phone, their trip, their language.** Bring an interpreter rather than excluding
  someone; an interface that demands English is one of the barriers we are testing for.
- **Consent to being recorded is separate from consent to participate,** and refusing the
  first must not cost them the second or the payment.

---

## Session shape — 45 minutes

Tasks, not a demo. **The rider drives; the researcher does not touch the phone.**

| | minutes | what happens |
|---|---|---|
| 1 | 8 | **Their commute, before the app.** What trip, what goes wrong, how they currently decide when to leave. No screen. |
| 2 | 5 | **Task 1 — plan the trip they just described.** Open app, nothing else said. |
| 3 | 8 | **Task 2 — "you have to be at work at 9. What time do you leave?"** |
| 4 | 8 | **Task 3 — "is your route always like this?"** Explore mode, their own route. |
| 5 | 8 | **Task 4 — a trip on a route with a fragile wait,** chosen in advance from `audit:headway`. |
| 6 | 8 | **Debrief.** What they would tell a friend it does. What they would not trust it for. |

Stage 1 comes first for a reason: **Q-B is answered there or not at all.** Once the app has
shown them a segment, their vocabulary is contaminated. The unit they reach for unprompted,
before any screen, is the only clean observation of it we get.

---

## Pre-registered verdicts

Written before any session. Each names what would count as a failure, so a result cannot be
downgraded to "mixed signals" after the fact.

### Q-A — the mostly-empty map *(highest priority)*
**Show:** the segment map for their own bus route, at street zoom, unedited. 86% of bus
segments are unknown (E-D12) and a real route reads as alternating known and hatched.

**Observe, do not ask.** Whether they scroll past it, ask what the hatching means, or stop
using the screen.

| Outcome | Verdict |
|---|---|
| ≥ 4 of 6 spontaneously read the hatching as "they don't know here" and keep going | **P-03's expression holds.** Ship as is. |
| ≥ 3 read it as the app being broken, out of date, or still loading | **The expression fails, not the principle.** P-03 is not negotiable; the rendering changes, and Q-B's corridor option comes into play. |
| Anyone reads hatched as *fine* | **Immediate stop.** That is the exact failure P-03 exists to prevent and it outranks every other finding in this study. |

### Q-C — "31 min/mo of wait caused"
**Show:** the route ranking, which currently reads `2,795 min/mo+`.

**Ask:** "what does this number tell you?" — *after* they have looked, never before.

| Outcome | Verdict |
|---|---|
| ≥ 4 of 6 recover "this route wastes a lot of people's time" without help | the unit lands; keep it |
| ≥ 3 cannot say what it means, or read it as *their own* wait | the unit fails. The model is unaffected — `D-11` stands on measurement — only the presentation moves |

**If it fails, one replacement is already ruled out and one is ready to test (E-D28, D-41).**
A percentage is not the fallback: per-trip risk has a median of 0.218%, so **74.4% of trips
would read "0%"** and the unit a rider finds most familiar erases the whole signal. The
candidate that survives measurement is the rider's own calendar — *"take this daily and it is
about once every 11 months"*, spanning 2.5 to 54 months across the sample.

**If Q-C fails, show the calendar framing second** and ask the same question again. Do not
show both at once: the comparison a rider makes between two units in front of them is not the
comprehension test this is trying to run.

### Q-G — "runs every 27 min"
**Show:** Task 4's trip, with the fragile-wait tag open.

**Ask:** "what would you do?" — never "what does this mean?" The behaviour is the answer;
the paraphrase is not.

| Outcome | Verdict |
|---|---|
| they describe having a second plan, leaving earlier, or checking before going out | reads as a **cost**. `D-34` holds |
| they describe waiting, or say "so one comes in 27 minutes" | reads as a **promise** — the confident-single-ETA failure `D-24` was rewritten to avoid, arriving by another door. D-34's wording changes |

### Q-F — two outcomes, or hedging
**Show:** the departure answer, which states a typical time and what it costs when the trip
goes wrong, and deliberately does **not** recommend a buffer (`D-24`).

| Outcome | Verdict |
|---|---|
| ≥ 4 of 6 pick a departure time and stop | honest. `D-24`'s refusal to recommend holds |
| ≥ 3 ask "so what time should I leave?" | riders want the recommendation `D-24` refused to give. **This does not automatically reverse D-24** — the reasoning that produced it (a 58-minute buffer for a twice-a-year event) is unaffected by wanting one. It reopens the question of what shape of answer sits between the two |

### Q-B — the unit
**Observe** in stage 1, before any screen: the unit they use unprompted for where their trip
goes wrong.

| Outcome | Verdict |
|---|---|
| stop-to-stop, or a named short stretch | `D-01` holds |
| consistently corridors ("Lawrence between Bathurst and Dufferin") | `D-01` needs revising — the stable signal is real either way, only its resolution changes |

### Q-E — is the choice settled
**Observe** in Task 2: whether they re-open the options list after picking one.

| Outcome | Verdict |
|---|---|
| most pick and move on | `D-20`'s peek holds |
| most re-open repeatedly | the sheet is hiding something they needed to compare |

### Q-D — compass direction
**Observe** whether "N / S / E / W" causes a pause in Task 3. GTFS carries headsigns, so
"towards Finch" is a cheap fix — but only worth making if it is actually a barrier.

### Q-H — a transfer when it costs nothing
**Show** two journeys of the same expected duration, one with an extra connection, and ask
which they would take and why. `E-D26` found the ranking hands over the extra connection for
under a minute 59.2% of the time it does so at all, with nothing breaking the tie.

| Outcome | Verdict |
|---|---|
| most prefer fewer transfers, unprompted | `D-38`'s tiebreak is the rider's preference — accept it |
| most are indifferent, or weigh the specific routes | it is our taste, not theirs; leave the order alone and disclose the tie |
| they ask how tight the connection is | the slack matters more than the count, and `D-38` part 2 is the useful half |

Do not show the transfer count as a number first. It is on the card already (`D-34`); the
question is whether it changes a choice, and naming it invites agreement with it.

### The two persona assumptions
**Captivity:** in stage 1, ask what they do when the bus does not come. If they routinely
name a real alternative, U-02's anti-goal — never offer a reroute that assumes downtown
density — is softer than written, and `D-13`'s "one option, told the truth" framing needs
re-examining.

**Asymmetry:** ask what actually happens when they are late. If the penalty is mild,
U-02's 95th-percentile planning is our assumption rather than their behaviour, and
`D-24`'s whole framing shifts.

---

## What the researcher must not do

Each of these has a matching failure already recorded in this project.

- **Do not demo.** The app has to survive being opened cold. Explaining it converts a
  usability finding into a comprehension finding.
- **Do not ask what a number means before they have acted on it.** Q-C and Q-G both fail
  their own test if the paraphrase is collected first.
- **Do not defend a screen.** When a rider misreads something, the misreading is the
  finding. `D-13` was written by arguing a reframing into the brief without checking it, and
  had to be superseded.
- **Do not use synthetic testers for any of this.** Four Sonnet agents driving the app found
  eleven real defects (E-D22), six of them in carefully-argued tested code — and they cannot
  answer a single question on this page. An agent's reaction is training data, not a rider.
- **Do not count agreement as validation.** A rider being polite about a screen is not
  evidence. Only what they *do* counts.

---

## What happens to the results

The same chain as everything else, walked forward rather than summarised:

1. Each finding becomes an `E-U##` entry in `01-evidence.md` — a new class, because
   rider-derived evidence expires differently from a data measurement.
2. Every principle and decision downstream of a changed fact is flagged, revised, or
   superseded. **Superseded, never deleted** — `D-13` is still in the log with its reasoning
   error visible, and these will be too.
3. `04-personas.md` loses the word **PROVISIONAL**, or gains a specific note about which
   parts survived.
4. `D-08` closes with the verdicts above, whichever way they went.

A study that changes nothing is a study that was not asking real questions. Two of this
project's audits reversed the design they were written to confirm; this one should be
expected to do the same.

---

## Before the first session

- [ ] The app is reachable on a rider's own phone. It currently runs on `localhost` and
      needs a persistent host that does not scale to zero: ~298 MB of read-only data,
      441 MB peak RSS, and ~12 s to build the graph on the first request. A rider watching
      a spinner for twelve seconds is a finding about hosting, not about the design, and it
      would contaminate every question below. This is the only blocking item.
- [ ] Task 4's trip is chosen from `npm run audit:headway` — a real route where the plan
      puts a rider at a stop for a minute or two on service running every 20+ minutes.
- [ ] Task 3's route is *their* route, looked up live, not a prepared example.
- [ ] Compensation is arranged and paid up front.
- [ ] A pilot session with someone who is not a rider, to time the tasks — not to validate
      anything.
