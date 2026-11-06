import { useEffect, useRef, useState } from "react";
import { searchPlaces, type PlaceHit } from "./api.js";
import { recentStops, rememberStop } from "./recent.js";
import { ConfidenceMark } from "./Confidence.js";

interface Props {
  label: string;
  value: PlaceHit | null;
  onChange: (place: PlaceHit | null) => void;
}

/**
 * Origin/destination entry.
 *
 * Suggestions appear from two characters and are debounced: a rider typing
 * "Dundas" should not fire six requests, and on a phone the keyboard is already
 * covering half the screen.
 *
 * **Addresses are searched alongside stops.** A rider typing "487 Lauder Ave"
 * is telling us where they are, not which stop they have already walked to, and
 * a trip that begins at a door is the only one whose door-to-door figure is
 * true. A leading house number is what switches the lookup on — "King" means
 * King Station, not 1 King St.
 *
 * A house number that does not exist resolves to the nearest one that does, and
 * that is **marked rather than smoothed over**: rounding somebody's home to the
 * neighbour's without saying so is the small dishonesty `P-03` exists to refuse.
 *
 * **Clicking an empty field shows the last five stops** (`D-44`). The rider
 * this is built for takes the same trip most days, so the most likely answer to
 * "where from?" is somewhere they have already been — offering it costs one tap
 * against eight or nine characters and a wait. Typing replaces the list with
 * matches; the recents are a shortcut, never a filter on what can be searched.
 */
export function StopSearch({ label, value, onChange }: Props): JSX.Element {
  const [text, setText] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<PlaceHit[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (text.trim().length < 2) { setHits([]); return; }
    timer.current = setTimeout(() => {
      searchPlaces(text.trim()).then((r) => setHits(r.places)).catch(() => setHits([]));
    }, 220);
    return () => { if (timer.current !== null) clearTimeout(timer.current); };
  }, [text]);

  const typing = text.trim().length >= 2;
  // Recents are read on focus rather than on mount: the other field writes to
  // the same list, so a value cached at mount would be one trip stale.
  const shown = typing ? hits : recents;

  const choose = (s: PlaceHit): void => {
    rememberStop(s);
    onChange(s);
    setOpen(false);
    setText("");
  };

  return (
    <div className="field">
      <label>
        <span className="field-label">{label}</span>
        <input
          type="text"
          value={value !== null && !open ? value.name : text}
          placeholder="Stop or station"
          onFocus={() => { setOpen(true); setText(""); setRecents(recentStops()); }}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
        />
      </label>
      {open && shown.length > 0 && (
        <ul className="suggestions">
          {!typing && (
            <li className="suggestions-head t-micro" aria-hidden="true">
              Recent
            </li>
          )}
          {shown.map((s) => (
            <li key={s.id}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
              >
                <span className="hit-name">{s.name}</span>
                {s.approximate && (
                  <span className="hit-approx t-meta">
                    <ConfidenceMark level="thin" label="Nearest address we hold" /> nearest we hold
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
