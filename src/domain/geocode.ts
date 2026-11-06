/**
 * "487 Lauder Ave" to a point on the map.
 *
 * The planner took GTFS stop ids, so a trip began wherever the rider had
 * already walked to. This resolves a street address instead, against Toronto's
 * own address points — no geocoding API, no key, consistent with every other
 * source in this project.
 *
 * **Direction is part of the street's identity here.** `streets.ts` strips
 * N/S/E/W as noise, which is right for matching an intersection: "King and
 * Parliament" and "King St East at Parliament St" are the same corner. It is
 * wrong for a house number. 487 Lawrence Ave East and 487 Lawrence Ave West are
 * four kilometres apart, so the direction is kept in the key and a query that
 * omits it is treated as ambiguous rather than resolved to whichever came first.
 */

import { prisma } from "../db/client.js";

/**
 * Street types, stripped from a typed query.
 *
 * `streets.ts` has a similar list and is deliberately not reused: it also
 * strips N/S/E/W *anywhere in the name*, which is correct for matching an
 * intersection and wrong here. It keyed "North Queen St" as `QUEEN`, so
 * "100 Queen St West" resolved to 100 North Queen St — a different street, 12 km
 * away, returned with no sign anything was wrong.
 */
const TYPES = new Set([
  "ST", "STREET", "AVE", "AV", "AVENUE", "RD", "ROAD", "BLVD", "BOULEVARD",
  "DR", "DRIVE", "CRES", "CRESCENT", "PKWY", "PARKWAY", "WAY", "TR", "TRL",
  "TRAIL", "CT", "COURT", "GDNS", "GARDENS", "SQ", "SQUARE", "CIR", "CIRCLE",
  "LANE", "LN", "PL", "PLACE", "TERR", "TERRACE", "HWY", "HIGHWAY", "GT", "GATE",
  "MEWS", "PATH", "GRV", "GROVE", "HTS", "HEIGHTS", "PROM", "PROMENADE",
]);

/** Uppercase, punctuation out, spaces collapsed. Every word kept. */
function normalise(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

/** Direction suffixes, normalised to a single letter. */
const DIRECTIONS: Record<string, string> = {
  N: "N", NORTH: "N",
  S: "S", SOUTH: "S",
  E: "E", EAST: "E",
  W: "W", WEST: "W",
};

/**
 * The key an address is stored and looked up under.
 *
 * Built from the city's own `LINEAR_NAME`, which is already the street name
 * without its type or direction — "Queen", "North Queen", "Lauder". Every word
 * is kept: "Lower Sherbourne" and "Sherbourne" are different streets, and so
 * are "North Queen" and "Queen".
 *
 * The direction goes in the key rather than being discarded, because at a house
 * number it is identity: 487 Lawrence Ave East and 487 Lawrence Ave West are
 * four kilometres apart.
 */
export function addressStreetKey(name: string, direction = ""): string | null {
  const base = normalise(name);
  if (base === "") return null;
  const dir = DIRECTIONS[normalise(direction)] ?? "";
  return dir === "" ? base : `${base}|${dir}`;
}

export interface ParsedAddress {
  number: number;
  /** Street key without a direction. */
  street: string;
  /** The direction the rider typed, or null when they did not. */
  direction: string | null;
}

/**
 * Reads a house number and street out of what a rider typed.
 *
 * Deliberately narrow: a leading integer, then a street name. Unit numbers
 * ("487-2", "Unit 4, 487 Lauder") are not parsed — the door is the same place
 * either way, and guessing at formats we have not seen would fail silently
 * rather than obviously.
 */
export function parseAddress(query: string): ParsedAddress | null {
  const match = /^\s*(\d{1,6})\s+(.+?)\s*$/.exec(query);
  if (match === null) return null;
  const number = Number.parseInt(match[1]!, 10);
  if (!Number.isFinite(number) || number <= 0) return null;

  let words = normalise(match[2]!).split(" ").filter((w) => w !== "");

  // A trailing direction is stripped and remembered. Only trailing: a leading
  // "North" belongs to the name ("North Queen St") and removing it would point
  // at a different street.
  let direction: string | null = null;
  const last = words[words.length - 1];
  if (last !== undefined && DIRECTIONS[last] !== undefined && words.length > 1) {
    direction = DIRECTIONS[last]!;
    words = words.slice(0, -1);
  }

  // Then the type, which may now be last ("Queen St West" -> "QUEEN ST" -> "QUEEN").
  const tail = words[words.length - 1];
  if (tail !== undefined && TYPES.has(tail) && words.length > 1) words = words.slice(0, -1);

  const street = words.join(" ");
  if (street === "") return null;
  return { number, street, direction };
}

export interface GeocodeHit {
  label: string;
  lat: number;
  lon: number;
  /** True when the number was not found and a neighbour on the street was used. */
  approximate: boolean;
}

/**
 * The closest address on that street to the number asked for.
 *
 * **An exact match is preferred and a near one is labelled.** Address points
 * are not contiguous — 487 may not exist where 485 and 489 do, and refusing the
 * query would be unhelpful when the rider is standing outside. So the nearest
 * number on the same street is used and `approximate` is set, which the
 * interface must show rather than quietly rounding a rider's home to the
 * neighbour's (`P-03`).
 *
 * **Ambiguity is returned, not resolved.** A street that runs both East and
 * West with no direction given yields every candidate; picking one would be
 * inventing which side of the city the rider lives on.
 */
export async function geocode(query: string, limit = 5): Promise<GeocodeHit[]> {
  const parsed = parseAddress(query);
  if (parsed === null) return [];

  const keys = parsed.direction === null
    // No direction typed: every direction this street runs in is a candidate.
    ? [parsed.street, `${parsed.street}|N`, `${parsed.street}|S`, `${parsed.street}|E`, `${parsed.street}|W`]
    : [`${parsed.street}|${parsed.direction}`, parsed.street];

  const rows = await prisma.addressPoint.findMany({
    where: { streetKey: { in: keys } },
    select: { label: true, lat: true, lon: true, number: true },
  });
  if (rows.length === 0) return [];

  // Nearest by house number, then deduplicated by the number itself: a street
  // with points on both sides yields two rows for one address, and offering the
  // same address twice reads as two choices.
  const seen = new Set<number>();
  return rows
    .sort((a, b) => Math.abs(a.number - parsed.number) - Math.abs(b.number - parsed.number))
    .filter((r) => {
      if (seen.has(r.number)) return false;
      seen.add(r.number);
      return true;
    })
    .slice(0, limit)
    .map((r) => ({
      label: r.label,
      lat: r.lat,
      lon: r.lon,
      approximate: r.number !== parsed.number,
    }));
}
