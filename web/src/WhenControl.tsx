interface Props {
  mode: "arriveBy" | "departAt";
  seconds: number;
  onChange: (when: { mode: "arriveBy" | "departAt"; seconds: number }) => void;
}

const toInput = (s: number): string =>
  `${String(Math.floor(s / 3600) % 24).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;

const fromInput = (v: string): number => {
  const [h, m] = v.split(":").map(Number);
  return (h ?? 0) * 3600 + (m ?? 0) * 60;
};

/**
 * When the trip has to happen.
 *
 * **"Leave at", now, is the default.** It was arrive-by, on the reasoning that
 * `U-02` works backwards from an obligation — a shift, a clinic slot, a daycare
 * that charges by the minute (`J-01`). That is true of the morning trip the
 * reasoning was written about, and it is not the common case for *opening the
 * app*, which is standing somewhere wanting to go. Arrive-by asks the rider to
 * state a deadline before it will answer, and most of the time there isn't one.
 *
 * Both are one tap apart, so the deadline case is not hidden — it stops being
 * the question every rider is asked first.
 *
 * A native time input, so the phone supplies its own picker rather than a
 * hand-built one that behaves differently on every device (D-15).
 */
export function WhenControl({ mode, seconds, onChange }: Props): JSX.Element {
  return (
    <div className="field when-field">
      <span className="field-label">When</span>
      <select
        value={mode}
        aria-label="Arrive by or leave at"
        onChange={(e) => onChange({ mode: e.target.value as Props["mode"], seconds })}
      >
        <option value="arriveBy">Arrive by</option>
        <option value="departAt">Leave at</option>
      </select>
      <input
        type="time"
        value={toInput(seconds)}
        aria-label="Time"
        onChange={(e) => onChange({ mode, seconds: fromInput(e.target.value) })}
      />
    </div>
  );
}
