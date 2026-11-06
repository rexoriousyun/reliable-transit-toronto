/**
 * The states the sheet can be in when it has no answer to give.
 *
 * "Planning…" was the whole set. Every other case — no saved trip, a stale
 * alerts feed, a route we can plan but cannot forecast, no network — either
 * looked identical to success or looked like a bug.
 *
 * Each of these says what is true and what it means for the rider, in that
 * order. None of them apologise, and none of them imply the app is broken when
 * it is the *data* that is missing — `P-03`'s rule applied to whole screens
 * rather than to single numbers.
 */

export type StateKind = "empty" | "loading" | "stale" | "thin" | "offline";

export function StateCard({
  kind,
  detail,
}: {
  kind: StateKind;
  /** Fills the one slot each message leaves — a time, mostly. */
  detail?: string;
}): JSX.Element {
  return (
    <div className={`state state-${kind}`} role={kind === "loading" ? "status" : undefined}>
      {kind === "loading" && <span className="state-spinner" aria-hidden="true" />}
      <p className="state-text t-body">{copy(kind, detail)}</p>
    </div>
  );
}

function copy(kind: StateKind, detail?: string): string {
  switch (kind) {
    case "empty":
      return "No usual trip yet.";
    // Says what it is doing and why it takes a moment. A spinner alone invites
    // the rider to guess, and what they guess about a transit app is that it
    // has hung.
    case "loading":
      return detail === undefined
        ? "Checking 1.2 million connections against what actually happened…"
        : `Checking 1.2 million connections against ${detail} of what actually happened…`;
    // The feed carries no active_period, so presence in the latest snapshot is
    // the only evidence an alert is live (D-29). Past twelve hours we say we
    // could not check rather than showing nothing — silence would read as
    // "nothing is wrong today".
    case "stale":
      return "Today's detours may be missing.";
    // We can route it; we cannot forecast it. Two different capabilities, and
    // conflating them would either hide a working trip or promise a figure we
    // do not have (P-03).
    case "thin":
      return "We can route this, but we can't forecast it.";
    case "offline":
      return detail === undefined
        ? "Showing your last forecast."
        : `Showing your last forecast, from ${detail}.`;
  }
}
