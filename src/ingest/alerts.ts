/**
 * GTFS-RT service alerts.
 *
 * The feed is a live snapshot with no history and no `active_period`, so each
 * run replaces the stored set rather than appending. Every alert reports
 * `UNKNOWN_EFFECT` — the TTC does not populate the enum — so classification is
 * from the description text.
 */

// The package is CommonJS, so the namespace comes off the default export
// rather than as a named import.
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const { transit_realtime } = GtfsRealtimeBindings;
import { prisma } from "../db/client.js";
import { stationFromAlert, isElevatorAlert } from "../domain/accessibility.js";

const ALERTS_URL = "https://bustime.ttc.ca/gtfsrt/alerts";

interface TranslatedLike {
  translation?: Array<{ text?: string | null }> | null;
}

function firstTranslation(text: TranslatedLike | null | undefined): string {
  return text?.translation?.[0]?.text ?? "";
}

/** The last fetch that succeeded in this process, alerts or none. */
let lastFetch: Date | null = null;
export const lastAlertsFetch = (): Date | null => lastFetch;

export async function ingestAlerts(): Promise<{ total: number; elevator: number }> {
  const res = await fetch(ALERTS_URL);
  if (!res.ok) throw new Error(`Alerts feed failed (${res.status})`);

  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(await res.arrayBuffer()));

  const records = feed.entity
    .filter((e) => e.alert !== null && e.alert !== undefined)
    .map((e) => {
      const alert = e.alert!;
      const description = firstTranslation(alert.descriptionText);
      const elevator = isElevatorAlert(description);
      return {
        id: e.id,
        header: firstTranslation(alert.headerText),
        description,
        routeIds: JSON.stringify(
          (alert.informedEntity ?? []).map((i) => i.routeId ?? i.stopId ?? "").filter((v) => v !== ""),
        ),
        // Only elevator alerts get a station parsed: a route detour also has a
        // prefix, and reading "506 Carlton" as a station would be wrong.
        stationName: elevator ? stationFromAlert(description) : null,
        isElevator: elevator,
      };
    });

  // One transaction, so a plan read mid-refresh never sees an empty table:
  // the server now runs this every few minutes while riders are planning.
  await prisma.$transaction([
    prisma.serviceAlert.deleteMany(),
    prisma.serviceAlert.createMany({ data: records }),
  ]);
  lastFetch = new Date();

  return { total: records.length, elevator: records.filter((r) => r.isElevator).length };
}
