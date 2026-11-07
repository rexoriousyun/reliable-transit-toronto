import { describe, it, expect } from "vitest";
import { percent, percentOfOneIn } from "../rate.js";

describe("percent", () => {
  it("keeps E-D28's whole range distinct instead of rounding it to 0%", () => {
    // p10, p50 and p90 of per-trip risk on the citywide sample.
    expect(percentOfOneIn(2326)).toBe("0.043%");
    expect(percentOfOneIn(459)).toBe("0.22%");
    expect(percentOfOneIn(106)).toBe("0.94%");
  });

  it("uses two significant figures, not fixed decimals", () => {
    expect(percent(0.0123)).toBe("1.2%");
    expect(percent(0.01)).toBe("1%");
    expect(percent(0.00083)).toBe("0.083%");
  });

  it("drops decimals at ten percent and above", () => {
    expect(percent(0.126)).toBe("13%");
    expect(percent(1)).toBe("100%");
  });

  it("says zero only when the risk is zero", () => {
    expect(percent(0)).toBe("0%");
    expect(percent(0.000001)).not.toBe("0%");
  });
});
