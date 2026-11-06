import type { ScoredJourney, WalkOption } from "./api.js";

/**
 * Walk, or wait?
 *
 * `J-05`, and the only journey where "which option" is a real question. `D-40`
 * scopes it to the downtown core because that is where the measurement says a
 * second option actually exists — 12.3% of trips against 1.3% citywide
 * (`E-D27`). Elsewhere this does not render, which is the honest output rather
 * than a missing feature.
 *
 * **The app must be willing to say walk.** `F-03`'s design commitment: a
 * transit app that never recommends against transit is not trusted on the
 * occasions when it matters.
 *
 * Two bars on one scale, because the comparison is the point and two numbers
 * in prose make the reader do the subtraction. The transit bar is split into
 * the wait and the ride — the wait is the part that varies and the part `P-02`
 * says to measure.
 */
export function WalkVsWait({
  walk,
  journey,
}: {
  walk: WalkOption;
  journey: ScoredJourney;
}): JSX.Element | null {
  const rideMinutes = journey.typicalMinutes;
  const wait = journey.waits[0]?.scheduledMinutes ?? 0;
  const headway = journey.waits[0]?.headwayMinutes ?? null;
  // What the trip costs if the vehicle the plan named does not turn up. Not a
  // prediction — the headway is a published fact about the timetable (`D-34`).
  const transitWorst = headway === null ? null : rideMinutes + headway;
  const scale = Math.max(walk.minutes, transitWorst ?? rideMinutes, 1);

  const verdict =
    walk.minutes <= rideMinutes
      ? "walk"
      : transitWorst !== null && walk.minutes <= transitWorst
        ? "close"
        : "transit";

  return (
    <div className="wvw">
      <p className="wvw-head t-micro">Walk or wait</p>

      {/* One step below the verdict headline, deliberately. The acceptance
          rule is one verb-sized line per screen, and the answer is still
          "Leave 08:48" — this qualifies it. When walking actually wins the
          colour carries the emphasis instead of the size, which is the same
          trade the encoding scale makes everywhere else. */}
      <p className={`wvw-verdict t-stat${verdict === "walk" ? " wvw-walk-verdict" : ""}`}>
        {verdict === "walk"
          ? "Walk."
          : verdict === "close"
            ? "About the same."
            : "Take it."}
      </p>

      <div className="wvw-bars">
        <Bar
          label="Walking"
          minutes={walk.minutes}
          scale={scale}
          className="wvw-walk"
          // Straight-line, so the real walk is longer. Printed as "about" and
          // never as a precise figure we have not earned (P-03).
          note={`about ${walk.minutes} min · ${(walk.metres / 1000).toFixed(1)} km`}
        />
        <Bar
          label="Wait and ride"
          minutes={rideMinutes}
          scale={scale}
          className="wvw-transit"
          note={
            headway === null
              ? `${rideMinutes} min`
              : `${rideMinutes} min, or ${transitWorst} if the ${
                  journey.legs.find((l) => l.kind === "ride")?.routeId ?? "vehicle"
                } doesn't come`
          }
          tail={transitWorst === null ? null : (transitWorst - rideMinutes) / scale}
          waitShare={wait / Math.max(rideMinutes, 1)}
        />
      </div>
    </div>
  );
}

function Bar({
  label,
  minutes,
  scale,
  className,
  note,
  tail,
  waitShare,
}: {
  label: string;
  minutes: number;
  scale: number;
  className: string;
  note: string;
  /** The share of the axis a missed vehicle would add, drawn hatched. */
  tail?: number | null;
  /** How much of the bar is standing rather than moving. */
  waitShare?: number;
}): JSX.Element {
  return (
    <div className="wvw-row">
      <span className="wvw-label t-body-s">{label}</span>
      <span className="wvw-track">
        <span className={`wvw-fill ${className}`} style={{ width: `${(minutes / scale) * 100}%` }}>
          {waitShare !== undefined && waitShare > 0 && (
            <span className="wvw-wait" style={{ width: `${Math.min(1, waitShare) * 100}%` }} />
          )}
        </span>
        {tail != null && tail > 0 && (
          <span className="wvw-tail" style={{ width: `${tail * 100}%` }} />
        )}
      </span>
      <span className="wvw-note t-meta">{note}</span>
    </div>
  );
}
