import { Fragment } from "react";
import { hhmmDay } from "./clock.js";
import { percent } from "./rate.js";
import type { JourneyLeg, ScoredJourney } from "./api.js";
import { legReliabilityFor, type View } from "./view.js";
import { ConfidenceMark, levelForCoverage } from "./Confidence.js";


const mins = (a: number, b: number): number => Math.max(1, Math.round((b - a) / 60));

/**
 * Step by step, on a rail.
 *
 * Behind a tap, because a rider choosing between options does not need the
 * legs — they need the duration and the risk. Once they have chosen, the
 * steps are the thing they will actually follow, so they open in place rather
 * than on another screen (P-09).
 *
 * **The rail is the second channel.** Each leg's stroke is weighted by how much
 * of the trip's risk it carries, so the shape of the journey — where the danger
 * actually is — is readable before a word of it is. Walks are dashed and waits
 * are thin: neither is a stretch we measured, and drawing them at the same
 * weight as a scored ride would imply we had (`P-03`). A `ConfidenceMark` sits
 * at every node, so no number on this screen appears without its certainty
 * (`D-45`).
 *
 * The toggle that used to live here is gone: `VerdictCard`'s "Step by step"
 * button now controls whether this is mounted at all, and two controls for one
 * disclosure meant a rider could open it and see nothing.
 */
export function JourneyDetail({
  journey,
  view,
}: {
  journey: ScoredJourney;
  view: View;
}): JSX.Element {
  return (
    <div className="detail">
      <ol className="legs">
          {journey.legs.map((l, i) => {
            // The gap between arriving and the next departure is waiting, and
            // waiting is the thing this app measures. Folding it into a leg
            // would hide the one cost a rider actually feels (D-02).
            const prev = journey.legs[i - 1];
            const wait = prev === undefined ? 0 : Math.round((l.departAt - prev.arriveAt) / 60);
            // The scheduled gap is what the timetable promises; the headway is
            // what a vehicle not turning up actually costs. Riders have learned
            // not to believe the first (PR-08), and nothing on this screen used
            // to qualify it (D-34).
            const headway = journey.waits.find((w) => w.legIndex === i)?.headwayMinutes ?? null;
            return (
              <Fragment key={`${l.kind}-${i}`}>
                {wait >= 2 && (
                  <li className="leg leg-wait">
                    <span className="leg-time" />
                    <span className="leg-rail" aria-hidden="true">
                      <span className="rail-node rail-unknown" />
                      <span className="rail-line rail-line-wait" />
                    </span>
                    <span className="leg-body">
                      <span className="leg-what">Wait at {prev!.toName}</span>
                      <span className="leg-dur">{wait} min</span>
                    </span>
                    {headway !== null && (
                      <span className="leg-headway">{headway} min to the next one</span>
                    )}
                  </li>
                )}
                <li className={`leg leg-${l.kind}`}>
                  <span className="leg-time">{hhmmDay(l.departAt, journey.departAt)}</span>
                  <span className="leg-rail" aria-hidden="true">
                    <span className={`rail-node rail-${nodeLevel(l, view)}`} />
                    <span
                      className={`rail-line rail-line-${l.kind}`}
                      style={l.kind === "ride" ? { width: railWeight(l, view) } : undefined}
                    />
                  </span>
                  <span className="leg-body">
                    <span className="leg-what">
                      {l.kind === "walk" ? (
                        <>Walk to {l.toName}</>
                      ) : (
                        <>
                          <span className="route-chip">{l.routeId ?? "?"}</span> to {l.toName}
                        </>
                      )}
                    </span>
                    <span className="leg-dur">{mins(l.departAt, l.arriveAt)} min</span>
                  </span>
                  {l.disruptions.length > 0 && (
                    <span className="leg-today">
                      {l.disruptions[0]!.kind === "no-service"
                        ? "No service on part of this route today"
                        : l.disruptions[0]!.kind === "bypass"
                          ? "Skipping some stops today"
                          : "On detour today"}
                    </span>
                  )}
                  {legReliabilityFor(l, view) !== null && (
                    <span className="leg-risk">
                      {legReliabilityFor(l, view)!.oneInTrips === null ? (
                        // Never folded into the trip's figure and never left
                        // to look like the reliable end of the scale (P-03).
                        "Not enough data on this stretch"
                      ) : (
                        <>
                          Goes wrong on <strong>{percent(legReliabilityFor(l, view)!.risk)}</strong> of trips{" "}
                          <span className="rate-side">1 in {legReliabilityFor(l, view)!.oneInTrips}</span>
                          {legReliabilityFor(l, view)!.isWorst && (
                            <strong> — most of this trip&rsquo;s risk</strong>
                          )}
                          {legReliabilityFor(l, view)!.coverage < 0.5 &&
                            `, measured on ${Math.round(legReliabilityFor(l, view)!.coverage * 100)}% of it`}
                        </>
                      )}
                    </span>
                  )}
                </li>
              </Fragment>
            );
          })}
          <li className="leg leg-end">
            <span className="leg-time">{hhmmDay(journey.arriveAt, journey.departAt)}</span>
            <span className="leg-rail" aria-hidden="true">
              <span className="rail-node rail-measured" />
            </span>
            <span className="leg-body">
              <span className="leg-what">Arrive {journey.legs[journey.legs.length - 1]?.toName}</span>
            </span>
          </li>
      </ol>
    </div>
  );
}

/**
 * How heavy this leg's rail is drawn.
 *
 * Weighted by the share of the trip's risk it carries, so the eye lands on the
 * stretch that matters. The threshold is the design's: above a quarter of the
 * risk the rail thickens to 6px, and everything else stays at 2px. A leg we
 * could not score gets the thin line rather than the thick one — unknown is not
 * "probably fine", but it is also not evidence of danger (`P-03`).
 */
function railWeight(leg: JourneyLeg, view: View): number {
  const r = legReliabilityFor(leg, view);
  return r !== null && r.isWorst ? 6 : 2;
}

/** The certainty mark that belongs at this leg's node. */
function nodeLevel(leg: JourneyLeg, view: View): "measured" | "thin" | "unknown" {
  if (leg.kind === "walk") return "unknown";
  const r = legReliabilityFor(leg, view);
  if (r === null || r.oneInTrips === null) return "unknown";
  return levelForCoverage(r.coverage);
}
