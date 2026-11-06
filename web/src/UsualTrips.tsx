import type { SavedTrip } from "./recent.js";
import { tripKey } from "./recent.js";

/**
 * The trips this rider actually takes.
 *
 * `F-02` has opened with a "saved trip?" branch since it was drawn, and that
 * branch has never had an interface — every morning started with two searches
 * for the same two stops. `D-44` keeps the list local: five at most, most
 * recent first, no account.
 *
 * It is deliberately not a "favourites" feature with a star to manage. A trip
 * earns its place by being planned, and leaves by falling off the end or by
 * being removed. Nothing to curate.
 */
export function UsualTrips({
  trips,
  onOpen,
  onRemove,
}: {
  trips: SavedTrip[];
  onOpen: (trip: SavedTrip) => void;
  onRemove: (key: string) => void;
}): JSX.Element {
  return (
    <div className="usual">
      <p className="usual-head t-micro">Your usual trips</p>
      <ul className="usual-list">
        {trips.map((t) => {
          const key = tripKey(t.from, t.to);
          return (
            <li key={key} className="usual-row">
              <button type="button" className="usual-open" onClick={() => onOpen(t)}>
                <span className="usual-pair t-body">
                  {t.from.name} <span className="usual-arrow" aria-hidden="true">→</span>{" "}
                  {t.to.name}
                </span>
              </button>
              <button
                type="button"
                className="usual-remove"
                aria-label={`Forget ${t.from.name} to ${t.to.name}`}
                onClick={() => onRemove(key)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
