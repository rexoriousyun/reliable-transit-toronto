import { describe, it, expect } from "vitest";
import {
  classifyDisruption, causeOf, hasShuttle, withoutRoutePrefix, clusterAlerts,
  isServiceAffecting, moreSevere, alertAgeHours, ALERTS_STALE_AFTER_HOURS, snapshotTime,
} from "../disruption.js";

/** Verbatim from the live feed on 2026-08-29. */
const FEED = {
  detour: "506 Carlton: Detour via Ossington Ave, Dundas St W and Bay St due to a blocked track.",
  detourDirectional: "329 Dufferin: Detour southbound via Dufferin St, Viceroy, Futurity Gt and Gerry Fitzgerald Dr due to a collision.",
  bypass: "16 Mccowan: Bypass near Scarborough Centre Station at Bus Bay 9 while we respond to a security incident.",
  noService: "510 Spadina: No service between Queens Quay Loop at Lower Spadina Ave and Union Station Streetcar Platform due to the CNE.",
  shuttle: "Line 5 Eglinton: No service between Leaside and Avenue stations due to a disruptive customer. Shuttle buses are on the way.",
  elevator: "Cedarvale: Elevator out of service between platform and upper concourse while we perform maintenance.",
  psaPayment: "Have proof of payment ready for inspection.",
  psaCyclists: "Please look both ways for cyclists before exiting.",
};

describe("classifyDisruption", () => {
  it("reads the kind out of the text, since the feed's enum is always UNKNOWN", () => {
    expect(classifyDisruption(FEED.detour)).toBe("detour");
    expect(classifyDisruption(FEED.detourDirectional)).toBe("detour");
    expect(classifyDisruption(FEED.bypass)).toBe("bypass");
    expect(classifyDisruption(FEED.noService)).toBe("no-service");
    expect(classifyDisruption(FEED.shuttle)).toBe("no-service");
    expect(classifyDisruption(FEED.elevator, true)).toBe("elevator");
  });

  it("treats an unrecognised alert as a notice, not a disruption", () => {
    // These are attached to real routes. Warning a rider about their trip
    // because of them is how an app teaches people to ignore its warnings.
    expect(classifyDisruption(FEED.psaPayment)).toBe("notice");
    expect(classifyDisruption(FEED.psaCyclists)).toBe("notice");
    expect(classifyDisruption("")).toBe("notice");
  });
});

describe("causeOf", () => {
  it("lifts the cause in the TTC's own words, article and all", () => {
    // The article is what makes it read as a sentence rather than a field.
    expect(causeOf(FEED.detour)).toBe("a blocked track");
    expect(causeOf(FEED.bypass)).toBe("a security incident");
    expect(causeOf(FEED.noService)).toBe("the CNE");
    expect(causeOf("37 Islington: Detour via Rexdale Blvd due to a demonstration.")).toBe("a demonstration");
  });

  it("gives nothing rather than a guess when no cause is stated", () => {
    expect(causeOf(FEED.psaPayment)).toBeNull();
  });
});

describe("hasShuttle", () => {
  it("notices a shuttle, because it changes what a rider does", () => {
    expect(hasShuttle(FEED.shuttle)).toBe(true);
    expect(hasShuttle(FEED.detour)).toBe(false);
  });
});

describe("withoutRoutePrefix", () => {
  it("strips the route so one incident can be recognised across routes", () => {
    expect(withoutRoutePrefix(FEED.bypass)).toBe(
      "Bypass near Scarborough Centre Station at Bus Bay 9 while we respond to a security incident.",
    );
    expect(withoutRoutePrefix(FEED.elevator)).toBe(
      "Elevator out of service between platform and upper concourse while we perform maintenance.",
    );
  });

  it("leaves text alone when there is no prefix", () => {
    expect(withoutRoutePrefix(FEED.psaPayment)).toBe(FEED.psaPayment);
  });
});

