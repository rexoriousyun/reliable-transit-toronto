/**
 * The issue rate as a percentage, the way the rider reads it first (Rex,
 * 2026-11-07: "keep percentage as main and the other as side").
 *
 * Two significant figures, never a fixed number of decimals. `E-D28` measured
 * that per-trip risk lives almost entirely inside the first percent (median
 * 0.218%), so whole percents print "0%" for 74.4% of journeys and one decimal
 * still prints "0.0%" for 12.6%. Significant figures keep every rate distinct:
 * 1 in 2,326 is 0.043%, 1 in 459 is 0.22%, 1 in 106 is 0.94%.
 */
export function percent(risk: number): string {
  const p = Math.max(0, risk) * 100;
  if (p === 0) return "0%";
  if (p >= 10) return `${Math.round(p)}%`;
  // toPrecision keeps two significant figures; Number() drops a trailing zero
  // ("1.0" -> 1) and never reaches exponent form at these magnitudes.
  return `${Number(p.toPrecision(2))}%`;
}

/** The same rate from a "1 in N" figure, for places the server sends only N. */
export const percentOfOneIn = (oneIn: number): string => percent(1 / oneIn);
