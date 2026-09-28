"use client";
/* eslint-disable react-hooks/refs, react-hooks/immutability -- integración imperativa con MapLibre: el estado vive en el mapa y se sincroniza desde refs */
/**
 * Lienzo MapLibre. Se carga de forma diferida (next/dynamic, sin SSR).
 *
 * - Cartografía propia (IGN vía es-atlas) servida desde /geo: funciona sin servicios externos.
 * - Teselas vectoriales opcionales (OpenMapTiles/OpenFreeMap) para calles a partir de z8.
 * - Convocatorias y colectivos como marcadores DOM (<button>): accesibles con teclado y
 *   lectores de pantalla, y sin necesidad de fuentes de glifos externas.
 * - Estadística como choropleth por provincia/CCAA. Nunca como puntos.
 */
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MlMap, GeoJSONSource, LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Geometry } from "geojson";
import { CANARY_BOUNDS, SPAIN_BOUNDS } from "@/lib/geo";
import { EVENT_TYPE_LABEL } from "@/lib/vocab";
import { CLASS_COLORS, type Classified, type Layers, type MapOrg, type PublicEvent, type Selection, type StatsOptions } from "./types";

const VECTOR_TILES = process.env.NEXT_PUBLIC_VECTOR_TILES ?? "https://tiles.openfreemap.org/planet";

