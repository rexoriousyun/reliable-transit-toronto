import { useEffect, useRef } from "react";
import { Map as MlMap, NavigationControl, GeolocateControl, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { lineColorExpression, lineWidthExpression, tokensFor, UNKNOWN_OPACITY } from "./map.js";
import { isDark } from "./theme.js";
import type { RouteMap, SegmentFeature } from "./api.js";

// MapLibre 6 loads its worker from a file beside its own module, and a
// production build does not emit that file: the worker 404s and the map stays
// blank with nothing thrown. Bundling the worker ourselves gives it a real URL.
setWorkerUrl(workerUrl);

/**
 * Served by our own tile proxy — the client never contacts the basemap host —
 * and themed there too, so the ground matches the sheet (`D-42`).
 */
const styleUrl = (): string => `/tiles/style?theme=${isDark() ? "dark" : "light"}`;
const SRC = "segments";

const JOURNEY_SRC = "journey";

/** Matches the sheet's CSS transition; see .sheet in styles.css. */
const SHEET_TRANSITION_MS = 240;

/**
 * How much of the map is covered by chrome, in pixels, measured from the live
 * layout. The topbar and the sheet float over the canvas, so fitting to the
 * raw viewport puts the route behind them.
 */
function chromePadding(m: MlMap): { top: number; bottom: number; left: number; right: number } {
  const box = m.getContainer().getBoundingClientRect();
  const rect = (sel: string): DOMRect | null => document.querySelector(sel)?.getBoundingClientRect() ?? null;
  const topbar = rect(".topbar");
  const sheet = rect(".sheet");
  const gap = 16;
  const top = Math.min(box.height * 0.4, (topbar ? topbar.bottom - box.top : 0) + gap);
  const bottom = Math.min(box.height * 0.5, (sheet ? box.bottom - sheet.top : 0) + gap);
  return { top: Math.max(24, top), bottom: Math.max(24, bottom), left: 28, right: 28 };
}

interface Props {
  data: RouteMap | null;
  /** A planned trip's geometry, drawn instead of a route when present. */
  journey: { type: "FeatureCollection"; features: unknown[] } | null;
  /** Changes whenever the chrome over the map moves, so the fit is redone. */
  fitToken: string;
  /**
   * Which exposure figure colours the trip. The map and the text have to agree:
   * a route coloured on the all-day basis beside a rate written for the morning
   * peak is worse than either measurement alone.
   */
  exposureProperty: string;
  onSelect: (f: SegmentFeature | null) => void;
  selectedId: string | null;
}

export function MapView({ data, journey, fitToken, exposureProperty, onSelect, selectedId }: Props): JSX.Element {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    if (container.current === null || map.current !== null) return;
    const m = new MlMap({
      container: container.current,
      style: styleUrl(),
      center: [-79.3832, 43.6532],
      zoom: 11,
      // The open data licence asks for this line wherever its data is shown;
      // the map is where most of it is.
      attributionControl: {
        compact: true,
        customAttribution:
          'Contains information licensed under the <a href="https://open.toronto.ca/open-data-license/" target="_blank" rel="noreferrer">Open Government Licence – Toronto</a>',
      },
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new GeolocateControl({ trackUserLocation: true }), "top-right");

    const tok = tokensFor(isDark());

    m.on("load", () => {
      m.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // A wide transparent line under the visible one: a 4px stroke is not a
      // tappable target on a phone.
      m.addLayer({
        id: "segments-hit",
        type: "line",
        source: SRC,
        paint: { "line-width": 22, "line-opacity": 0 },
      });

      // Selection is a halo drawn BENEATH the data, never over it. An overlay at
      // any opacity tints the line it highlights, turning an encoded orange into
      // a muddy maroon — the highlight would corrupt the thing it points at.
      m.addLayer({
        id: "segments-selected",
        type: "line",
        source: SRC,
        filter: ["==", ["get", "segmentId"], "__none__"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": tok.selection,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 9, 14, 16, 17, 22],
          "line-opacity": 0.3,
          "line-blur": 1,
        },
      });

      // Blocked segments, when step-free routing is on.
      //
      // Drawn as a struck-out line rather than recoloured: accessibility is a
      // filter, not a worse score (P-05). A blocked stretch is not "more
      // unreliable" — it is unavailable, and colouring it on the reliability
      // scale would say the wrong thing entirely.
      m.addLayer({
        id: "segments-blocked",
        type: "line",
        source: SRC,
        filter: ["!=", ["get", "blockedBy"], null],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": tok.blocked,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 3.5, 14, 6.5, 17, 11],
          "line-dasharray": [0.6, 0.9],
          "line-opacity": 0.85,
        },
      });

      // Known segments: the route in green, or the reserved ramp when unreliable.
      m.addLayer({
        id: "segments-known",
        type: "line",
        source: SRC,
        filter: ["!=", ["get", "confidence"], "unknown"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": lineColorExpression(tok) as never,
          "line-width": lineWidthExpression() as never,
        },
      });

      // Unknown segments are dashed — a different visual kind, not a paler shade
      // of fine. Pattern is the second channel, so this survives greyscale and
      // colour-vision deficiency (P-03).
      m.addLayer({
        id: "segments-unknown",
        type: "line",
        source: SRC,
        filter: ["==", ["get", "confidence"], "unknown"],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": tok.unknown,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 12, 2.8, 14, 3.8, 17, 6],
          "line-dasharray": [1.4, 2.2],
          "line-opacity": UNKNOWN_OPACITY,
        },
      });

      // A planned trip. Ride legs use the same scale as the explore map, so the
      // encoding a rider learns in one view still means the same thing here.
      m.addSource(JOURNEY_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "journey-casing",
        type: "line",
        source: JOURNEY_SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": tok.casing,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 6, 14, 10, 17, 15],
        },
      });
      m.addLayer({
        id: "journey-ride",
        type: "line",
        source: JOURNEY_SRC,
        filter: ["all", ["==", ["get", "kind"], "ride"], ["!=", ["get", "confidence"], "unknown"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": lineColorExpression(tok, exposureProperty) as never,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 3.5, 14, 6.5, 17, 11],
        },
      });
      // A stretch of the trip we cannot speak for, drawn as the same distinct
      // kind the explore map uses — dashed and thinned, never a paler shade of
      // fine (P-03). The encoding a rider learns in one view holds in the other.
      m.addLayer({
        id: "journey-unknown",
        type: "line",
        source: JOURNEY_SRC,
        filter: ["all", ["==", ["get", "kind"], "ride"], ["==", ["get", "confidence"], "unknown"]],
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": tok.unknown,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 3.5, 14, 6.5, 17, 11],
          "line-dasharray": [1.4, 1.6],
          "line-opacity": UNKNOWN_OPACITY,
        },
      });
      m.addLayer({
        id: "journey-walk",
        type: "line",
        source: JOURNEY_SRC,
        filter: ["==", ["get", "kind"], "walk"],
        layout: { "line-cap": "butt" },
        // Walking has no reliability to report, so it takes no colour from the
        // scale: a green dash would claim "reliable" about a stretch the model
        // says nothing about. Ink and a dash instead.
        paint: {
          "line-color": tok.walk,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 3, 14, 5, 17, 8],
          "line-dasharray": [1, 1.6],
          "line-opacity": 0.75,
        },
      });

      m.on("click", "segments-hit", (e: MapMouseEvent & { features?: unknown[] }) => {
        const f = e.features?.[0] as { properties: unknown } | undefined;
        onSelect(f === undefined ? null : ({ ...f, properties: f.properties } as unknown as SegmentFeature));
      });
      m.on("click", (e: MapMouseEvent) => {
        const hits = m.queryRenderedFeatures(e.point, { layers: ["segments-hit"] });
        if (hits.length === 0) onSelect(null);
      });
      m.on("mouseenter", "segments-hit", () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", "segments-hit", () => { m.getCanvas().style.cursor = ""; });

      ready.current = true;
      // Exposed in development only, so tests and debugging can frame a specific
      // place. Zoomed-out views flatter this design; downtown at street zoom is
      // where the encoding has to hold up.
      if (import.meta.env.DEV) {
        (window as unknown as { __map?: MlMap }).__map = m;
      }
    });
    map.current = m;
  }, [onSelect]);

  useEffect(() => {
    const m = map.current;
    if (m === null || data === null) return;
    const apply = (): void => {
      const src = m.getSource(SRC) as GeoJSONSource | undefined;
      if (src === undefined) return;
      src.setData(data as never);
      if (data.bbox !== null) {
        m.fitBounds(
          [
            [data.bbox[0], data.bbox[1]],
            [data.bbox[2], data.bbox[3]],
          ],
          { padding: chromePadding(m), maxZoom: 14, duration: 600 },
        );
      }
    };
    if (ready.current) apply();
    else m.once("load", apply);
  }, [data]);

  useEffect(() => {
    const m = map.current;
    if (m === null) return;
    const apply = (): void => {
      const src = m.getSource(JOURNEY_SRC) as GeoJSONSource | undefined;
      if (src === undefined) return;
      src.setData((journey ?? { type: "FeatureCollection", features: [] }) as never);

      // Route layers are hidden while a trip is shown: two overlapping encodings
      // on the same streets would be unreadable.
      const showRoute = journey === null ? "visible" : "none";
      for (const id of ["segments-known", "segments-unknown", "segments-blocked", "segments-selected"]) {
        if (m.getLayer(id) !== undefined) m.setLayoutProperty(id, "visibility", showRoute);
      }

      if (journey !== null && journey.features.length > 0) {
        const coords = journey.features.flatMap(
          (f) => (f as { geometry: { coordinates: Array<[number, number]> } }).geometry.coordinates,
        );
        const lons = coords.map((c) => c[0]), lats = coords.map((c) => c[1]);
        const bounds: [[number, number], [number, number]] = [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ];
        // Measured, not guessed: the search fields and the results sheet both
        // change height, and a hardcoded inset drew the route underneath them.
        const fit = (): void => {
          m.fitBounds(bounds, { padding: chromePadding(m), maxZoom: 15, duration: 600 });
        };
        fit();
        // Re-fit once the sheet has finished sliding, so the final framing
        // matches where the sheet actually came to rest.
        window.setTimeout(fit, SHEET_TRANSITION_MS + 40);
      }
    };
    if (ready.current) apply();
    else m.once("load", apply);
  }, [journey, fitToken]);

  useEffect(() => {
    const m = map.current;
    if (m === null || !ready.current) return;
    if (m.getLayer("journey-ride") !== undefined) {
      m.setPaintProperty(
        "journey-ride",
        "line-color",
        lineColorExpression(
          tokensFor(isDark()),
          exposureProperty,
        ) as never,
      );
    }
  }, [exposureProperty]);

  useEffect(() => {
    const m = map.current;
    if (m === null || !ready.current) return;
    if (m.getLayer("segments-selected") !== undefined) {
      m.setFilter("segments-selected", ["==", ["get", "segmentId"], selectedId ?? "__none__"]);
    }
  }, [selectedId]);

  return <div ref={container} className="map" />;
}
