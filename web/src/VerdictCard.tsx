import type { ReactNode } from "react";
import type { Comparison, PlanResult, ScoredJourney } from "./api.js";
import { hhmm, hhmmDay } from "./clock.js";
import { percent, percentOfOneIn } from "./rate.js";
import { reliabilityFor, type View } from "./view.js";
import { ConfidenceBand, ConfidenceMark, levelForCoverage } from "./Confidence.js";
import { TripTags } from "./TripTags.js";
import { LiveNow } from "./LiveNow.js";

/**
 * The answer, as one block instead of seven.
 *
 * The plan sheet used to stack ViewToggle, RouteKey, TripTags, DepartureAdvice,
 * Benchmark, JourneyDetail, an advice-basis note and a footer — every one of
 * them correct, all of them at the same size. The verdict was on screen but it
 * did not *lead*, which is concept item 3 and `P-06`: answer the decision, do
 * not render a dashboard.
 *
 * Four blocks before the buttons, in the order a rider needs them:
 *
 * 1. **When to leave**, and what usually happens.
 * 2. **How much of this we actually measured** — the band, not a caveat in prose.
 * 3. **What it costs to be safe, and what one no-show costs** — the two prices.
 * 4. **Which stretch carries the risk**, tappable onto the map.
 *
 * Everything the old stack said is still said. What changed is that the numbers
 * carrying a claim now sit above the numbers qualifying it, and the
 * qualification is a mark or a bar rather than a sentence competing with the
 * answer for the same 13px.
 */
export function VerdictCard({
  journey,
  view,
  alerts,
  stepFree,
  egressSeconds,
  focusedSegment,
  onFocusSegment,
  onSteps,
  onOthers,
}: {
  journey: ScoredJourney;
  view: View;
  alerts: { ageHours: number | null; stale: boolean } | undefined;
  stepFree: PlanResult["stepFree"];
  /** The walk from the last stop to the door, when the rider gave an address. */
  egressSeconds: number;
  /** The worst stretch is focused on the map; null when it is not. */
  focusedSegment: string | null;
  onFocusSegment: (id: string | null) => void;
  onSteps: () => void;
  onOthers: (() => void) | null;
}): JSX.Element {
  const rel = reliabilityFor(journey, view);
  const advice = journey.advice;
  const late = advice !== null && advice.slackMinutes < 0;

  // Arrival is the subject whether or not a deadline was given: "there by
  // 09:07" is the thing a rider is deciding about. Without a deadline the
  // journey's own arrival is the same claim.
  // Arrival at the *door*, not at the last stop.
  //
  // The headline used to read "There by 18:17" on a trip whose final walk ended
  // at 18:21 — the app had just learned to plan from an address and was still
  // reporting stop to stop. The walk is the rider's, so the time that matters
  // is the one they are actually home at.
  const typicalArrival = (advice === null ? journey.arriveAt : advice.arriveAt) + egressSeconds;
  const anchor = advice === null ? journey.departAt : advice.leaveAt;
  const badArrival = advice?.disrupted == null ? null : advice.disrupted.arriveAt + egressSeconds;

  const worst = rel.dominant;
  // Identity, not the displayed name. `dominant` is title-cased on the way out
  // and the drawn features carry raw station names, so matching on text would
  // miss silently — the same shape of mistake `displayStopName` is kept off
  // every lookup path to avoid.
  const worstId = worst?.segmentId ?? null;
  const level = levelForCoverage(rel.coverage);

  return (
    <div className={`verdict${late ? " verdict-late" : ""}`}>
      <TripTags journey={journey} view={view} alerts={alerts} stepFree={stepFree} />

      {/* Whether these routes are moving right now. Route-level only — the
          realtime feed cannot be joined to our stops (see realtime.ts) — which
          answers "is anything coming" but never "when". */}
      <LiveNow
        routeIds={[...new Set(journey.legs.flatMap((l) => (l.routeId === undefined ? [] : [l.routeId])))]}
      />

      {/* 1 — the answer */}
      <div className="verdict-lead">
        <p className="verdict-head t-h2">
          {late
            ? `Best is ${hhmmDay(typicalArrival, anchor)}`
            : advice === null
              ? `There by ${hhmmDay(typicalArrival, anchor)}`
              : `Leave ${hhmm(advice.leaveAt)}`}
        </p>
        <p className="verdict-sentence t-body">
          {late ? (
            <>
              Nothing this way makes it — <strong>{Math.abs(advice!.slackMinutes)} min late</strong>.
            </>
          ) : (
            <>
              You'll usually be there by <strong>{hhmmDay(typicalArrival, anchor)}</strong>.
              {badArrival !== null && rel.oneInTrips !== null && (
                <>
                  {/* How often is the rate line's job now; the sentence says
                      what a bad day costs, so the figure is not printed twice. */}
                  {" "}When it goes wrong, closer to{" "}
                  <strong>{hhmmDay(badArrival, anchor)}</strong>.
                </>
              )}
            </>
          )}
          {/* The mark rides the sentence rather than replacing the "little
              data" tag with silence: every number gets its certainty within
              8px of it (D-45). */}
          <ConfidenceMark level={level} />
        </p>
      </div>

      {/* How often this trip goes wrong, as a percentage first (Rex,
          2026-11-07). "1 in N" stays beside it, smaller, for the reader who
          thinks in trips. The mark keeps the figure's certainty within 8px
          of it (D-45): on a thinly measured trip this is a floor. */}
      {rel.oneInTrips !== null && (
        <p className="rate-line">
          <span className="rate-main t-stat">{percent(rel.disruptionRisk)}</span>
          <span className="rate-label t-body-s">
            of trips go wrong
            {/* Bound to its extent when the figure covers a minority of the
                trip. The band below shows the proportion, but this is where
                the number is read. */}
            {rel.coverage < 0.5 && `, on the ${Math.round(rel.coverage * 100)}% we can measure`}
          </span>
          <span className="rate-side">1 in {rel.oneInTrips}</span>
          <ConfidenceMark level={level} />
        </p>
      )}

      {/* 2 — how much of this is measured. The band says in one bar what the
          "little data" tag said only past a threshold, and says it on every
          trip rather than on the bad ones (P-03). */}
      <ConfidenceBand
        measuredPct={rel.coverage}
        color={bandColour(rel.comparison)}
        label={benchmarkLabel(journey, view)}
      />

      {/* 3 — the two prices. Priced, never prescribed: what a buffer is worth
          depends on what being late costs this rider, which we do not know
          (D-24). */}
      {(advice?.covered != null || journey.notableWait !== null) && (
        <div className="verdict-tiles">
          {advice?.covered != null && (
            <PriceTile
              label="To be safe"
              value={hhmm(advice.covered.leaveAt)}
              detail={`${advice.covered.extraMinutes} min earlier, every day.`}
            />
          )}
          {journey.notableWait !== null && (
            <PriceTile
              label={`If the ${journey.legs[journey.notableWait.legIndex]?.routeId ?? "bus"} doesn't come`}
              value={`${journey.notableWait.headwayMinutes} min`}
              detail={
                journey.notableWait.outdoors
                  ? `to the next one, outside at ${journey.legs[journey.notableWait.legIndex]?.fromName ?? "the stop"}.`
                  : `to the next one, at ${journey.legs[journey.notableWait.legIndex]?.fromName ?? "the stop"}.`
              }
            />
          )}
        </div>
      )}

      {/* 4 — which stretch. Dominance is decided on the server against the
          next-worst, not as a share of the total (WORST_DOMINANCE). */}
      {worst !== null && rel.oneInTrips !== null && (
        <button
          type="button"
          className={`worst-row${focusedSegment === worstId ? " is-active" : ""}`}
          aria-pressed={focusedSegment === worstId}
          onClick={() => onFocusSegment(focusedSegment === worstId ? null : worstId)}
        >
          <span className="worst-text t-body-s">
            Most of the risk is the{" "}
            <strong>
              {worst.from} to {worst.to}
            </strong>
            .
          </span>
          <span className="worst-chevron" aria-hidden="true">
            {focusedSegment === worstId ? "×" : "›"}
          </span>
        </button>
      )}

      <div className="verdict-actions">
        <button type="button" className="btn btn-primary" onClick={onSteps}>
          Step by step
        </button>
        {onOthers !== null && (
          <button type="button" className="btn" onClick={onOthers}>
            Other ways
          </button>
        )}
      </div>
    </div>
  );
}

function PriceTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): JSX.Element {
  return (
    <div className="tile">
      <span className="tile-label t-micro">{label}</span>
      <span className="tile-value t-stat">{value}</span>
      <span className="tile-detail t-meta">{detail}</span>
    </div>
  );
}

/**
 * The bar takes its colour from the verdict printed beneath it.
 *
 * The first version bucketed `oneInTrips` at thresholds picked by eye, and it
 * immediately contradicted itself: a trip reading *"safer than 4 in 5 trips
 * this long"* drew an amber bar, because 1-in-223 looked middling in the
 * abstract while being good for a trip of that length. Risk is only meaningful
 * against a reference class (`E-D21`), and the server has already decided which
 * side this trip falls on — inventing a second scale here just gave the rider
 * two answers.
 *
 * "About typical" earns no colour. An ordinary trip is not news, and colouring
 * it spends attention on the one verdict that asks nothing of the reader — the
 * same call the benchmark line has always made.
 */
function bandColour(comparison: Comparison | null): string {
  if (comparison === null) return "var(--ink-3)";
  switch (comparison.verdict) {
    case "safer-4in5":
    case "safer-most":
      return "var(--scale-1)";
    case "riskier-most":
    case "riskier-4in5":
      return "var(--scale-3)";
    default:
      return "var(--ink-3)";
  }
}

/**
 * The benchmark, moved under the band.
 *
 * Fifths rather than percentages: a reference of a few hundred sampled trips
 * does not support "safer than 87%", and that precision invites a trust it has
 * not earned (`PR-08`). Unchanged wording from the component this absorbs.
 */
function benchmarkLabel(journey: ScoredJourney, view: View): ReactNode {
  const c = reliabilityFor(journey, view).comparison;
  // No comparison means the trip is too thinly measured to rank against its
  // class (`MIN_COMPARABLE_COVERAGE`). The first version said "Measured" here,
  // directly beside a bar reading "62% not measured" — two claims about the
  // same trip, contradicting each other, in one line.
  if (c === null) return "Too little history to compare";
  const words = {
    "safer-4in5": "Safer than 4 in 5 trips this long",
    "safer-most": "Safer than most trips this long",
    "riskier-most": "Riskier than most trips this long",
    "riskier-4in5": "Riskier than 4 in 5 trips this long",
    typical: "About typical for trips this long",
  }[c.verdict];
  // The ranking stays in fifths, not percentages: that is a rank against a
  // few hundred sampled trips, not a rate (see Benchmark.tsx).
  if (c.typicalOneInTrips === null) return words;
  return (
    <>
      {words} · typical is {percentOfOneIn(c.typicalOneInTrips)}{" "}
      <span className="rate-side">1 in {c.typicalOneInTrips}</span>
    </>
  );
}