// El worker se sirve desde nuestro origen (scripts/copy-vendor.mjs).
maplibregl.setWorkerUrl(`/vendor/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);

export interface MapCanvasProps {
  events: PublicEvent[];
  orgs: MapOrg[];
  layers: Layers;
  level: StatsOptions["level"];
  classified: Classified;
  selection: Selection;
  view: "peninsula" | "canarias";
  onSelect: (s: Selection) => void;
  onHoverTerritory: (h: { id: string; x: number; y: number } | null) => void;
  flyTo: { lat: number; lon: number; zoom?: number; key: number } | null;
}

type GeoFC = FeatureCollection<Geometry, Record<string, unknown>>;

function hatchImage(): { width: number; height: number; data: Uint8Array } {
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const on = (x + y) % size < 1.5;
      const i = (y * size + x) * 4;
      data.set(on ? [150, 142, 130, 255] : [244, 241, 234, 255], i);
    }
  return { width: size, height: size, data };
}

export default function MapCanvas(p: MapCanvasProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const base = useRef<{ provinces: GeoFC; ccaa: GeoFC } | null>(null);
  const markers = useRef(new Map<string, maplibregl.Marker>());
  const orgMarkers = useRef(new Map<string, maplibregl.Marker>());
  const hovered = useRef<{ source: string; id: string } | null>(null);
  const props = useRef(p);
  props.current = p;

  // --- Inicialización -------------------------------------------------------------
  useEffect(() => {
    if (!el.current) return;
    const map = new maplibregl.Map({
      container: el.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "sea", type: "background", paint: { "background-color": "#dfe0db" } }],
      },
      bounds: SPAIN_BOUNDS as LngLatBoundsLike,
      fitBoundsOptions: { padding: 24 },
      minZoom: 3.5,
      maxZoom: 17,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      cooperativeGestures: false,
    });
    map.touchZoomRotate.disableRotation();
    // Si las teselas externas fallan, el mapa sigue funcionando con la cartografía propia.
    let warned = false;
    map.on("error", (e) => {
      const sourceId = (e as unknown as { sourceId?: string }).sourceId;
      if (sourceId === "omt" || String(e.error?.message ?? "").includes(VECTOR_TILES || "__")) {
        if (!warned) console.warn("Teselas vectoriales no disponibles; se usa solo la cartografía propia.");
        warned = true;
        return;
      }
      console.error(e.error);
    });
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __map?: MlMap }).__map = map;

    map.on("load", async () => {
      const [provinces, ccaa, context] = await Promise.all(
        ["provinces", "ccaa", "context"].map((n) => fetch(`/geo/${n}.geojson`).then((r) => r.json() as Promise<GeoFC>)),
      );
      base.current = { provinces, ccaa };
      map.addImage("hatch", hatchImage());

      map.addSource("context", { type: "geojson", data: context, attribution: "Natural Earth" });
      map.addLayer({ id: "context-fill", type: "fill", source: "context", paint: { "fill-color": "#ebe7de" } });
      map.addLayer({ id: "context-line", type: "line", source: "context", paint: { "line-color": "#cbc3b4", "line-width": 0.6 } });

      map.addSource("provinces", { type: "geojson", data: provinces, promoteId: "id", attribution: "© IGN (CC BY 4.0) · es-atlas" });
      map.addSource("ccaa", { type: "geojson", data: ccaa, promoteId: "id" });
      map.addLayer({ id: "land", type: "fill", source: "ccaa", paint: { "fill-color": "#f7f5ef" } });

      if (VECTOR_TILES) {
        try {
          map.addSource("omt", { type: "vector", url: VECTOR_TILES, attribution: "© OpenStreetMap · OpenMapTiles · OpenFreeMap" });
          map.addLayer({ id: "omt-water", type: "fill", source: "omt", "source-layer": "water", minzoom: 8, paint: { "fill-color": "#dfe0db" } });
          map.addLayer({
            id: "omt-roads",
            type: "line",
            source: "omt",
            "source-layer": "transportation",
            minzoom: 9,
            filter: ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "street"], true, false],
            paint: {
              "line-color": "#cfc8bb",
              "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.4, 14, 2.5, 17, 7],
            },
          });
          map.addLayer({ id: "omt-buildings", type: "fill", source: "omt", "source-layer": "building", minzoom: 14, paint: { "fill-color": "#ebe6db" } });
        } catch {
          /* sin teselas: la cartografía propia basta */
        }
      }

      const fillOpacity = ["interpolate", ["linear"], ["zoom"], 6, 0.92, 10, 0.35, 13, 0.12] as unknown as number;
      for (const src of ["provinces", "ccaa"] as const) {
        map.addLayer({
          id: `${src}-choro`,
          type: "fill",
          source: src,
          layout: { visibility: "none" },
          filter: [">=", ["get", "cls"], 0],
          paint: {
            "fill-color": ["match", ["get", "cls"], 0, CLASS_COLORS[0], 1, CLASS_COLORS[1], 2, CLASS_COLORS[2], 3, CLASS_COLORS[3], 4, CLASS_COLORS[4], "#f7f5ef"],
            "fill-opacity": fillOpacity,
          },
        });
        map.addLayer({
          id: `${src}-nodata`,
          type: "fill",
          source: src,
          layout: { visibility: "none" },
          filter: ["==", ["get", "cls"], -1],
          paint: { "fill-pattern": "hatch", "fill-opacity": fillOpacity },
        });
      }
      map.addLayer({
        id: "provinces-line",
        type: "line",
        source: "provinces",
        paint: { "line-color": "#a8a092", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.3, 8, 0.8] },
      });
      map.addLayer({ id: "ccaa-line", type: "line", source: "ccaa", paint: { "line-color": "#6f685e", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 8, 1.6] } });
      for (const src of ["provinces", "ccaa"] as const) {
        map.addLayer({
          id: `${src}-hl`,
          type: "line",
          source: src,
          paint: {
            "line-color": "#141414",
            "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, ["boolean", ["feature-state", "hover"], false], 2, 0],
          },
        });
      }

      map.addSource("events", { type: "geojson", data: eventsFC(props.current.events), cluster: true, clusterRadius: 38, clusterMaxZoom: 12 });
      // Capa invisible necesaria para que la fuente se procese y podamos leer sus features.
      map.addLayer({ id: "events-probe", type: "circle", source: "events", paint: { "circle-radius": 0, "circle-opacity": 0 } });

      ready.current = true;
      applyAll();
      map.on("moveend", syncEventMarkers);
      map.on("sourcedata", (e) => {
        if (e.sourceId === "events" && e.isSourceLoaded) syncEventMarkers();
      });
    });

    const territoryLayers = () => (props.current.level === "province" ? ["provinces-choro", "provinces-nodata"] : ["ccaa-choro", "ccaa-nodata"]);
    const setHover = (next: { source: string; id: string } | null) => {
      if (hovered.current) map.setFeatureState(hovered.current, { hover: false });
      hovered.current = next;
      if (next) map.setFeatureState(next, { hover: true });
    };
    map.on("mousemove", (e) => {
      if (!ready.current || !props.current.layers.stats) return;
      const f = map.queryRenderedFeatures(e.point, { layers: territoryLayers() })[0];
      const id = f?.properties?.id as string | undefined;
      if (id) {
        setHover({ source: props.current.level === "province" ? "provinces" : "ccaa", id });
        map.getCanvas().style.cursor = "pointer";
        props.current.onHoverTerritory({ id, x: e.point.x, y: e.point.y });
      } else {
        setHover(null);
        map.getCanvas().style.cursor = "";
        props.current.onHoverTerritory(null);
      }
    });
    map.on("mouseout", () => {
      setHover(null);
      props.current.onHoverTerritory(null);
    });
    map.on("click", (e) => {
      if (!ready.current || !props.current.layers.stats) return;
      const f = map.queryRenderedFeatures(e.point, { layers: territoryLayers() })[0];
      const id = f?.properties?.id as string | undefined;
      if (id) props.current.onSelect({ kind: "territory", id });
    });

    let refit = true;
    const eventMarkers = markers.current;
    const orgs = orgMarkers.current;
    const ro = new ResizeObserver(() => {
      map.resize();
      // El primer tamaño real llega tras el montaje: reencuadrar España una vez.
      if (refit) {
        refit = false;
        map.fitBounds(SPAIN_BOUNDS as LngLatBoundsLike, { padding: 24, duration: 0 });
      }
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      ready.current = false;
      eventMarkers.clear();
      orgs.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Sincronización con props -----------------------------------------------------
  function applyAll() {
    applyChoropleth();
    applyEvents();
    applyOrgs();
    applySelection();
  }

  function applyChoropleth() {
    const map = mapRef.current;
    if (!map || !ready.current || !base.current) return;
    const { classified, level, layers } = props.current;
    for (const src of ["provinces", "ccaa"] as const) {
      const fc = base.current[src];
      const data: GeoFC = {
        type: "FeatureCollection",
        features: fc.features.map((f) => {
          const c = classified.byId.get(f.properties.id as string);
          return { ...f, properties: { ...f.properties, cls: c ? c.cls : -1 } };
        }),
      };
      (map.getSource(src) as GeoJSONSource).setData(data);
      const vis = layers.stats && level === src.replace("provinces", "province") ? "visible" : "none";
      map.setLayoutProperty(`${src}-choro`, "visibility", vis);
      map.setLayoutProperty(`${src}-nodata`, "visibility", vis);
    }
    map.setLayoutProperty("provinces-line", "visibility", layers.stats && level === "ccaa" ? "none" : "visible");
  }

  function applyEvents() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource("events") as GeoJSONSource).setData(eventsFC(props.current.layers.events ? props.current.events : []));
    syncEventMarkers();
  }

  function syncEventMarkers() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const { layers, selection } = props.current;
    const next = new Map<string, maplibregl.Marker>();
    if (layers.events) {
      const feats = map.querySourceFeatures("events");
      const seen = new Set<string>();
      for (const f of feats) {
        const pr = f.properties as Record<string, unknown>;
        const isCluster = Boolean(pr.cluster);
        const key = isCluster ? `c${pr.cluster_id}` : `e${pr.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        let m = markers.current.get(key);
        if (!m) {
          const btn = document.createElement("button");
          btn.type = "button";
          if (isCluster) {
            const n = Number(pr.point_count);
            btn.className = "mk mk-cluster";
            btn.innerHTML = `<span>${n}</span>`;
            btn.setAttribute("aria-label", `${n} convocatorias agrupadas. Acercar.`);
            btn.addEventListener("click", async (ev) => {
              ev.stopPropagation();
              const src = map.getSource("events") as GeoJSONSource;
              const z = await src.getClusterExpansionZoom(Number(pr.cluster_id));
              map.easeTo({ center: coords, zoom: Math.min(z + 0.5, 15) });
            });
          } else {
            btn.className = `mk mk-evt${pr.pending ? " is-pending" : ""}${pr.past ? " is-past" : ""}`;
            btn.innerHTML = "<span></span>";
            btn.setAttribute("aria-label", String(pr.label));
            btn.title = String(pr.label);
            btn.dataset.id = String(pr.id);
            btn.addEventListener("click", (ev) => {
              ev.stopPropagation();
              props.current.onSelect({ kind: "event", id: String(pr.id) });
            });
          }
          m = new maplibregl.Marker({ element: btn }).setLngLat(coords).addTo(map);
        }
        if (!isCluster) m.getElement().classList.toggle("is-selected", selection?.kind === "event" && selection.id === String(pr.id));
        next.set(key, m);
      }
    }
    for (const [k, m] of markers.current) if (!next.has(k)) m.remove();
    markers.current = next;
  }

  function applyOrgs() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const { layers, orgs, selection } = props.current;
    const want = layers.orgs ? orgs : [];
    const ids = new Set(want.map((o) => o.id));
    for (const [k, m] of orgMarkers.current) {
      if (ids.has(k)) continue;
      m.remove();
      orgMarkers.current.delete(k);
    }
    for (const o of want) {
      let m = orgMarkers.current.get(o.id);
      if (!m) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mk mk-org";
        btn.innerHTML = "<span></span>";
        btn.setAttribute("aria-label", `Colectivo: ${o.name}`);
        btn.title = o.name;
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          props.current.onSelect({ kind: "org", id: o.id });
        });
        m = new maplibregl.Marker({ element: btn }).setLngLat([o.longitude, o.latitude]).addTo(map);
        orgMarkers.current.set(o.id, m);
      }
      m.getElement().classList.toggle("is-selected", selection?.kind === "org" && selection.id === o.id);
    }
  }

  const selectedTerritory = useRef<{ source: string; id: string } | null>(null);
  function applySelection() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const { selection, level } = props.current;
    if (selectedTerritory.current) map.setFeatureState(selectedTerritory.current, { selected: false });
    selectedTerritory.current = null;
    if (selection?.kind === "territory") {
      const src = selection.id.startsWith("PR-") ? "provinces" : level === "ccaa" ? "ccaa" : "provinces";
      selectedTerritory.current = { source: src, id: selection.id };
      map.setFeatureState(selectedTerritory.current, { selected: true });
    }
    for (const [k, m] of markers.current) {
      if (k.startsWith("e")) m.getElement().classList.toggle("is-selected", selection?.kind === "event" && `e${selection.id}` === k);
    }
    for (const [k, m] of orgMarkers.current) m.getElement().classList.toggle("is-selected", selection?.kind === "org" && selection.id === k);
  }

  useEffect(applyChoropleth, [p.classified, p.level, p.layers.stats]);
  useEffect(applyEvents, [p.events, p.layers.events]);
  useEffect(applyOrgs, [p.orgs, p.layers.orgs]);
  useEffect(applySelection, [p.selection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds((p.view === "canarias" ? CANARY_BOUNDS : SPAIN_BOUNDS) as LngLatBoundsLike, { padding: 24, duration: 700 });
  }, [p.view]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !p.flyTo) return;
    map.easeTo({ center: [p.flyTo.lon, p.flyTo.lat], zoom: Math.max(map.getZoom(), p.flyTo.zoom ?? 11), duration: 700 });
  }, [p.flyTo]);

  return (
    <div className="absolute inset-0">
      <div
        ref={el}
        className="w-full h-full"
        role="region"
        aria-label="Mapa interactivo de España. Todo su contenido está también disponible en el listado."
      />
    </div>
  );
}

function eventsFC(events: PublicEvent[]): GeoFC {
  return {
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.location.longitude, e.location.latitude] },
      properties: {
        id: e.id,
        pending: e.verification_status === "pendiente",
        past: e.effective_status !== "programada",
        label: `${EVENT_TYPE_LABEL[e.type]}: ${e.title}. ${e.date}${e.time ? ` ${e.time}` : ""}. Convoca ${e.organizer_name}.`,
      },
    })),
  };
}
