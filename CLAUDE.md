# Working notes

Conventions and hard-won gotchas for this project. Read `docs/STATE.md` first — it is the
anchor for what the project is, where it stands, and what is open.

---

## Orientation

| | |
|---|---|
| **Branch** | `claude/ny-trip-app-dev-paw8s8` — develop and push here, never elsewhere |
| **What it is** | A map-first TTC trip planner whose differentiator is reliability (`D-14`) |
| **Read first** | `docs/STATE.md`, then `docs/ux/README.md` for how decisions are structured |
| **Design** | `docs/design/00-concept.md` (concept) and `01-system.md` (rules, tokens, validation) |

## Commands

```bash
npm run ingest            # TTC open data + GTFS -> SQLite, builds segments, attributes, geometry
npm run ingest:addresses  # just the 525k municipal address points (183 MB CSV, streamed)
npm run audit:gap         # M2 gate — is Min Gap trustworthy? (pre-registered thresholds)
npm run audit:stability   # does segment reliability persist? (rho > 0.5 on exposure)
npm run audit:coverage    # surface geocoding rate vs the 66.1% baseline
npm run audit:headway     # is "runs every N min" discriminating, or wallpaper? (D-34)
npm run audit:transfers   # does a transfer cost anything in the ranking? (PR-05, D-38)
npm run check:diagrams    # every mermaid block parses — GitHub fails one silently
npm run data              # ingest -> precompute -> benchmark. Re-run all three together
npm run build && npm start  # production shape: compiled server serving web/dist
npm test                  # vitest
npm run typecheck
npm run dev               # API on :3000 — /plan builds a ~6s graph on first request, then 6-12ms
cd web && npm run dev     # UI on :5173, proxies /api and /tiles to :3000
```

All data is public Toronto Open Data + TTC GTFS. **No API keys anywhere.**

---

## How decisions work here

The chain is `Evidence (E-*) -> Problem (PR-*) -> Principle (P-*) -> Decision (D-*)`, and it
has four rules. They are in `docs/ux/README.md`; the two that get broken most often:

- **No orphan decisions.** A decision with no principle behind it is a preference, and gets
  labelled one.
- **Superseded, never deleted.** `D-13` is still in the log, marked superseded, with the
  reasoning error visible. Do not tidy these away — the history is the point.

When you learn something, **write it down as evidence with an ID and a date**, then follow
the chain forward to whatever it invalidates. Several decisions here were reversed by
measurement; that is the system working, not a failure.

## Working conventions

- **Ask one thing at a time.** The user is often on mobile. Multiple questions in one turn
  do not get answered.
- **Do not use the multiple-choice question widget** — it is broken on mobile in this
  setup. Ask in plain text.
- **Pre-register thresholds in the source**, not in the write-up, so a verdict cannot be
  renegotiated after seeing the numbers. See `src/audit/*.ts`.
- **Never fill a data gap with a plausible estimate.** Unknown is a designed state
  (`P-03`). An unattributed record is visible; a mis-attributed one is invisible and wrong.
- **Commit messages carry the reasoning**, not just the change: what was wrong, what was
  measured, what was traded away. They are the second-best record after the docs.
- **Do not spam artifacts.** Two exist: *Fewer Surprises* (the interactive prototype) and
  *Which Half Was True* (the case study, source at `docs/portfolio/case-study.html`).
  One artifact per living document. If it already exists, publish
  to the same URL (pass `url`) so the link the user holds keeps working — use
  `action: "list"` to find it when the URL is not to hand. A new artifact is for a genuinely
  new document, never for a revision of one that exists.

## Design and flow decisions run through the UX foundation

Before deciding anything about design or a user flow, walk the foundation and cite what you
found. Not as ceremony — every time this was skipped, the decision missed a factor that was
already written down.

| Check | File | Ask |
|---|---|---|
| Who is this for | `04-personas.md` | Which persona, and what is their anti-goal? |
| When do they hit it | `05-journeys.md` | Which journey, and what must never be deferred there? |
| What breaks today | `02-problems.md` | Which `PR-*` does this address or worsen? |
| What constrains it | `03-principles.md` | Which `P-*` applies, and does this violate one? |
| What was already decided | `06-decisions.md` | Does a `D-*` already cover or contradict this? |

If the decision survives that walk, record it with the citations. If it does not, the
foundation just saved a rebuild.

