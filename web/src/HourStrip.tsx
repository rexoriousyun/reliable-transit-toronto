import { useEffect, useState } from "react";
import { segmentHours, type HourBucket } from "./api.js";

/**
 * How one stretch behaves across the day.
 *
 * Explore used a native `<select>` of twenty-four hours, so seeing the *shape*
 * of a segment's day meant twenty-four reads, each replacing the last. The
 * shape was never visible, which is the only thing an hourly breakdown is for.
 *
 * **Every hour is drawn, including the empty ones.** A bar with too few
 * observations is hatched and carries no number — it is not a quiet hour, it is
 * an hour we cannot speak for, and letting the strip close up over it would
 * turn absence of data into evidence of calm (`P-03`, and the same rule the map
 * follows for unknown segments).
 *
 * Service hours only. The strip runs 05:00–21:00 because the loaded weekday
 * feed thins to almost nothing outside it, and sixteen legible bars beat
 * twenty-four where a third are structurally empty.
 */
const FIRST_HOUR = 5;
const LAST_HOUR = 21;

export function HourStrip({
  segmentId,
  dayOfWeek,
  selected,
  onSelect,
}: {
  segmentId: string;
  dayOfWeek?: string;
  /** The hour being filtered on, or null for the whole day. */
  selected: number | null;
  onSelect: (hour: number | null) => void;
}): JSX.Element | null {
  const [hours, setHours] = useState<HourBucket[] | null>(null);

  useEffect(() => {
    let live = true;
    setHours(null);
    segmentHours(segmentId, dayOfWeek)
      .then((r) => { if (live) setHours(r.hours); })
      .catch(() => { if (live) setHours(null); });
    return () => { live = false; };
  }, [segmentId, dayOfWeek]);

  if (hours === null) return null;

  const shown = hours.filter((h) => h.hour >= FIRST_HOUR && h.hour <= LAST_HOUR);
  // Scaled to this segment's own worst hour, not to the network's. The strip
  // answers "when is this stretch bad", which is a question about its own
  // shape; a shared scale would flatten every quiet segment to nothing.
  const peak = Math.max(...shown.map((h) => h.gapMinutesPerMonth ?? 0), 1);

  return (
    <div className="hourstrip">
      <div className="hourstrip-head">
        <span className="t-micro">Across the day</span>
        {selected !== null && (
          <button type="button" className="hourstrip-clear t-meta" onClick={() => onSelect(null)}>
            Show all day
          </button>
        )}
      </div>
      <div className="hourstrip-bars" role="group" aria-label="Wait caused, by hour">
        {shown.map((h) => {
          const known = h.gapMinutesPerMonth !== null;
          const height = known ? Math.max(4, ((h.gapMinutesPerMonth ?? 0) / peak) * 100) : 100;
          return (
            <button
              key={h.hour}
              type="button"
              className={`hourbar${h.hour === selected ? " is-selected" : ""}${known ? "" : " is-unknown"}`}
              aria-pressed={h.hour === selected}
              aria-label={
                known
                  ? `${h.hour}:00 — ${h.gapMinutesPerMonth} min of wait a month`
                  : `${h.hour}:00 — not enough data`
              }
              title={known ? `${h.gapMinutesPerMonth} min/mo` : "Not enough data"}
              onClick={() => onSelect(h.hour === selected ? null : h.hour)}
            >
              <span className="hourbar-fill" style={{ height: `${height}%` }} />
            </button>
          );
        })}
      </div>
      <div className="hourstrip-axis t-meta">
        <span>{FIRST_HOUR}:00</span>
        <span>{LAST_HOUR}:00</span>
      </div>
    </div>
  );
}
