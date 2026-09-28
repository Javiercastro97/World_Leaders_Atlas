/**
 * Genera la cartografía estática que consume el mapa:
 *
 *   public/geo/provinces.geojson   provincias (IGN vía es-atlas), id canónico PR-XX
 *   public/geo/ccaa.geojson        comunidades autónomas, id canónico CA-XX
 *   public/geo/context.geojson     países vecinos (Natural Earth vía world-atlas 50m)
 *   public/geo/municipios.json     índice compacto [ine, nombre, provincia, lon, lat]
 *
 * Fuente: Instituto Geográfico Nacional — Equipamiento Geográfico de Referencia Nacional,
 * empaquetado como TopoJSON por el proyecto es-atlas (licencia CC BY 4.0 del IGN).
 * Geometrías redondeadas a 3 decimales (~110 m); centroides municipales a 4 (~11 m).
 *
 * Uso: npm run geo:build
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { PROVINCES, CCAA } from "../src/lib/territories";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "geo");
mkdirSync(out, { recursive: true });

const readJson = <T>(p: string): T => JSON.parse(readFileSync(path.join(root, p), "utf8")) as T;

function round(g: Geometry): Geometry {
  // 3 decimales ≈ 110 m: invisible a escala provincial y reduce el peso a la mitad.
  const r = (c: Position): Position => [Math.round(c[0] * 1e3) / 1e3, Math.round(c[1] * 1e3) / 1e3];
  switch (g.type) {
    case "Polygon":
      return { type: "Polygon", coordinates: g.coordinates.map((ring) => ring.map(r)) };
    case "MultiPolygon":
      return { type: "MultiPolygon", coordinates: g.coordinates.map((p) => p.map((ring) => ring.map(r))) };
    default:
      return g;
  }
}

/** Centroide de área (planar, suficiente a escala municipal) del mayor polígono. */
function centroid(g: Geometry): [number, number] {
  const polys: Position[][][] = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  let best: { a: number; x: number; y: number } | null = null;
  for (const poly of polys) {
    const ring = poly[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f;
      cx += (ring[j][0] + ring[i][0]) * f;
      cy += (ring[j][1] + ring[i][1]) * f;
    }
    a /= 2;
    if (a === 0) continue;
    const c = { a: Math.abs(a), x: cx / (6 * a), y: cy / (6 * a) };
    if (!best || c.a > best.a) best = c;
  }
  if (!best) return [0, 0];
  return [Math.round(best.x * 1e4) / 1e4, Math.round(best.y * 1e4) / 1e4];
}

function write(name: string, data: unknown) {
  const file = path.join(out, name);
  const json = JSON.stringify(data);
  writeFileSync(file, json);
  console.log(`${name.padEnd(22)} ${(json.length / 1024).toFixed(0).padStart(5)} KB`);
}

// --- Provincias y CCAA -------------------------------------------------------
type Props = { name: string };
const provTopo = readJson<Topology<{ provinces: GeometryCollection<Props>; autonomous_regions: GeometryCollection<Props> }>>(
  "node_modules/es-atlas/es/provinces.json",
);

const provFc = feature(provTopo, provTopo.objects.provinces) as FeatureCollection<Geometry, Props>;
const provinces: Feature[] = [];
for (const f of provFc.features) {
  const t = PROVINCES.find((p) => p.ine === String(f.id));
  if (!t) continue; // excluye Gibraltar (54), fuera de la jurisdicción española
  provinces.push({
    type: "Feature",
    geometry: round(f.geometry),
    properties: { id: t.id, name: t.shortName, slug: t.slug, ccaa: t.parent, label: centroid(f.geometry) },
  });
}
write("provinces.geojson", { type: "FeatureCollection", features: provinces });

const ccaaFc = feature(provTopo, provTopo.objects.autonomous_regions) as FeatureCollection<Geometry, Props>;
const ccaa: Feature[] = [];
for (const f of ccaaFc.features) {
  const t = CCAA.find((c) => c.ine === String(f.id));
  if (!t) continue;
  ccaa.push({
    type: "Feature",
    geometry: round(f.geometry),
    properties: { id: t.id, name: t.shortName, slug: t.slug, label: centroid(f.geometry) },
  });
}
write("ccaa.geojson", { type: "FeatureCollection", features: ccaa });

// --- Municipios: solo índice de centroides (no geometrías) --------------------
const muniTopo = readJson<Topology<{ municipalities: GeometryCollection<Props> }>>("node_modules/es-atlas/es/municipalities.json");
const muniFc = feature(muniTopo, muniTopo.objects.municipalities) as FeatureCollection<Geometry, Props>;
const municipios: [string, string, string, number, number][] = [];
for (const f of muniFc.features) {
  const ine = String(f.id);
  const prov = ine.slice(0, 2);
  if (!PROVINCES.some((p) => p.ine === prov)) continue;
  const [lon, lat] = centroid(f.geometry);
  municipios.push([ine, f.properties.name, prov, lon, lat]);
}
municipios.sort((a, b) => a[0].localeCompare(b[0]));
write("municipios.json", municipios);

// --- Contexto: países vecinos (sin interacción) ------------------------------
const world = readJson<Topology<{ countries: GeometryCollection<Props> }>>("node_modules/world-atlas/countries-50m.json");
const NEIGHBOURS = new Set(["620", "250", "020", "504", "012", "380", "826"]); // PT, FR, AD, MA, DZ, IT, GB (Gibraltar)
const worldFc = feature(world, world.objects.countries) as FeatureCollection<Geometry, Props>;
const context = worldFc.features
  .filter((f) => NEIGHBOURS.has(String(f.id)))
  .map((f) => ({ type: "Feature", geometry: round(f.geometry), properties: { name: f.properties.name } }));
write("context.geojson", { type: "FeatureCollection", features: context });