**This has caught real errors.** Routing was reframed as a forecast without checking the
brief (`D-13`, superseded). Five user flows were designed without consulting the product
owner at all. A colour was chosen for its validator score without checking it against the
concept it was meant to serve.

## Verification

Typechecks and tests pass on code that is visibly broken. Three real defects shipped clean
through both before being caught by eye.

- **Render it and look.** After any visual change, screenshot it.
- **Check at street zoom** (`zoom ~14.5`, downtown). The wide view flatters everything and
  hid the blue POI icons, the muddy selection tint, and a "green" that read as black.
  `window.__map` is exposed in dev for exactly this: `__map.jumpTo({center:[-79.3905,43.6465],zoom:14.6})`.
- **Compute colour, then look at it.** The palette validator checks separation, not whether
  a colour still reads as the colour it is meant to be. It passed a near-black green.
- **Verify a framing held.** A route change fires `fitBounds`, which can land after your
  `jumpTo` and silently undo it. Assert the zoom before screenshotting.

---

## Gotchas that cost real time

**Prisma + SQLite stores `DateTime` as integer milliseconds.** `strftime('%Y-%m', col)`
returns NULL and any GROUP BY on it collapses silently. Use
`strftime('%Y-%m', col / 1000, 'unixepoch')`. This made an audit check pass vacuously — it
reported 3 rows where 57 were expected. Audits now refuse to issue a verdict if the row
count looks implausible.

**`pkill -f "server.ts"` kills your own shell**, because the pattern appears in the command
line you are running. Use `fuser -k -n tcp 3000` instead.

**The TTC portal publishes double-encoded text.** Delay-code descriptions arrive as UTF-8
bytes that already encode mojibake (`c3 a2 c2 80 c2 93` for an en-dash). Decoding correctly
is not enough — the extra encoding round must be undone. See `repairMojibake`.

**`color-scheme: dark light` hands native controls back to the system.** The two-value form
says the page *supports* both and lets the OS pick, so on a machine set to light Chrome painted
the `<select>` and its popup light while `D-42` painted everything around them dark — an
invisible dropdown, on a page whose own theme is explicit. Dark is this app's choice, not the
system's, so `:root` states one value (`dark`) and `[data-theme="light"]` states the other.
`option` elements also need their own colours: the popup is drawn by the browser and does not
inherit page tokens.

**MapLibre: `zoom` may only feed a top-level `step`/`interpolate`.** A per-feature factor
cannot wrap the ramp; put it inside each stop's output instead.

**MapLibre rejects a relative `sprite` URL.** The tile proxy builds an absolute one from the
request origin, so it works behind the dev proxy and in production without config.

**Vite does not emit MapLibre's web worker** when it pre-bundles the package — the worker
404s, the canvas stays blank, and nothing errors on the main thread. `optimizeDeps.exclude`
must list `maplibre-gl`.

**Do not forward `content-encoding` when proxying with `fetch`.** The body is already
decompressed; echoing the header makes the browser try to gunzip plain bytes.

**Chromium in this sandbox cannot reach tile hosts** even through the proxy, though Node
can. Tiles are proxied through the API — which is the right production choice anyway.

**Playwright scripts must run from the project directory** so they resolve the ESM
`"type": "module"` context. A script in `/tmp` fails to import `playwright`. If the bundled
browser build is missing, launch with `executablePath: "/opt/pw-browsers/chromium"` rather
than running `playwright install`.

**Headless Chromium can composite a stale white band over the map canvas.** After a DOM
change that grows a scrollable panel above the WebGL canvas, a screenshot may show the top
of the map blank while the map is drawing correctly. Two independent checks proved it is a
capture artifact, not a bug: `queryRenderedFeatures` returned every feature, and reading the
canvas back inside a `render` handler gave identical pixels in both states. **Before
chasing a blank map, read the canvas back** — `drawImage` the map canvas onto an offscreen
2D context inside `map.once("render", ...)` and sample it.

**`map.once("idle")` never fires if the map is already idle.** A screenshot script that
awaits it hangs forever. Race it against a timeout.

**Fit the map to measured chrome, not to constants.** The topbar and the sheet both float
over the canvas and both change height. `chromePadding()` in `MapView.tsx` reads their live
rects; the hardcoded insets it replaced drew half of every planned route underneath the
results sheet.

