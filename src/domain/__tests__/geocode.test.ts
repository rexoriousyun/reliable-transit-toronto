import { describe, it, expect } from "vitest";
import { addressStreetKey, parseAddress } from "../geocode.js";

describe("parseAddress", () => {
  it("reads a number and street", () => {
    expect(parseAddress("487 Lauder Ave")).toEqual({ number: 487, street: "LAUDER", direction: null });
  });

  it("strips a trailing direction and keeps it", () => {
    expect(parseAddress("100 Queen St West")).toEqual({ number: 100, street: "QUEEN", direction: "W" });
    expect(parseAddress("500 Lawrence Ave E")).toEqual({ number: 500, street: "LAWRENCE", direction: "E" });
  });

  /**
   * The bug this exists for: `streets.ts` strips N/S/E/W anywhere in a name, so
   * "North Queen St" keyed as QUEEN and "100 Queen St West" resolved to 100
   * North Queen St — a different street 12 km away, with nothing to show for it.
   */
  it("keeps a leading direction, which is part of the name", () => {
    expect(parseAddress("100 North Queen St")).toEqual({ number: 100, street: "NORTH QUEEN", direction: null });
  });

  it("refuses what is not an address", () => {
    expect(parseAddress("Lauder Ave")).toBeNull();
    expect(parseAddress("King")).toBeNull();
  });
});

describe("addressStreetKey", () => {
  it("separates the same number on opposite arms of one street", () => {
    expect(addressStreetKey("Lawrence", "E")).toBe("LAWRENCE|E");
    expect(addressStreetKey("Lawrence", "W")).toBe("LAWRENCE|W");
  });

  it("keeps every word of the name", () => {
    expect(addressStreetKey("North Queen", "")).toBe("NORTH QUEEN");
    expect(addressStreetKey("Lower Sherbourne", "")).toBe("LOWER SHERBOURNE");
  });
});
