/**
 * Municipal address points, so a rider can say where they actually are.
 *
 * Until now `from` and `to` were GTFS stop ids, which meant the trip began at a
 * stop the rider was assumed to already be standing at. The walk to that stop —
 * the first and last mile — was invisible, and every door-to-door figure on
 * screen was short by however long it takes.
 *
 * Toronto's One Address Repository is the keyless source for this, which is why
 * it is used rather than a geocoding API: the whole project runs on public
 * Toronto Open Data and the TTC feed, with no key anywhere, and a rate-limited
 * third party in the request path would be a new way for the app to fail at a
 * bus stop.
 *
 * **Streamed, not read.** The CSV is 183 MB. Every other ingest here parses
 * synchronously because the files are smaller; doing that at this size holds
 * the whole thing plus its parsed form in memory at once.
 *
 * **Four columns of thirty-eight.** The rest describe the address *record* —
 * maintenance stage, ward, class family, two id links — rather than the place.
 */

import { parse } from "csv-parse";
import { Readable } from "node:stream";
import { prisma } from "../db/client.js";
import { findResource } from "./ckan.js";
import { addressStreetKey } from "../domain/geocode.js";

const DATASET = "address-points-municipal-toronto-one-address-repository";

interface Row {
  ADDRESS_NUMBER: string;
  LINEAR_NAME: string;
  LINEAR_NAME_DIR: string;
  ADDRESS_FULL: string;
  geometry: string;
}

/** Rows held before a write. Large enough to be worth a round trip, small
 *  enough that the batch and the parser never both hold much. */
const BATCH = 5000;

export interface AddressIngest {
  read: number;
  written: number;
  /** Rows with no usable number, street or coordinate. */
  skipped: number;
}

export async function ingestAddresses(): Promise<AddressIngest> {
  const resource = await findResource(DATASET, "CSV", (name) => name.includes("4326"));
  const res = await fetch(resource.url);
  if (!res.ok || res.body === null) {
    throw new Error(`Address points download failed (${res.status})`);
  }

  await prisma.addressPoint.deleteMany();

  const parser = Readable.fromWeb(res.body as never).pipe(
    parse({ columns: true, skip_empty_lines: true, bom: true, relax_quotes: true }),
  );

  let read = 0;
  let written = 0;
  let skipped = 0;
  let batch: Array<{ streetKey: string; number: number; lat: number; lon: number; label: string }> = [];

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    await prisma.addressPoint.createMany({ data: batch });
    written += batch.length;
    batch = [];
  };

  for await (const row of parser as AsyncIterable<Row>) {
    read++;
    const number = Number.parseInt(row.ADDRESS_NUMBER ?? "", 10);
    const streetKey = addressStreetKey(row.LINEAR_NAME ?? "", row.LINEAR_NAME_DIR ?? "");
    const point = firstCoordinate(row.geometry ?? "");
    if (!Number.isFinite(number) || streetKey === null || point === null) {
      // No number, no street, or no coordinate is not an address we can plan
      // from. Counted rather than silently dropped, so the rate is visible.
      skipped++;
      continue;
    }
    batch.push({
      streetKey,
      number,
      lat: point.lat,
      lon: point.lon,
      label: (row.ADDRESS_FULL ?? "").trim() || `${number} ${row.LINEAR_NAME}`,
    });
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  return { read, written, skipped };
}

/**
 * The first point out of the CSV's GeoJSON geometry column.
 *
 * Stored as `MultiPoint` even where there is one point, and a handful of
 * records carry several — an apartment block with two entrances. The first is
 * taken rather than the centroid: an entrance is where a rider actually walks
 * from, and averaging two of them puts the origin inside the building.
 */
function firstCoordinate(geometry: string): { lat: number; lon: number } | null {
  if (geometry === "") return null;
  try {
    const parsed = JSON.parse(geometry) as { coordinates?: unknown };
    const coords = parsed.coordinates;
    if (!Array.isArray(coords) || coords.length === 0) return null;
    const first = coords[0];
    if (!Array.isArray(first) || first.length < 2) return null;
    const lon = Number(first[0]);
    const lat = Number(first[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}