describe("clusterAlerts", () => {
  const alert = (id: string, description: string, routeIds: string[], isElevator = false) =>
    ({ id, description, routeIds, isElevator });

  it("collapses one incident published once per route", () => {
    // The live feed carried this same security incident on 17 routes.
    const routes = ["16", "21", "38", "43", "95", "129", "130"];
    const out = clusterAlerts(routes.map((r, i) =>
      alert(`a${i}`, `${r} Route: Bypass near Scarborough Centre Station at Bus Bay 9 while we respond to a security incident.`, [r])));
    expect(out).toHaveLength(1);
    expect(out[0]!.routeIds).toEqual(routes);
    expect(out[0]!.kind).toBe("bypass");
    expect(out[0]!.cause).toBe("a security incident");
  });

  it("keeps genuinely different incidents on one route apart", () => {
    const out = clusterAlerts([
      alert("a", "305 Dundas: Detour via Parliament St due to police activity.", ["305"]),
      alert("b", "305 Dundas: No service between Lansdowne and Bloor while we respond to a medical emergency.", ["305"]),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((d) => d.kind).sort()).toEqual(["detour", "no-service"]);
  });

  it("drops notices entirely", () => {
    expect(clusterAlerts([alert("a", FEED.psaPayment, ["7", "84", "104"])])).toEqual([]);
  });
});

describe("severity", () => {
  it("ranks a closure above a bypass above a detour", () => {
    expect(moreSevere("detour", "no-service")).toBe("no-service");
    expect(moreSevere("bypass", "detour")).toBe("bypass");
    expect(moreSevere("detour", "detour")).toBe("detour");
  });

  it("separates the kinds that stop a trip from the kinds that slow it", () => {
    expect(isServiceAffecting("no-service")).toBe(true);
    expect(isServiceAffecting("bypass")).toBe(true);
    expect(isServiceAffecting("detour")).toBe(false);
  });
});

describe("alert freshness", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 7, 29, 12 - h, 0, 0));
  const now = new Date(Date.UTC(2026, 7, 29, 12, 0, 0));

  it("measures how old the snapshot is", () => {
    expect(alertAgeHours(at(3), now)).toBeCloseTo(3, 5);
    expect(alertAgeHours(at(0), now)).toBe(0);
  });

  it("never reports a negative age from a clock skew", () => {
    expect(alertAgeHours(new Date(now.getTime() + 60000), now)).toBe(0);
  });

  it("holds the registered staleness bar", () => {
    // The feed carries no active_period, so presence in the latest fetch is the
    // only evidence an alert is live. Past the bar we say we do not know.
    expect(alertAgeHours(at(ALERTS_STALE_AFTER_HOURS - 1), now)).toBeLessThan(ALERTS_STALE_AFTER_HOURS);
    expect(alertAgeHours(at(ALERTS_STALE_AFTER_HOURS + 1), now)).toBeGreaterThan(ALERTS_STALE_AFTER_HOURS);
  });
});

describe("snapshotTime", () => {
  const t = (iso: string): Date => new Date(iso);

  it("is the newest stored alert", () => {
    expect(snapshotTime([t("2026-11-07T10:00Z"), t("2026-11-07T12:00Z")], null)).toEqual(t("2026-11-07T12:00Z"));
  });

  it("counts a fetch that found no alerts, so a quiet day is not read as unchecked", () => {
    expect(snapshotTime([], t("2026-11-07T12:00Z"))).toEqual(t("2026-11-07T12:00Z"));
  });

  it("takes the later of the rows and the last fetch", () => {
    expect(snapshotTime([t("2026-11-07T12:00Z")], t("2026-11-07T09:00Z"))).toEqual(t("2026-11-07T12:00Z"));
    expect(snapshotTime([t("2026-11-07T09:00Z")], t("2026-11-07T12:00Z"))).toEqual(t("2026-11-07T12:00Z"));
  });

  it("is unknown when nothing has ever been fetched", () => {
    expect(snapshotTime([], null)).toBeNull();
  });
});
