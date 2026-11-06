import { useEffect, useState } from "react";
import { fetchLiveRoutes, type LiveRoutesResult } from "./api.js";

/**
 * Is this route moving right now?
 *
 * The half of `J-02` this data can actually answer. A stop-level countdown is
 * not available — the realtime feed's stop and trip ids are a different
 * identifier space from the schedule, so joining them produces a confident
 * wrong answer (see `realtime.ts`). Route ids do match, so "is anything running
 * on the 31" is answerable and "when is the next one" is not.
 *
 * That is a smaller claim, and it is the one `E-D23` says matters most: 36.1%
 * of all rider-waiting is a vehicle that never came, and on the 31 Greenwood it
 * is 74%. A rider standing at that stop is not asking for a countdown they have
 * learned to distrust (`PR-08`) — they are asking whether anything is coming at
 * all.
 *
 * **Absent is unknown, never zero.** The feed carries surface routes; the
 * subway is not in it, and a route with nothing running does not appear rather
 * than appearing at zero. Printing "0 running" for either would be inventing
 * the difference between "stopped" and "not covered" (`P-03`).
 */
export function LiveNow({ routeIds }: { routeIds: string[] }): JSX.Element | null {
  const [live, setLive] = useState<LiveRoutesResult | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLiveRoutes()
      .then((r) => { if (alive) setLive(r); })
      .catch(() => { if (alive) setLive(null); });
    return () => { alive = false; };
  }, []);

  if (live === null || live.stale) return null;

  const reporting = routeIds
    .map((id) => ({ id, n: live.vehicles[id] }))
    .filter((r) => r.n !== undefined) as Array<{ id: string; n: number }>;
  const unseen = routeIds.filter((id) => live.vehicles[id] === undefined);

  if (reporting.length === 0 && unseen.length === 0) return null;

  return (
    <p className="livenow t-meta">
      <span className="livenow-dot" aria-hidden="true" />
      {reporting.length > 0 && (
        <>
          {reporting.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <strong>{r.id}</strong>: {r.n} running
            </span>
          ))}
        </>
      )}
      {reporting.length > 0 && unseen.length > 0 && " · "}
      {unseen.length > 0 && (
        // Not "0 running". We cannot tell a stopped route from one the feed
        // does not carry, and the two are opposite facts.
        <span className="livenow-unseen">
          can&rsquo;t see {unseen.length === 1 ? `the ${unseen[0]}` : `${unseen.length} of these routes`}
        </span>
      )}
    </p>
  );
}
