import path from "node:path";
import { readFileSync } from "node:fs";
import type { MunicipioRow } from "@/lib/geo";
import { normalizeName } from "@/lib/territories";

let rows: MunicipioRow[] | null = null;
let byCode: Map<string, MunicipioRow> | null = null;

export function municipios(): MunicipioRow[] {
  if (!rows) {
    rows = JSON.parse(readFileSync(path.join(process.cwd(), "public", "geo", "municipios.json"), "utf8")) as MunicipioRow[];
    byCode = new Map(rows.map((r) => [r[0], r]));
  }
  return rows;
}

export function municipioCentroid(code: string): { lat: number; lon: number } | null {
  municipios();
  const r = byCode!.get(code);
  return r ? { lat: r[4], lon: r[3] } : null;
}

/** Resuelve un nombre de municipio dentro de una provincia (para envíos y moderación). */
export function findMunicipio(name: string, provinceIne: string): MunicipioRow | null {
  const n = normalizeName(name);
  return (
    municipios().find((r) => r[2] === provinceIne && normalizeName(r[1]).split("/").some((x) => x.trim() === n)) ?? null
  );
}
