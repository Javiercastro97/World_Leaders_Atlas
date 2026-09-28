/**
 * Mapa SVG estático (para /memoria y la imagen OG): proyección equirectangular corregida
 * por cos(40°), suficiente a escala peninsular, con Canarias desplazada a un recuadro
 * (convención cartográfica habitual; el recuadro se dibuja explícitamente).
 * Se simplifica descartando vértices a menos de 0,6 px para aligerar el HTML.
 */
import path from "node:path";
import { readFileSync } from "node:fs";
import type { FeatureCollection, Geometry, Position } from "geojson";

export interface SvgMap {
  width: number;
  height: number;
  paths: { id: string; d: string }[];
  insetBox: { x: number; y: number; w: number; h: number };
}

const W = 800;
const LON0 = -9.4;
const LON1 = 4.4;
const LAT1 = 43.9; // borde norte
const LAT0 = 33.6; // borde sur (deja sitio al recuadro de Canarias)
const COS = Math.cos((40 * Math.PI) / 180);
const S = W / ((LON1 - LON0) * COS); // px por grado de latitud

function isCanary([lon, lat]: Position) {
  return lon < -12 && lat < 30;
}

function project([lon, lat]: Position): [number, number] {
  if (isCanary([lon, lat])) {
    // Canarias → recuadro bajo Andalucía occidental (sin solapar Huelva ni Ceuta)
    lon += 8.9;
    lat += 6.1;
  }
  return [(lon - LON0) * COS * S, (LAT1 - lat) * S];
}

function ringPath(ring: Position[], tol: number, dec: number): string {
  let out = "";
  let last: [number, number] | null = null;
  let n = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = project(ring[i]);
    if (last && i < ring.length - 1 && Math.hypot(p[0] - last[0], p[1] - last[1]) < tol) continue;
    out += `${out ? "L" : "M"}${p[0].toFixed(dec)},${p[1].toFixed(dec)}`;
    last = p;
    n++;
  }
  // Islotes que quedan en menos de 3 vértices a esta escala se omiten
  return n < 3 ? "" : out + "Z";
}

function geomPath(g: Geometry, tol: number, dec: number): string {
  if (g.type === "Polygon") return g.coordinates.map((r) => ringPath(r, tol, dec)).join("");
  if (g.type === "MultiPolygon") return g.coordinates.flatMap((p) => p.map((r) => ringPath(r, tol, dec))).join("");
  return "";
}

const cache = new Map<string, SvgMap>();

/** `detail: "light"` genera una versión muy simplificada (~25 KB) para vistas previas. */
export function svgMap(level: "province" | "ccaa", detail: "full" | "light" = "full"): SvgMap {
  const key = `${level}:${detail}`;
  const [tol, dec] = detail === "light" ? [2.5, 0] : [0.6, 1];
  const hit = cache.get(key);
  if (hit) return hit;
  const file = level === "province" ? "provinces.geojson" : "ccaa.geojson";
  const fc = JSON.parse(readFileSync(path.join(process.cwd(), "public", "geo", file), "utf8")) as FeatureCollection<Geometry, { id: string }>;
  const paths = fc.features.map((f) => ({ id: f.properties.id, d: geomPath(f.geometry, tol, dec) }));
  const [bx0, by0] = project([-18.3, 29.5]);
  const [bx1, by1] = project([-13.3, 27.6]);
  const m: SvgMap = {
    width: W,
    height: Math.round((LAT1 - LAT0) * S),
    paths,
    insetBox: { x: bx0 - 6, y: by0 - 6, w: bx1 - bx0 + 12, h: by1 - by0 + 12 },
  };
  cache.set(key, m);
  return m;
}

/** Proyección de un punto (para dibujar convocatorias sobre el mapa estático). */
export function projectPoint(lon: number, lat: number): [number, number] {
  return project([lon, lat]);
}
