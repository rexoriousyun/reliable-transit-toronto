/**
 * What the rider has looked up before, kept on their own device.
 *
 * `D-44`: local only, no accounts, at most five, most recent first. The same
 * rider takes the same trip most days and re-entering it every morning is the
 * cheapest friction in the product — but an account would collect a home
 * address and a commute pattern to save four taps, and `PR-14` records that
 * this product's audience is the part of the city least well served by being
 * asked for more.
 *
 * Every read is defensive. `localStorage` throws in private mode, and a browser
 * that cannot remember a trip must still be able to plan one.
 */

import type { PlaceHit } from "./api.js";

/** `D-44`'s limit. Five is a glanceable list on a phone, not a history. */
const LIMIT = 5;

const STOPS_KEY = "rt.recentStops";
const TRIPS_KEY = "rt.recentTrips";

export interface SavedTrip {
  from: PlaceHit;
  to: PlaceHit;
  /** Epoch ms, so the list can be ordered without keeping an index. */
  savedAt: number;
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // Corrupt or unavailable. An empty list is a working app; a throw is not.
    return [];
  }
}

function write<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, LIMIT)));
  } catch {
    // Storage full or disabled. The session still works, it just forgets.
  }
}

export function recentStops(): PlaceHit[] {
  return read<PlaceHit>(STOPS_KEY).slice(0, LIMIT);
}

/** Move a stop to the front, or add it. Re-picking is a promotion, not a duplicate. */
export function rememberStop(stop: PlaceHit): void {
  const rest = recentStops().filter((s) => s.id !== stop.id);
  write(STOPS_KEY, [stop, ...rest]);
}

export function recentTrips(): SavedTrip[] {
  return read<SavedTrip>(TRIPS_KEY)
    .filter((t) => t.from?.id !== undefined && t.to?.id !== undefined)
    .slice(0, LIMIT);
}

/** A trip is identified by its endpoints; the same pair saved twice is one trip. */
export function tripKey(from: { id: string }, to: { id: string }): string {
  return `${from.id}>${to.id}`;
}

export function rememberTrip(from: PlaceHit, to: PlaceHit): void {
  const key = tripKey(from, to);
  const rest = recentTrips().filter((t) => tripKey(t.from, t.to) !== key);
  write(TRIPS_KEY, [{ from, to, savedAt: Date.now() }, ...rest]);
}

export function forgetTrip(key: string): void {
  write(TRIPS_KEY, recentTrips().filter((t) => tripKey(t.from, t.to) !== key));
}
