/**
 * One mark for certainty, used everywhere a number appears (`D-45`).
 *
 * Confidence used to be said three ways — a dashed map line, a dashed tag
 * border, and a sentence — so a rider had to learn three vocabularies for one
 * idea. The concept doc has carried that defect open since 2026-08-28.
 *
 * The mark carries **two channels**, never colour alone: fill *and* border
 * style. That is the same rule the map encoding follows, and it is why this
 * survives greyscale and CVD without a legend.
 *
 * `E-D12` is why it earns the space: 3.1% of segments reach high confidence, so
 * unknown is not an edge case here, it is most of the network.
 */

export type ConfidenceLevel = "measured" | "thin" | "unknown";

export function ConfidenceMark({
  level,
  size = 8,
  label,
}: {
  level: ConfidenceLevel;
  size?: number;
  /** Overrides the default description. Only pass one if context needs it. */
  label?: string;
}): JSX.Element {
  const described = label ?? DESCRIPTION[level];
  return (
    <span
      className={`cmark cmark-${level}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={described}
      title={described}
    />
  );
}

const DESCRIPTION: Record<ConfidenceLevel, string> = {
  measured: "Measured",
  thin: "Thin data — this is a floor, not a total",
  unknown: "Not enough data to say",
};

/**
 * Confidence for a whole trip, as a proportion rather than a mark.
 *
 * A single mark answers "can this number be trusted"; a journey needs "how much
 * of it is this number even about". The bar is the measured share drawn over a
 * hatch, so the unmeasured remainder is *visible as texture* rather than absent
 * — `P-03` in one component. It replaces the "little data" tag, which said the
 * same thing in prose and only past a threshold.
 */
export function ConfidenceBand({
  measuredPct,
  color,
  label,
  unknownLabel,
}: {
  /** 0–1. The share of the trip sitting on segments we could score. */
  measuredPct: number;
  /** The encoding colour for this trip's risk, so the bar reads on one scale. */
  color: string;
  label: string;
  unknownLabel?: string;
}): JSX.Element {
  const pct = Math.max(0, Math.min(1, measuredPct));
  const unmeasured = Math.round((1 - pct) * 100);
  return (
    <div className="cband">
      <div
        className="cband-track"
        role="img"
        aria-label={`${Math.round(pct * 100)}% of this trip is measured`}
      >
        {/* Keyed on the percentage so the fill re-animates when the rider
            switches period — the change is the information (`D-46`). */}
        <div
          key={pct}
          className="cband-fill"
          style={{ width: `${pct * 100}%`, background: color }}
        />
      </div>
      <div className="cband-labels">
        <span>{label}</span>
        {unmeasured > 0 && (
          <span className="cband-unknown">
            {unknownLabel ?? `${unmeasured}% not measured`}
          </span>
        )}
      </div>
    </div>
  );
}

/** Where a journey's coverage falls on the three-state scale. */
export function levelForCoverage(coverage: number): ConfidenceLevel {
  if (coverage <= 0) return "unknown";
  // The same bar the benchmark uses to decide a trip can be compared at all
  // (`MIN_COMPARABLE_COVERAGE`). Below it the figure is a floor, not a total.
  return coverage >= 0.5 ? "measured" : "thin";
}
