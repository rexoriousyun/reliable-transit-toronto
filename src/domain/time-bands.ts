/**
 * Time bands, defined once for both the audit and the product.
 *
 * E-D20 established that per-trip risk varies by time of day and that the
 * variation persists (rho = 0.406 across 953 segment-bands). If the audit that
 * proved it and the scorer that uses it could disagree about where the day is
 * cut, the evidence would stop applying to the thing it was measured on.
 *
 * The splits are the TTC's own peak periods, not equal slices of the clock.
 * Night is separated because service changes shape there rather than merely
 * thinning.
 */

export interface Band {
  id: string;
  /** How a rider would say it. */
  label: string;
  /** Inclusive start hour, exclusive end hour, local time. */
  from: number;
  to: number;
}

export const BANDS: readonly Band[] = [
  { id: "night", label: "midnight to 6am", from: 0, to: 6 },
  { id: "am-peak", label: "6 to 9am", from: 6, to: 9 },
  { id: "midday", label: "9am to 3pm", from: 9, to: 15 },
  { id: "pm-peak", label: "3 to 7pm", from: 15, to: 19 },
  { id: "evening", label: "7pm to midnight", from: 19, to: 24 },
] as const;

/** An hour as a rider says it: "midnight", "6am", "noon", "3pm". */
function hourWord(h: number): string {
  if (h % 24 === 0) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/**
 * How a trip's window is named: one band's own label, or the span from the
 * first band's start to the last one's end.
 *
 * Joining the two labels printed "6 to 9am to 9am to 3pm" on any trip that
 * crossed 9am, on the toggle a rider uses to choose the figure.
 */
export function spanLabel(bands: readonly Band[]): string {
  if (bands.length === 0) return "at this time";
  if (bands.length === 1) return bands[0]!.label;
  return `${hourWord(bands[0]!.from)} to ${hourWord(bands[bands.length - 1]!.to)}`;
}

export function bandOf(hour: number): Band {
  return BANDS.find((b) => hour >= b.from && hour < b.to) ?? BANDS[0]!;
}

/**
 * The band a departure falls in. GTFS times run past midnight — a trip leaving
 * at 25:10 is one a rider would call 01:10, and belongs to night.
 */
export function bandOfSeconds(secondsSinceMidnight: number): Band {
  return bandOf(Math.floor(secondsSinceMidnight / 3600) % 24);
}

/**
 * How much exposure a band needs before its own figure is used instead of the
 * all-day one.
 *
 * Expressed as incidents the *pooled* rate predicts across the trips that
 * actually run in the band, not as incidents observed. Gating on observations
 * would drop every quiet band and leave only the bad ones, which is the bias
 * that made the first run of the time-of-day audit report the opposite result
 * (E-D20). Three is the same bar the evidence was established under.
 */
export const MIN_EXPECTED_IN_BAND = 3;

export const DAY_SECONDS = 24 * 3600;

/**
 * Every service-day time a wall-clock hour could mean, latest first.
 *
 * GTFS runs a service day past midnight — this feed's weekday service spans
 * 03:28 to 30:35, meaning 06:35 the following morning. So 04:00 is *two* valid
 * positions in the schedule: 04:00 at the start of this service day, and 28:00
 * near the end of the one still running from yesterday morning. Both are real
 * service a rider can catch at 4am.
 *
 * **Returning only one of them was a defect.** Shifting a time only when it fell
 * before the window covered 01:45, which has no other reading, but left 04:00
 * and 05:00 read as this service day alone — a window carrying almost nothing,
 * because service has just started. The planner reported no journey for the
 * hours a shift worker leaves.
 *
 * Later first, because a caller looking for the latest departure that makes a
 * deadline should try the fuller service day before falling back.
 */
export function serviceDayTimes(
  seconds: number,
  window: { from: number; to: number },
): number[] {
  const shifted = seconds + DAY_SECONDS;
  const times: number[] = [];
  if (shifted >= window.from && shifted <= window.to) times.push(shifted);
  if (seconds >= window.from && seconds <= window.to) times.push(seconds);
  // Outside the schedule entirely: hand back the literal time so the caller can
  // say so, rather than silently planning for a different hour.
  return times.length > 0 ? times : [seconds];
}

/**
 * The single best service-day reading of a wall-clock time.
 *
 * Kept for callers that need one number rather than a search — the departure
 * advice, which has to state the deadline it worked back from.
 */
export function inServiceDay(seconds: number, window: { from: number; to: number }): number {
  return serviceDayTimes(seconds, window)[0]!;
}
