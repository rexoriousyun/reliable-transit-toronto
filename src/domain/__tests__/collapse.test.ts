import { describe, it, expect } from "vitest";
import { collapsePointlessRides } from "../walk.js";

/** Points laid on a line, so distances are predictable. ~1 km per 0.009 lat. */
const P: Record<string, { lat: number; lon: number }> = {
  a: { lat: 43.650, lon: -79.400 },
  b: { lat: 43.659, lon: -79.400 }, // ~1.0 km from a
  c: { lat: 43.661, lon: -79.400 }, // ~0.2 km from b
  far: { lat: 43.750, lon: -79.400 }, // ~11 km from a
};
const coordOf = (id: string): { lat: number; lon: number } | undefined => P[id];
const walk = (fromStop: string, toStop: string, departAt: number, arriveAt: number): Leg =>
  ({ kind: "walk", fromStop, toStop, departAt, arriveAt });

interface Leg {
  kind: "ride" | "walk";
  routeId?: string;
  fromStop: string;
  toStop: string;
  departAt: number;
  arriveAt: number;
}
const m = (x: number): number => x * 60;
const shape = (legs: Leg[]): string =>
  legs.map((l) => (l.kind === "ride" ? `ride ${l.routeId}` : "walk")).join(" > ");

describe("collapsePointlessRides", () => {
  it("drops a ride whose walking overhead exceeds it", () => {
    // The shape that made this necessary: walk a long way, ride one minute,
    // then walk back to roughly where the ride started. Door to door the ride
    // has bought nothing, and walking a->b directly is shorter than the three
    // legs together.
    const legs: Leg[] = [
      { kind: "walk", fromStop: "a", toStop: "b", departAt: m(0), arriveAt: m(12) },
      { kind: "ride", routeId: "63", fromStop: "b", toStop: "c", departAt: m(14), arriveAt: m(15) },
      { kind: "walk", fromStop: "c", toStop: "b", departAt: m(15), arriveAt: m(18) },
    ];
    expect(shape(collapsePointlessRides(legs, coordOf, walk))).toBe("walk");
  });

  it("keeps a short ride that is not wrapped in walking", () => {
    // A one-minute hop between two stations is not suspicious on its own — the
    // rule is about overhead, not about duration.
    const legs: Leg[] = [
      { kind: "ride", routeId: "5", fromStop: "b", toStop: "c", departAt: m(0), arriveAt: m(1) },
      { kind: "ride", routeId: "1", fromStop: "c", toStop: "far", departAt: m(2), arriveAt: m(16) },
    ];
    expect(shape(collapsePointlessRides(legs, coordOf, walk))).toBe("ride 5 > ride 1");
  });

  it("keeps a ride that genuinely saves time", () => {
    const legs: Leg[] = [
      { kind: "ride", routeId: "1", fromStop: "a", toStop: "far", departAt: m(0), arriveAt: m(14) },
    ];
    expect(shape(collapsePointlessRides(legs, coordOf, walk))).toBe("ride 1");
  });

  /**
   * The bug this exists for: a collapsed stretch leaves a walk that is not one
   * of the original legs. Matching the next ride's leading walks against the
   * input array skipped it, so a second pointless ride was judged without the
   * walking in front of it and survived.
   */
  it("sees a walk it created when judging the next ride", () => {
    const legs: Leg[] = [
      { kind: "walk", fromStop: "a", toStop: "b", departAt: m(0), arriveAt: m(12) },
      { kind: "ride", routeId: "5", fromStop: "b", toStop: "c", departAt: m(13), arriveAt: m(14) },
      { kind: "walk", fromStop: "c", toStop: "b", departAt: m(14), arriveAt: m(16) },
      { kind: "ride", routeId: "63", fromStop: "b", toStop: "c", departAt: m(17), arriveAt: m(18) },
      { kind: "walk", fromStop: "c", toStop: "c", departAt: m(18), arriveAt: m(20) },
    ];
    expect(shape(collapsePointlessRides(legs, coordOf, walk))).toBe("walk");
  });

  it("leaves a journey with no rides alone", () => {
    const legs: Leg[] = [{ kind: "walk", fromStop: "a", toStop: "b", departAt: 0, arriveAt: m(12) }];
    expect(collapsePointlessRides(legs, coordOf, walk)).toHaveLength(1);
  });
});
