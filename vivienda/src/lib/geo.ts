/** Utilidades geográficas puras (sin dependencias). */

export const SPAIN_BOUNDS: [[number, number], [number, number]] = [
  [-9.6, 35.8],
  [4.5, 43.9],
];
export const CANARY_BOUNDS: [[number, number], [number, number]] = [
  [-18.3, 27.5],
  [-13.3, 29.5],
];

export const RADII_KM = [5, 10, 25, 50, 100] as const;
export type RadiusKm = (typeof RADII_KM)[number];

/** Distancia de círculo máximo en km (haversine). */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Reduce la precisión de una posición de usuario ANTES de usarla (≈1 km).
 * La posición exacta del usuario nunca sale del navegador ni se guarda.
 */
export function coarsen(lat: number, lon: number, decimals = 2): { lat: number; lon: number } {
  const f = 10 ** decimals;
  return { lat: Math.round(lat * f) / f, lon: Math.round(lon * f) / f };
}

export interface MunicipioEntry {
  ine: string;
  name: string;
  province: string; // INE de provincia
  lon: number;
  lat: number;
}

export type MunicipioRow = [string, string, string, number, number];

export function toMunicipio(r: MunicipioRow): MunicipioEntry {
  return { ine: r[0], name: r[1], province: r[2], lon: r[3], lat: r[4] };
}

function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Busca municipios por nombre (insensible a acentos; admite nombres bilingües "A/B").
 * Prioriza coincidencia exacta > prefijo > contiene.
 */
export function searchMunicipios(rows: MunicipioRow[], q: string, limit = 8): MunicipioEntry[] {
  const needle = fold(q);
  if (needle.length < 2) return [];
  const scored: { r: MunicipioRow; s: number }[] = [];
  for (const r of rows) {
    const names = fold(r[1]).split("/").map((x) => x.trim());
    let s = 0;
    for (const n of names) {
      if (n === needle) s = Math.max(s, 3);
      else if (n.startsWith(needle)) s = Math.max(s, 2);
      else if (n.includes(needle)) s = Math.max(s, 1);
    }
    if (s) scored.push({ r, s });
  }
  scored.sort((a, b) => b.s - a.s || a.r[1].length - b.r[1].length);
  return scored.slice(0, limit).map((x) => toMunicipio(x.r));
}

/** Respeta la denominación oficial bilingüe ("Alacant/Alicante") con espaciado legible. */
export function displayMunicipioName(name: string): string {
  return name.split("/").map((s) => s.trim()).join(" / ");
}
