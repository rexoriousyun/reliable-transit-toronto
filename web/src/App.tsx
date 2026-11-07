import { useCallback, useEffect, useRef, useState } from "react";
import { MapView } from "./MapView.js";
import { StopSearch } from "./StopSearch.js";
import { HourStrip } from "./HourStrip.js";
import { WalkVsWait } from "./WalkVsWait.js";
import { DoorWalk } from "./DoorWalk.js";
import { UsualTrips } from "./UsualTrips.js";
import { StateCard } from "./StateCard.js";
import { DataNote, monthYear } from "./DataNote.js";
import { forgetTrip, recentTrips, rememberTrip, type SavedTrip } from "./recent.js";
import type { WalkOption } from "./api.js";
import { JourneyList } from "./JourneyList.js";
import { JourneyDetail } from "./JourneyDetail.js";
import { WhenControl } from "./WhenControl.js";
import { RouteRanking } from "./RouteRanking.js";
import { VerdictCard } from "./VerdictCard.js";
import { ViewToggle } from "./ViewToggle.js";
import { bandLabel, exposureProperty, type View, reliabilityFor } from "./view.js";
import { UNRELIABLE_THRESHOLD, stateOf } from "./map.js";
import {
  fetchRoutes,
  fetchRanking,
  fetchRouteMap,
  fetchAbout,
  planTrip,
  type RouteSummary,
  type RouteMap,
  type Ranking,
  type AboutData,
  type SegmentFeature,
  type ScoredJourney,
  type PlaceHit,
  type AccessWalk,
  type PlanResult,
} from "./api.js";