**Printing an hour with `% 24` hides which service day it is.** A window of 03:28–30:35 came
out as "03:28 to 06:35", which read as a gap and was written into a decision as "we have not
ingested Blue Night". All 35 Blue Night routes were in the data. Format service-day times as
`30:35`, or say "the next morning".

**A fixed search window breaks monotonicity.** Working back from a deadline over a fixed
three-hour lookback meant arriving by 03:34 found a bus and 03:34:01 found nothing. A looser
constraint must never return fewer answers — widen the window until something is found rather
than bounding it once.

**`contains` matches inside words.** "CN" found M**cN**icoll Ave and, because the ranking
put prefix matches first and nothing was a prefix match, offered it as the top hit. Require a
word boundary; an empty result is better than a confident wrong one.

**Anchor times to `America/Toronto`, not the device.** `getHours()` is right for a resident
and three hours wrong for a visitor whose phone is still on Pacific time.

**Do not round a stored value that other code divides.** `disruptionRisk` was stored at four
decimals while `oneInTrips` was computed from the unrounded number, so a trip displaying
"1 in 1323" was ranked on a risk of 1 in 1250 — enough to cross a verdict threshold.

**Synthetic testers find defects, never validate personas.** Four agents driving the app
through `scripts/drive.mjs` found eleven real bugs (E-D22), six of them in code that was
carefully argued and covered by tests. They cannot answer `D-08`: an agent's reaction is
training data, not a rider.

**GTFS service days run past midnight.** This feed's weekday service spans 03:28 to 30:35 —
06:35 the next morning. Comparing a wall-clock 01:45 against that window made the planner
report "no journey" for a 01:14 departure sitting in its own data. Put a wall-clock time in
the service day first (`inServiceDay`). Found only because the time control was defaulted to
*now* and the app happened to run at 01:34.

**Slice both sides of a ratio, or neither.** Peak-hour incidents over all-day trips
understates peak by the factor peak service exceeds the daily mean. Risk is incidents per
trip; if the numerator is conditioned the denominator must be too. See `frequency.ts`.

**A band gated on observed events keeps only the bad bands.** The first time-of-day audit
gated each band on incidents it had accumulated, so quiet bands vanished and every survivor
looked worse than the pooled figure — a median above 1.0 in all five bands, which is
impossible for a trip-weighted decomposition and was the tell. Gate on *expected* events
instead; an observed zero where three were predicted is evidence, not absence of it.

**`coalesce(get(x), 0)` in a colour ramp turns missing data into the best possible value.**
A planned trip drew its unmeasured stretches at the green end of the scale for a whole
milestone — valid expression, correct data, invisible to typecheck and tests. Any feature fed
to `lineColorExpression` must carry `confidence`, and unknown is drawn as a separate dashed
layer, never as a stop on the ramp. See `D-26`.

**A reference class can answer a different question from the one on screen.** The trip
benchmark ranked every real trip in the worst tenth of its class — not because Toronto's
trips are bad, but because the sampled reference had median coverage 0.23 and was therefore
mostly unmeasured and fake-safe. `P-03` applies to reference classes too. Check what the
comparison population actually looks like before believing a percentile.

**A percentile alone oversells on a tight distribution.** A trip 15% riskier than the median
can sit below 86% of its class, and "riskier than most" printed beside two nearly-equal
numbers reads as spin. A verdict needs rank *and* a ratio (`MATERIAL_RATIO`).

**A "share of the total" threshold fires on an even split.** Two equal legs each carry just
over half a journey's risk, so any share threshold at or below 50% names one of them as the
worst. Dominance is a ratio against the runner-up (`WORST_DOMINANCE`), not a share of the sum.

**A threshold that produces absurd advice is the wrong shape of answer, not a wrong number.**
Departure advice first recommended a buffer above a disruption rate — and told riders to
leave 58 minutes early for a twice-a-year event. Expected value fails the other way. The fix
was to stop recommending: state the rate and the price, and let the rider weigh a penalty
only they know. Kept visible in `D-24`.

**A transfer walk is not necessarily outdoors.** Changing from Line 1 to Line 2 at St George
is a footpath in the graph and a corridor in life. Summing walk legs to say how long a rider
is outside added five minutes of January to a trip that never left the building. Both
endpoints resolving to the same station means indoors.

