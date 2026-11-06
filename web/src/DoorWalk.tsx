import type { AccessWalk } from "./api.js";

/**
 * The walk at each end of the trip.
 *
 * Until a rider could give an address, a trip began at a stop they were assumed
 * to already be standing at — so the first and last mile were invisible and
 * every door-to-door figure on the card was short by however long they take.
 * For `U-02` in the inner suburbs, where stops are sparse, that is not a
 * rounding error.
 *
 * **Stated as "about", and the reason is in the number.** Distances are
 * straight-line, so each of these is a floor rather than an estimate — a real
 * walking route bends around blocks. Printing "5 min" flat would be a precision
 * we have not earned (`P-03`).
 *
 * The stop is named because it is the thing the rider has to find. "Walk 4 min"
 * is an instruction with the useful half missing.
 *
 * These minutes are *inside* the arrival time on the verdict above, not extra
 * to it — the headline reports when the rider reaches the door. Listing them
 * here is showing the work, not adding to the total.
 */
export function DoorWalk({
  access,
  egress,
}: {
  access: AccessWalk | null;
  egress: AccessWalk | null;
}): JSX.Element {
  const total = (access?.seconds ?? 0) + (egress?.seconds ?? 0);
  return (
    <div className="doorwalk">
      <p className="doorwalk-head t-micro">
        About {Math.max(1, Math.round(total / 60))} min walking
        {/* Only "door to door" when both ends actually are doors. With one
            address the phrase overstates what was planned. */}
        {access !== null && egress !== null ? ", door to door" : ""}
      </p>
      <ul className="doorwalk-list">
        {access !== null && (
          <li className="t-body-s">
            <span className="doorwalk-leg" aria-hidden="true" />
            About <strong>{Math.max(1, Math.round(access.seconds / 60))} min</strong> to{" "}
            {access.stopName}
          </li>
        )}
        {egress !== null && (
          <li className="t-body-s">
            <span className="doorwalk-leg" aria-hidden="true" />
            About <strong>{Math.max(1, Math.round(egress.seconds / 60))} min</strong> from{" "}
            {egress.stopName}
          </li>
        )}
      </ul>
    </div>
  );
}