/** "21 months", from the delay history's own dates. */
function historyLength(about: AboutData | null): string | undefined {
  const d = about?.delays;
  if (d?.from == null || d.to == null) return undefined;
  const months = Math.round((Date.parse(d.to) - Date.parse(d.from)) / (30.44 * 86400000));
  return `${months} months`;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Seconds since midnight, on Toronto's clock rather than the device's.
 *
 * **Anchored to Toronto, not to the device.** `getHours()` reads whatever clock
 * the phone is set to, which is right for a resident and wrong for everyone
 * else: a visitor whose phone is still on Pacific time opens a Toronto transit
 * app and is handed a time three hours out, with nothing on screen to say so.
 * The network runs on Toronto time whoever is looking at it.
 */
function torontoSeconds(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const at = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // "24" appears at midnight in some implementations of hour12: false.
  return (at("hour") % 24) * 3600 + at("minute") * 60;
}

/** Station names arrive upper-cased from the incident feed; riders read signs. */
const titleCase = (v: string): string =>
  v.toLowerCase().replace(/(^|[\s\-/])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());

const hhmm = (s: number): string =>
  `${String(Math.floor(s / 3600) % 24).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;

/** The answer, and only the answer. Everything behind it waits for a tap (P-09). */
function Sheet({
  feature,
  onClose,
  day,
  hour,
  onHour,
}: {
  feature: SegmentFeature;
  onClose: () => void;
  day: string;
  hour: string;
  onHour: (h: number | null) => void;
}): JSX.Element {
  const [showWhy, setShowWhy] = useState(false);
  const p = feature.properties;

  useEffect(() => {
    setShowWhy(false);
  }, [p.segmentId]);

  return (
    <div className="sheet" role="dialog" aria-label="Segment detail">
      <button className="sheet-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="sheet-where">
        {p.from} <span className="arrow">→</span> {p.to}
        {p.isTerminalApproach && <span className="flag">terminal</span>}
      </div>

      {/* The whole day at once, and the hour filter is set from it. */}
      <HourStrip
        segmentId={p.segmentId}
        dayOfWeek={day === "" ? undefined : day}
        selected={hour === "" ? null : Number(hour)}
        onSelect={onHour}
      />

      {/* Loose, deliberately. The server sends `blockedBy: null`, but MapLibre
          strips null properties on the way through its source, so what arrives
          here is `undefined` — which passes a `!== null` guard and then throws
          on `.state`, unmounting the whole app. Tapping any segment in explore
          mode white-screened it. Anything read off `queryRenderedFeatures` has
          to treat absent and null as the same thing. */}
      {p.blockedBy != null && (
        <div className="blocked">
          <strong>
            {p.blockedBy.state === "outage"
              ? `${p.blockedBy.station}: elevator out of service`
              : `${p.blockedBy.station} is not step-free`}
          </strong>
          <span>
            {p.blockedBy.state === "outage"
              ? "Reported by the TTC right now — this may clear."
              : "This station has no step-free route. It will not change today."}
          </span>
        </div>
      )}

      {p.confidence === "unknown" ? (
        <>
          <p className="answer">We don&rsquo;t have enough data on this stretch to say.</p>
          <p className="quiet">
            {p.incidents} recorded {p.incidents === 1 ? "incident" : "incidents"} — shown as
            unknown rather than as reliable.
          </p>
        </>
      ) : (
        <>
          {/* The value gets the weight it earns; the sentence explains it. One
              step of emphasis, not a headline competing with a subhead. */}
          <div className="stat">
            <span className="stat-value">{Math.round(p.gapMinutesPerMonth ?? 0)}</span>
            <span className="stat-unit">min / month</span>
          </div>
          <p className="stat-label">
            {stateOf(p.confidence, p.gapMinutesPerMonth) === "unreliable"
              ? "of waiting caused — among the worst stretches we can measure."
              : "of waiting caused. Usually fine."}
          </p>
          {p.confidence === "low" && (
            <p className="caveat">Based on limited data — treat as a rough signal.</p>
          )}
          <button className="why" onClick={() => setShowWhy(!showWhy)} aria-expanded={showWhy}>
            {showWhy ? "Hide details" : "Why this number?"}
          </button>
          {showWhy && (
            <dl className="why-body">
              <dt>Incidents</dt>
              <dd>{p.incidentsPerMonth} per month</dd>
              <dt>Sample</dt>
              <dd>{p.incidents.toLocaleString()} incidents</dd>
              <dt>Confidence</dt>
              <dd>{p.confidence}</dd>
              {!p.drawnOnStreets && (
                <>
                  <dt>Shape</dt>
                  <dd>approximate — drawn as a straight line</dd>
                </>
              )}
            </dl>
          )}
        </>
      )}
    </div>
  );
}

export function App(): JSX.Element {
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [selected, setSelected] = useState("");
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");
  const [stepFree, setStepFree] = useState(false);

  // Planning is the product (D-14); exploring a route is a mode within it, not
  // the home screen.
  const [mode, setMode] = useState<"plan" | "explore">("plan");
  const [from, setFrom] = useState<PlaceHit | null>(null);
  const [to, setTo] = useState<PlaceHit | null>(null);
  /**
   * Leaving now, unless the rider says otherwise.
   *
   * This was arrive-by at the next quarter hour, on the reasoning that `U-02`
   * works backwards from an obligation (`J-01`). That reasoning still holds for
   * the *morning* trip it was written about — but it is not the common case for
   * opening the app, which is standing somewhere wanting to go. Arrive-by asks
   * the rider to state a deadline before it will answer, and most of the time
   * there isn't one.
   *
   * Exactly now, not rounded up: "leave at" rounded to the next quarter hour
   * silently refuses the next ten minutes of service.
   */
  const [when, setWhen] = useState<{ mode: "arriveBy" | "departAt"; seconds: number }>(() => ({
    mode: "departAt",
    seconds: torontoSeconds(new Date()),
  }));
  const [journeys, setJourneys] = useState<ScoredJourney[] | null>(null);
  const [alerts, setAlerts] = useState<{ ageHours: number | null; stale: boolean } | undefined>();
  const [chosen, setChosen] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  /** Walking the whole way, when downtown makes that a real option (F-03). */
  const [walk, setWalk] = useState<WalkOption | null>(null);
  /** The walk at each end when the rider gave a door rather than a stop. */
  const [doorWalk, setDoorWalk] = useState<{ access: AccessWalk | null; egress: AccessWalk | null }>(
    { access: null, egress: null },
  );
  /** The rider's own trips, local only and at most five (D-44). */
  const [trips, setTrips] = useState<SavedTrip[]>(() => recentTrips());
  const [planNote, setPlanNote] = useState<string | null>(null);
  // Results arrive expanded so the choice is real; picking one folds the sheet
  // back so the map — the retrieval mechanism (D-14) — gets the screen.
  const [listOpen, setListOpen] = useState(true);
  /** The stretch the sheet is pointing the map at, by segment id (D-45). */
  const [focusedSegment, setFocusedSegment] = useState<string | null>(null);
  /** Step by step is behind a button now: it is read after deciding, not during. */
  const [stepsOpen, setStepsOpen] = useState(false);
  // Once the trip is stated, the form has done its job. It folds to one line so
  // the map gets the height back — three input rows is 195px of an 844px phone,
  // and the map is the retrieval mechanism, not the form (D-20).
  const [formOpen, setFormOpen] = useState(true);
  // Defaults to the rider's own travel window. The all-day figure is the one to
  // compare against, not the one to be quoted by default — it misstates a
  // morning commute by around 20% (E-D20).
  const [view, setView] = useState<View>("atTime");
  // A hard constraint, not a preference: for U-04 a station without step-free
  // access is unusable, so it filters the route set before anything is ranked
  // (D-07, P-05).
  const [planStepFree, setPlanStepFree] = useState(false);
  const [stepFreeResult, setStepFreeResult] = useState<PlanResult["stepFree"]>(null);
  const [data, setData] = useState<RouteMap | null>(null);
  const [feature, setFeature] = useState<SegmentFeature | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRanking().then(setRanking).catch(() => setRanking(null));
  }, []);

  /** How old the delay history is, said wherever its figures are (DataNote). */
  const [about, setAbout] = useState<AboutData | null>(null);
  useEffect(() => {
    fetchAbout().then(setAbout).catch(() => setAbout(null));
  }, []);

  useEffect(() => {
    fetchRoutes()
      .then((r) => {
        setRoutes(r.routes);
        const first = r.routes[0];
        if (first) setSelected(`${first.routeId}|${first.direction}`);
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (selected === "") return;
    const [routeId, direction] = selected.split("|") as [string, string];
    setFeature(null);
    fetchRouteMap(routeId, direction, {
      ...(day !== "" ? { dayOfWeek: day } : {}),
      ...(hour !== "" ? { hour: Number(hour) } : {}),
      ...(stepFree ? { stepFree: true } : {}),
    })
      .then(setData)
      .catch((e: unknown) => setError(String(e)));
  }, [selected, day, hour, stepFree]);

  const onSelect = useCallback((f: SegmentFeature | null) => setFeature(f), []);

  // The topbar floats over the canvas and changes height with the mode, so the
  // map's own controls are offset from its measured height rather than a
  // constant that was right for one of the two.
  const topbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = topbarRef.current;
    if (el === null) return;
    const set = (): void =>
      document.documentElement.style.setProperty("--topbar-h", `${Math.round(el.offsetHeight)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  useEffect(() => {
    if (mode !== "plan" || from === null || to === null) return;
    setPlanning(true);
    setPlanNote(null);
    planTrip(from, to, when, planStepFree)
      .then((r) => {
        if (r.journeys && r.journeys.length > 0) {
          // Saved on success, not on entry: a pair that returns no journey is
          // not a trip this rider takes, and offering it back tomorrow would
          // be offering a dead end (D-44).
          setWalk(r.walk ?? null);
          setDoorWalk({ access: r.access ?? null, egress: r.egress ?? null });
          rememberTrip(from, to);
          setTrips(recentTrips());
          setJourneys(r.journeys);
          setAlerts(r.alerts);
          setStepFreeResult(r.stepFree ?? null);
          setChosen(r.journeys[0]!.id);
          setListOpen(r.journeys.length > 1);
          setFormOpen(false);
        } else {
          setJourneys(null);
          setPlanNote(r.reason ?? "No journey found.");
        }
      })
      .catch((e: unknown) => setPlanNote(String(e)))
      .finally(() => setPlanning(false));
  }, [mode, from, to, when, planStepFree]);

  const chosenJourney = journeys?.find((j) => j.id === chosen) ?? null;

  const harmRank = new Map<string, number>();
  for (const list of Object.values(ranking?.modes ?? {})) {
    for (const r of list ?? []) harmRank.set(r.routeId, r.gapMinutesPerMonth);
  }
  const byHarm = [...routes].sort(
    (a, b) => (harmRank.get(b.routeId) ?? -1) - (harmRank.get(a.routeId) ?? -1),
  );
  const selectedRouteId = selected.split("|")[0] ?? "";

  return (
    <div className="app">
      <div className="topbar" ref={topbarRef}>
        <div className="modes" role="tablist" aria-label="Mode">
          <button role="tab" aria-selected={mode === "plan"} onClick={() => setMode("plan")}>Plan a trip</button>
          <button role="tab" aria-selected={mode === "explore"} onClick={() => setMode("explore")}>Explore a route</button>
        </div>

        {mode === "plan" ? (
          formOpen || journeys === null ? (
            <div className="planner">
              <StopSearch label="From" value={from} onChange={setFrom} />
              <StopSearch label="To" value={to} onChange={setTo} />
              <WhenControl mode={when.mode} seconds={when.seconds} onChange={setWhen} />
              <button
                className="access-row"
                aria-pressed={planStepFree}
                onClick={() => setPlanStepFree(!planStepFree)}
              >
                <span className="field-label">Access</span>
                <span className="access-label">Step-free only</span>
                <span className="switch" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button className="planner trip-summary" onClick={() => setFormOpen(true)}>
              {/* Both ends truncate. Ellipsising the line as a whole ate the
                  destination, which is the half a rider is checking. */}
              <span className="trip-ends">
                <span className="trip-end">{from?.name}</span>
                <span className="arrow">→</span>
                <span className="trip-end">{to?.name}</span>
              </span>
              <span className="trip-when">
                {planStepFree && <span className="trip-flag">step-free</span>}
                {when.mode === "arriveBy" ? "by" : "from"} {hhmm(when.seconds)}
              </span>
            </button>
          )
        ) : (
          <>
            {/* Ordered by what each route costs riders. Four hundred entries in
                arbitrary order is a list nobody can read; ordered, the first
                screenful is itself the answer to PR-02. */}
            <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Route">
              {byHarm.map((r) => (
                <option key={`${r.routeId}|${r.direction}`} value={`${r.routeId}|${r.direction}`}>
                  {r.name} · {r.direction}
                </option>
              ))}
            </select>
            <div className="filters">
              <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day">
                <option value="">Any day</option>
                {DAYS.map((d) => <option key={d} value={d}>{d.slice(0, 3)}</option>)}
              </select>
              {/* The 24-entry hour select is gone. Picking one hour at a time
                  meant twenty-four reads to see the shape of a stretch's day,
                  each replacing the last — the HourStrip on the segment sheet
                  shows the whole day at once and sets this filter from it. */}
            </div>
            <button className="toggle" aria-pressed={stepFree} onClick={() => setStepFree(!stepFree)}>
              Step-free only
            </button>
          </>
        )}
      </div>

      {error !== null && <div className="sheet">Could not load: {error}</div>}

      {mode === "plan" ? (
        <div className={`sheet plan-sheet${journeys !== null && !listOpen ? " peek" : ""}`}>
          {journeys !== null && journeys.length > 1 && (
            <button
              className="grabber"
              aria-expanded={listOpen}
              onClick={() => setListOpen(!listOpen)}
            >
              <span className="grabber-bar" />
              <span className="grabber-label">
                {listOpen ? "Hide other ways" : `${journeys.length - 1} other way${journeys.length > 2 ? "s" : ""}`}
              </span>
            </button>
          )}
          {from === null || to === null ? (
            /* F-02 opens on "saved trip?" and never had an interface for it.
               The list is the answer to "where are you going" more often than
               a search is, for the rider this is built for (D-44). */
            <>
              {trips.length > 0 ? (
                <UsualTrips
                  trips={trips}
                  onOpen={(t) => { setFrom(t.from); setTo(t.to); }}
                  onRemove={(key) => { forgetTrip(key); setTrips(recentTrips()); }}
                />
              ) : (
                <StateCard kind="empty" />
              )}
              <DataNote about={about} />
            </>
          ) : planning ? (
            <StateCard kind="loading" detail={historyLength(about)} />
          ) : planNote !== null ? (
            <p className="answer">{planNote}</p>
          ) : journeys !== null ? (
            <>
              {/* The feed carries no active_period, so an alert's presence in
                  the latest snapshot is the only evidence it is live (D-29).
                  Past twelve hours we say we could not check — silence would
                  read as "nothing is wrong today". */}
              {!listOpen && alerts?.stale === true && <StateCard kind="stale" />}
              {/* Routable but not forecastable. Two different capabilities, and
                  conflating them would promise a figure we do not have. */}
              {!listOpen && chosenJourney !== null &&
                reliabilityFor(chosenJourney, view).coverage <= 0 && <StateCard kind="thin" />}
              {/* Says which measurement is on screen. The colour key that used
                  to sit beside it is gone: the ConfidenceBand in the verdict
                  now carries the same claim in the place the number is read
                  (D-45), and a legend for a scale nobody has looked at yet was
                  spending height the map needs (D-20). */}
              {!listOpen && chosenJourney !== null && (
                <ViewToggle journey={chosenJourney} view={view} onChange={setView} />
              )}
              {/* With a deadline the advice *is* the answer card; without one
                  the journey card is. Never both — they restate one trip. */}
              {/* Today comes before the answer: a figure that does not cover
                  the situation in front of the rider has to be qualified before
                  it is read, not after (P-09). */}
              {/* Kept as prose: "nothing changed" is not a condition on the
                  trip, it is reassurance that the switch did something, and a
                  tag saying it would be a tag about the absence of a tag. */}
              {!listOpen && stepFreeResult != null && stepFreeResult.changedNothing && (
                <p className="access-note">This way was already step-free.</p>
              )}
              {/* Their own destination cannot be routed around. Saying so is
                  the answer; hiding the trip would not be (P-07). */}
              {stepFreeResult != null && stepFreeResult.endsBlocked.length > 0 && (
                <div className="today today-severe">
                  <p className="today-head">Step-free</p>
                  <ul className="today-list">
                    {stepFreeResult.endsBlocked.map((e) => (
                      <li key={e.station}>
                        <strong>{titleCase(e.station)}</strong> is{" "}
                        {e.state === "outage" ? "not usable today" : "not step-free"}.
                      </li>
                    ))}
                  </ul>
                  <p className="today-note">
                    It is where this trip starts or ends, so no route avoids it. The rest of the
                    way is planned step-free.
                  </p>
                </div>
              )}
              {/* J-05, downtown only. The app has to be willing to say walk
                  (F-03), and D-40 scopes the comparison to where a second
                  option measurably exists. */}
              {!listOpen && walk !== null && chosenJourney !== null && (
                <WalkVsWait walk={walk} journey={chosenJourney} />
              )}
              {/* The first and last mile, which used to be invisible: the trip
                  began at a stop the rider was assumed to be standing at, so
                  every door-to-door figure was short by this much. */}
              {!listOpen && (doorWalk.access !== null || doorWalk.egress !== null) && (
                <DoorWalk access={doorWalk.access} egress={doorWalk.egress} />
              )}
              {/* The answer, as one block. Tags, verdict, coverage, the two
                  prices and the worst stretch — four blocks before the buttons
                  instead of seven stacked at one size (D-45, P-06). */}
              {!listOpen && chosenJourney !== null ? (
                <VerdictCard
                  journey={chosenJourney}
                  view={view}
                  alerts={alerts}
                  stepFree={stepFreeResult}
                  egressSeconds={doorWalk.egress?.seconds ?? 0}
                  focusedSegment={focusedSegment}
                  onFocusSegment={setFocusedSegment}
                  onSteps={() => setStepsOpen((v) => !v)}
                  onOthers={journeys.length > 1 ? () => setListOpen(true) : null}
                />
              ) : (
                <JourneyList
                  journeys={journeys}
                  selected={chosen}
                  view={view}
                  extraSeconds={(doorWalk.access?.seconds ?? 0) + (doorWalk.egress?.seconds ?? 0)}
                  collapsed={!listOpen}
                  onSelect={(id) => {
                    setChosen(id);
                    setListOpen(false);
                  }}
                />
              )}
              {/* Step by step, behind the button rather than always open. It
                  is the one block a rider reads *after* deciding, so it no
                  longer competes with the decision. */}
              {!listOpen && stepsOpen && chosenJourney !== null && (
                <JourneyDetail journey={chosenJourney} view={view} />
              )}
              {!listOpen && chosenJourney?.advice != null && (
                <p className="advice-basis">
                  An estimate from recorded disruptions — not a promise about today&rsquo;s
                  vehicle.
                  {view === "atTime" &&
                    chosenJourney?.atTime != null &&
                    chosenJourney.atTime.conditionedShare < 1 && (
                      <>
                        {" "}
                        {Math.round(chosenJourney.atTime.conditionedShare * 100)}% of this trip has
                        enough history for {bandLabel(chosenJourney)} on its own; the rest uses the
                        all-day figure.
                      </>
                    )}
                </p>
              )}
              <p className="quiet">
                {when.mode === "arriveBy" ? "Arriving by" : "Leaving at"} {hhmm(when.seconds)} on a
                weekday.
                {about?.delays.to != null && <> Delay records to {monthYear(about.delays.to)}.</>}
              </p>
            </>
          ) : null}
        </div>
      ) : feature !== null ? (
        <Sheet
          feature={feature}
          onClose={() => setFeature(null)}
          day={day}
          hour={hour}
          onHour={(h) => setHour(h === null ? "" : String(h))}
        />
      ) : (
        data !== null && (
          <div className="sheet legend-sheet">
            <RouteRanking
              modes={ranking?.modes ?? {}}
              selected={selectedRouteId}
              onSelect={(routeId) => {
                const match = routes.find((r) => r.routeId === routeId);
                if (match !== undefined) setSelected(`${match.routeId}|${match.direction}`);
              }}
            />
            <div className="coverage-line">
              <strong>{data.coverage.scored}</strong> of <strong>{data.coverage.segments}</strong>{" "}
              stretches have enough data
            </div>
                  <div className="legend">
              <span>
                <i className="k-scale" />
                less waiting → more
              </span>
              <span>
                <i className="k-unknown" />
                not enough data
              </span>
              {stepFree && (
                <span>
                  <i className="k-blocked" />
                  not step-free
                </span>
              )}
            </div>
            <div className="quiet">Minutes of waiting caused per month. Tap a line.</div>
            <DataNote about={about} />
          </div>
        )
      )}

      {/* Last in the page so keyboard focus reaches the trip form first: the
          map's zoom, locate and credit links used to take 11 Tab presses
          before "From". It still paints underneath (.map has z-index 0). */}
      <MapView
        data={mode === "explore" ? data : null}
        journey={mode === "plan" ? (chosenJourney?.geojson ?? null) : null}
        fitToken={`${mode}|${chosen ?? ""}|${listOpen ? "open" : "peek"}`}
        exposureProperty={exposureProperty(view)}
        onSelect={onSelect}
        selectedId={feature?.properties.segmentId ?? null}
      />
    </div>
  );
}
