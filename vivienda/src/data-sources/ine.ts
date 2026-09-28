/**
 * Adaptador INE — población por provincia (API JSON "Tempus3").
 *
 *   https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{tabla}?nult={n}
 *
 * Tabla por defecto: 2852 "Población por provincias y sexo" (Cifras oficiales de población
 * resultantes de la revisión del Padrón municipal a 1 de enero). Configurable con
 * INE_POPULATION_TABLE. Se usa solo como denominador para tasas por 100.000 habitantes.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { DataSourceAdapter, NormalizedResult } from "./types";
import { USER_AGENT } from "./types";
import { saveRaw } from "./snapshot";
import { matchTerritory } from "@/lib/territories";
import { deriveAggregates } from "./cube-mapping";
import type { Statistic } from "@/lib/schema";

export const INE_SOURCE_ID = "ine-padron";
const TABLE = process.env.INE_POPULATION_TABLE ?? "2852";
const API = `https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/${TABLE}?nult=25`;

interface IneSeries {
  COD: string;
  Nombre: string;
  Data: { Anyo?: number; Fecha?: number; Valor: number | null; Secreto?: boolean }[];
}

export function parseIneSeries(series: IneSeries[], meta: { snapshotId: string; retrievedAt: string }): { rows: Statistic[]; unmatched: string[] } {
  const rows: Statistic[] = [];
  const unmatched = new Set<string>();
  for (const s of series) {
    const parts = s.Nombre.split(/\.\s*/).map((x) => x.trim()).filter(Boolean);
    const [place, ...rest] = parts;
    // Solo la serie de ambos sexos
    if (!rest.some((p) => /^total$/i.test(p)) || rest.some((p) => /^(hombres|mujeres)$/i.test(p))) continue;
    const label = place.replace(/^\d{2}\s+/, "");
    let code: string | null;
    let level: Statistic["territory_type"] = "province";
    if (/total nacional|^españa$/i.test(label)) {
      code = "ES";
      level = "country";
    } else {
      code = matchTerritory(label, "province")?.id ?? null;
    }
    if (!code) {
      unmatched.add(label);
      continue;
    }
    for (const d of s.Data) {
      if (d.Valor == null || d.Secreto) continue;
      const year = d.Anyo ?? (d.Fecha ? new Date(d.Fecha).getUTCFullYear() : null);
      if (!year) continue;
      rows.push({
        id: `ine-poblacion:poblacion:total:${code}:${year}`,
        period: String(year),
        period_type: "year",
        territory_type: level,
        territory_code: code,
        metric: "poblacion",
        procedure_type: "total",
        value: d.Valor,
        derivation: "reported",
        source_id: INE_SOURCE_ID,
        dataset_id: "ine-poblacion",
        snapshot_id: meta.snapshotId,
        retrieved_at: meta.retrievedAt,
        demo: false,
      });
    }
  }
  return { rows, unmatched: [...unmatched] };
}

export const ineAdapter: DataSourceAdapter = {
  id: "ine",
  name: "Instituto Nacional de Estadística — Padrón municipal",

  async fetchSnapshot(ctx) {
    const res = await ctx.fetch(API, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`INE: HTTP ${res.status}`);
    const body = await res.text();
    const file = await saveRaw(ctx.dir, "poblacion.json", body, API, "application/json");
    return { source: "ine", snapshot_id: ctx.snapshotId, retrieved_at: ctx.now.toISOString(), files: [file], notes: [`tabla=${TABLE}`] };
  },

  async normalize(dir, manifest): Promise<NormalizedResult> {
    const raw = JSON.parse(await readFile(path.join(dir, "poblacion.json"), "utf8")) as IneSeries[];
    const { rows, unmatched } = parseIneSeries(raw, { snapshotId: manifest.snapshot_id, retrievedAt: manifest.retrieved_at });
    const { rows: all, warnings } = deriveAggregates(rows);
    const years = all.map((r) => r.period).sort();
    return {
      sources: [
        {
          id: INE_SOURCE_ID,
          name: "INE · Cifras oficiales de población (Padrón municipal)",
          url: `https://www.ine.es/jaxiT3/Tabla.htm?t=${TABLE}`,
          type: "dataset_oficial",
          retrieved_at: manifest.retrieved_at,
          published_at: null,
          notes: "Población a 1 de enero. Denominador para tasas por 100.000 habitantes.",
        },
      ],
      datasets: [
        {
          id: "ine-poblacion",
          source_id: INE_SOURCE_ID,
          title: "Población residente a 1 de enero",
          url: `https://www.ine.es/jaxiT3/Tabla.htm?t=${TABLE}`,
          methodology: "Cifras oficiales de población derivadas de la revisión anual del Padrón municipal.",
          limitations: ["La población de referencia es la del 1 de enero del mismo año del dato estadístico."],
          territorial_levels: [...new Set(all.map((r) => r.territory_type))],
          period_types: ["year"],
          first_period: years[0] ?? null,
          last_period: years[years.length - 1] ?? null,
          source_updated_at: null,
          retrieved_at: manifest.retrieved_at,
          demo: false,
        },
      ],
      statistics: all,
      warnings: [...warnings, ...(unmatched.length ? [`INE: territorios no emparejados: ${unmatched.join(", ")}`] : [])],
    };
  },
};
