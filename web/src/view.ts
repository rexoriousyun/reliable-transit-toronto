import type { JourneyLeg, JourneyReliability, LegRisk, ScoredJourney } from "./api.js";

/**
 * Which measurement a rider is looking at.
 *
 * Per-trip risk varies by time of day, and the variation persists (E-D20), so
 * the all-day figure that shipped until now misstates a commuter's exposure by
 * around 20% in the morning. It is still the right figure to *compare* against
 * — it is the same number for every trip on the route, at every hour — so both
 * stay available rather than one replacing the other.
 */
export type View = "atTime" | "allDay";

/** Reliability under the selected view, falling back when nothing conditioned. */
export function reliabilityFor(j: ScoredJourney, view: View): JourneyReliability {
  return view === "atTime" ? (j.atTime ?? j.reliability) : j.reliability;
}

export function legReliabilityFor(l: JourneyLeg, view: View): LegRisk | null {
  return view === "atTime" ? (l.reliabilityAtTime ?? l.reliability) : l.reliability;
}

/** The map property carrying exposure under the selected view. */
export function exposureProperty(view: View): string {
  return view === "atTime" ? "gapMinutesPerMonthAtTime" : "gapMinutesPerMonth";
}

/**
 * How the window is named on screen. One band on almost every trip; a long
 * journey can cross one, and then the honest label is the span it covers.
 */
export function bandLabel(j: ScoredJourney): string {
  // Named on the server, where the bands' hours are defined (spanLabel).
  return j.atTime?.span ?? "at this time";
}