**A threshold is only as good as the distribution nobody looked at.** The obvious candidate
for "infrequent service" was the TTC's own 10-minute frequent-service standard — which turns
out to be the *median* headway behind a weekday departure, so a tag drawn there would have
appeared on half of all service. Measure the population before picking the line; see
`audit:headway`.

**Warming one cache moves the cliff; it does not remove it.** The journey graph was built
lazily, so the first rider after a deploy waited 12.3 s. Warming it at boot left the first
`/plan` at 2.89 s, because pooled severity and the latest-observation lookup are lazy too.
The cheap check is in `warmScoring`: time the first `/plan` after a boot against the second.
More than a few milliseconds apart means something lazy is missing.

**`mtime` is not a content identity.** The connection cache keyed on the GTFS archive's size
and mtime, which a Docker `COPY`, a git checkout and an `rsync` all change while preserving
the bytes — so it would have been refused in exactly the environment it exists for, and the
only symptom would be a slower boot nobody investigates. Hash the content; 36 MB costs 34 ms.

**A spread hides what you ship.** `...j` on a scored journey put `path` on the wire — 74 KB
of a 185 KB response that the client does not declare, does not read, and already has in
another encoding as `geojson`. Name the fields you mean to send.

**`streets.ts` strips N/S/E/W anywhere in a name, which is right for intersections and wrong
for addresses.** It keyed "North Queen St" as `QUEEN`, so "100 Queen St West" geocoded to 100
North Queen St — a different street 12 km away, with nothing on screen to show for it.
`geocode.ts` has its own key that keeps every word and treats only a *trailing* direction as
identity. Two normalisers, on purpose; do not merge them.

**Never prettify a name on the path into a lookup.** `displayStopName` runs on the way to
the screen only. Scoring keys on the raw GTFS name because the segment index was built from
it — the same shape of mistake that pinned journey coverage at 7.7%.

**A ratio whose numerator and denominator increment on the same line can only report 100%.**
`if (fewer) { comparable++; rankedMore++; }` measured nothing and reported "46 of 46 — the
ranking never prefers the simpler trip", which is exactly the kind of unanimity that should
be suspicious. The pre-registered audit put the real figure at 73.1%. **Before believing a
measurement that came out clean, check the counters can actually disagree.**

**`Journey` carries no `id` — the API adds one when it serialises.** Comparing candidates
off-server with `a.id !== b.id` compares `undefined` with `undefined`, which is `false`, so
every difference vanishes and the script reports perfect agreement. Caught only because 43%
pair-concordance and "0% differ" cannot both be true. Compare by reference, or by a field
that exists at the layer you are in.

**A scan is cheap on a short trip and not on a long one.** `plan()` timed at 0–4 ms against
three downtown pairs, which made "generate a wide pool, it's free" look obvious; on a
citywide sample a pool of twelve measured 125.6 ms p50, worse than returning six. Time the
population you will run on, not the example you had to hand.

**More candidates can find fewer good ones.** Widening the alternatives pool past six *lowers*
the rate at which a materially safer option is found, because the extra journeys ban two
routes at once and crowd out the single-ban alternatives in the diversity pick. Sweep the
parameter; do not assume a search knob is monotone.

---

## Standing gaps

Named so they are not silently carried:

- **GTFS-Realtime is consumed for alerts, and at route level for live vehicles.** A
  stop-level countdown is not possible: the `bustime.ttc.ca` feeds use a different identifier
  space from the static GTFS — 1 trip id in 2,301 matches, and stop ids collide by
  coincidence so the obvious join is silently wrong at over half of all stops (`E-D29`).
  Route ids match 180 of 181, which is what `D-47` builds on. J-02 and J-03 stay blocked on a
  crosswalk neither publisher provides.
- **Alerts carry no `active_period`.** Presence in the latest snapshot is the only evidence
  an alert is live, so the app reports the snapshot's age and stops claiming to know past
  twelve hours. Silence would read as "nothing is wrong today".
- **`D-08` is open, and is now the largest gap.** Every persona is provisional — derived
  from research and data, never from talking to a Toronto rider. Q-A is the highest-value question: does a mostly-unknown
  map read as honest or as broken? Every milestone in the plan is now built; Q-C, Q-E and Q-F
  have stacked up behind the same missing input.
