import { describe, it, expect } from "vitest";
import { BANDS, bandOf, bandOfSeconds, inServiceDay, serviceDayTimes, spanLabel } from "../time-bands.js";

describe("bands", () => {
  it("covers every hour exactly once", () => {
    const seen = new Map<number, string[]>();
    for (let h = 0; h < 24; h++) {
      seen.set(h, BANDS.filter((b) => h >= b.from && h < b.to).map((b) => b.id));
    }
    for (const [hour, ids] of seen) expect(ids, `hour ${hour}`).toHaveLength(1);
  });

  it("puts the peaks where the TTC does", () => {
    expect(bandOf(6).id).toBe("am-peak");
    expect(bandOf(8).id).toBe("am-peak");
    expect(bandOf(9).id).toBe("midday");
    expect(bandOf(15).id).toBe("pm-peak");
    expect(bandOf(19).id).toBe("evening");
    expect(bandOf(0).id).toBe("night");
  });

  it("reads a GTFS time past midnight as the hour a rider would call it", () => {
    // 25:10 is 01:10, which is night — not evening, and not out of range.
    expect(bandOfSeconds(25 * 3600 + 10 * 60).id).toBe("night");
    expect(bandOfSeconds(8 * 3600 + 30 * 60).id).toBe("am-peak");
    // 30:00 is 06:00 the next morning, where am peak starts.
    expect(bandOfSeconds(30 * 3600).id).toBe("am-peak");
  });
});

describe("serviceDayTimes", () => {
  // This feed's weekday service: 03:28 through 30:35 (06:35 next morning).
  const window = { from: 3 * 3600 + 28 * 60, to: 30 * 3600 + 35 * 60 };

  it("gives one reading for an hour that can only mean one thing", () => {
    expect(serviceDayTimes(9 * 3600, window)).toEqual([9 * 3600]);
    expect(serviceDayTimes(18 * 3600, window)).toEqual([18 * 3600]);
  });

  it("gives both readings for an early-morning hour, later first", () => {
    // 04:00 is service that has just started AND the tail of yesterday's,
    // still running as 28:00. Trying only the first found nothing to catch.
    expect(serviceDayTimes(4 * 3600, window)).toEqual([28 * 3600, 4 * 3600]);
    expect(serviceDayTimes(5 * 3600, window)).toEqual([29 * 3600, 5 * 3600]);
  });

  it("gives only the previous service day before today's begins", () => {
    expect(serviceDayTimes(1 * 3600 + 45 * 60, window)).toEqual([25 * 3600 + 45 * 60]);
    expect(serviceDayTimes(0, window)).toEqual([24 * 3600]);
  });

  it("hands back the literal time when the schedule covers neither", () => {
    // The caller says it cannot answer for that hour rather than quietly
    // planning a different one.
    const narrow = { from: 5 * 3600, to: 20 * 3600 };
    expect(serviceDayTimes(2 * 3600, narrow)).toEqual([2 * 3600]);
  });
});

describe("inServiceDay", () => {
  const window = { from: 3 * 3600 + 28 * 60, to: 30 * 3600 + 35 * 60 };

  it("takes the fuller service day when an hour has two readings", () => {
    expect(inServiceDay(4 * 3600, window)).toBe(28 * 3600);
    expect(inServiceDay(9 * 3600, window)).toBe(9 * 3600);
  });
});

describe("spanLabel", () => {
  const band = (id: string) => BANDS.find((b) => b.id === id)!;

  it("keeps one band's own label", () => {
    expect(spanLabel([band("am-peak")])).toBe("6 to 9am");
  });

  it("names a crossing as one span, not two labels glued together", () => {
    // Printed "6 to 9am to 9am to 3pm" on the toggle before.
    expect(spanLabel([band("am-peak"), band("midday")])).toBe("6am to 3pm");
    expect(spanLabel([band("midday"), band("pm-peak")])).toBe("9am to 7pm");
  });

  it("says midnight, not 0am or 12am, across the end of the day", () => {
    expect(spanLabel([band("evening"), band("night")])).toBe("7pm to 6am");
    expect(spanLabel([band("night"), band("am-peak")])).toBe("midnight to 9am");
  });

  it("falls back when no band was ridden", () => {
    expect(spanLabel([])).toBe("at this time");
  });
});
