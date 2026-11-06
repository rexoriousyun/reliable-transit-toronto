/**
 * Where the numbers come from, and how old they are.
 *
 * Every figure on screen is drawn from the TTC's published delay records, which
 * run a month or two behind. A rider is owed the dates before trusting a
 * forecast, and the open data licence asks for its credit line.
 */

import type { AboutData } from "./api.js";

const LICENCE_URL = "https://open.toronto.ca/open-data-license/";

/** "2026-09-30" -> "Sep 2026". The dates are already Toronto-local. */
export function monthYear(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function DataNote({ about }: { about: AboutData | null }): JSX.Element {
  const d = about?.delays;
  return (
    <p className="quiet data-note">
      {d?.from != null && d.to != null && (
        <>
          TTC delay records, {monthYear(d.from)} to {monthYear(d.to)}.{" "}
        </>
      )}
      Contains information licensed under the{" "}
      <a href={LICENCE_URL} target="_blank" rel="noreferrer">
        Open Government Licence – Toronto
      </a>
      .
    </p>
  );
}
