# Components

What exists, what each one is for, and which decision put it there. The system doc
(`01-system.md`) has the tokens and the rules; this is the inventory they are applied to.

Written 2026-09-02, when the plan sheet was rebuilt around a single verdict (`D-45`).

---

## The confidence pair

Certainty used to be said three ways — a dashed map line, a dashed tag border, and a
sentence. `D-45` reduced it to one vocabulary, and these two carry it.

| | `ConfidenceMark` | `ConfidenceBand` |
|---|---|---|
| **Answers** | can this number be trusted? | how much of the trip is it about? |
| **Shape** | 8px circle | 6px bar |
| **States** | ● measured · ○ thin · ◌ unknown | measured fill over hatch |
| **Where** | beside any number, search hit, list row | under the verdict |

Both carry **two channels**, never colour alone — fill *and* border style, colour *and*
texture — so they survive greyscale and colour-vision deficiency without a legend. That is
the same rule the map encoding follows, and it is why the pair needs no key.

`E-D12` is why they earn the space: 3.1% of segments reach high confidence, so unknown is
not an edge case in this product, it is most of the network.

**The band replaced a tag.** "Little data" fired below 50% coverage and was silent above it,
which made a trip at 51% look categorically different from one at 49%. A bar shows the
proportion and stops pretending there is a line.

## The verdict

`VerdictCard` is the answer, as one block. It replaced a stack of seven — ViewToggle,
RouteKey, TripTags, DepartureAdvice, Benchmark, JourneyDetail, an advice-basis note — each
correct, all at the same size. The verdict was on screen but did not *lead*, which is
`P-06`: answer the decision, do not render a dashboard.

**Four blocks before the buttons**, in the order a rider needs them:

1. **When to leave**, and what usually happens — the only verb-sized line on the screen.
2. **`ConfidenceBand`** — how much of this we measured, with the benchmark verdict beneath.
3. **`PriceTile` ×2** — what being safe costs, and what one no-show costs (`D-24`, `D-34`).
4. **The worst stretch**, as a row that points the map at it.

Everything the old stack said is still said. What changed is that the numbers carrying a
claim sit above the numbers qualifying them.

### PriceTile
Label, value, detail. Used only for the two prices, both of which are **priced and never
prescribed** — what a buffer is worth depends on what being late costs this rider, which we
do not know and must not guess (`D-24`).

### The worst-stretch row
Keys on `segmentId`, not on the station names it prints. `dominant` is title-cased on the
way out and the drawn features carry raw GTFS names, so matching on text would miss
silently — the same shape of mistake `displayStopName` is kept off every lookup path to
avoid. The id was added to the wire for this.

## Retained from before

| | what it is | decision |
|---|---|---|
| `TripTags` | conditions on this trip, as tags that open — several can apply at once | `D-33` |
| `ViewToggle` | which window the figures describe: this band, or all day | `D-27` |
| `JourneyList` | the alternatives, when the rider is choosing | `D-20` |
| `JourneyDetail` | step by step, now behind a button rather than always open | `D-22` |
| `Benchmark` | the comparison line, still used inside `JourneyList` | `D-28` |
| `RouteRanking` | routes by what they cost riders, with the cause named | `D-31` |
| `StopSearch` | origin and destination entry | — |
| `MapView` | the ground. Draws the trip on the same scale explore uses | `D-14`, `D-26` |

## Rules that apply to all of them

- **One verb-sized headline per screen.** Everything else steps down hard.
- **Every number gets its certainty within 8px**, as a mark, or a band beneath it.
- **Colour is reserved.** The encoding scale and nothing else — no second accent, no
  selection hue. Focus rings are ink.
- **`--ink-3` is the floor** at 4.6:1 on `--surface-1`. Do not go lighter.
- **Motion only where it carries meaning** (`D-46`): four moves, and
  `prefers-reduced-motion` collapses all of them to a 120 ms opacity change.

## Built 2026-09-02, second pass

| | what it does | decision |
|---|---|---|
| `UsualTrips` | the rider's own trips on the way in — five, local, no account | `D-44` |
| `StateCard` | empty · loading · stale · thin · offline | `D-29`, `P-03` |
| `HourStrip` | a segment's whole day at once, replacing a 24-entry `<select>` | `P-03` |
| `WalkVsWait` | walk or wait, on one scale | `F-03`, `D-40` |
| `StopSearch` recents | last five stops on click, before a character is typed | `D-44` |

**The step rail** is inside `JourneyDetail` rather than a separate `StepRail`: the file
already carried the leg copy and several `P-03` decisions, and moving them to a new name
would have been churn. Its own disclosure toggle is gone — `VerdictCard`'s button controls
whether it mounts, and two controls for one disclosure let a rider open it and see nothing.

**Desktop** is a 440px column anchored to the *bottom* of the viewport, not to a fixed top.
The upgrade frame assumes the trip form is its own screen; here it still lives in the topbar
and changes height, so a hardcoded `top` put the sheet over the form and swallowed its clicks.

## Not built

| | for | blocked on |
|---|---|---|
| `JourneyCards` | hover-to-preview on the results list | nothing — `JourneyList` covers the job; this is the desktop refinement |
| `RouteStrip` | a route as one bar, widths by stop count | nothing |
| `GapBoard` | `F-04`'s countdown at the stop | **impossible from this feed** — the realtime stop ids are a different id space (`E-D29`). `LiveNow` builds the route-level half (`D-47`) |

The screen-level IA — home, form, other ways, steps as separate screens — is also unbuilt.
It is a restructure of `App.tsx`, not a component swap, and everything above works inside the
single-screen shell that shipped.
