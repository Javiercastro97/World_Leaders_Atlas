/**
 * Servicio de estadísticas: selección de la serie principal, choropleths, series temporales
 * y tasas por población. Nunca mezcla datasets en una misma cifra.
 */
import path from "node:path";
import { readFileSync } from "node:fs";
import type { Dataset, Metric, ProcedureType, Statistic } from "@/lib/schema";
import { previousYearPeriod, comparePeriods } from "@/lib/dates";
import { CCAA, PROVINCES } from "@/lib/territories";
import { getRepo } from "./repo";
import { demoEnabled } from "./demo";
import { DATA_DIR } from "@/data-sources/snapshot";

type SeriesConfig = Partial<Record<Metric, string[]>>;

function seriesConfig(): SeriesConfig {
  try {
    return JSON.parse(readFileSync(path.join(DATA_DIR, "config", "series.json"), "utf8")) as SeriesConfig;
  } catch {
    return {};
  }
}

const DEMO_FALLBACK: Partial<Record<Metric, string>> = {
  lanzamientos_practicados: "demo-lanzamientos",
  poblacion: "demo-poblacion",
};

export interface SeriesSelection {
  dataset: Dataset;
  rows: Statistic[];
}

/** Dataset principal de una métrica: el primero configurado que tenga filas. */
export async function primarySeries(metric: Metric): Promise<SeriesSelection | null> {
  const repo = await getRepo();
  const datasets = await repo.listDatasets();
  const candidates = [...(seriesConfig()[metric] ?? [])];
  if (demoEnabled() && DEMO_FALLBACK[metric]) candidates.push(DEMO_FALLBACK[metric]!);
  for (const id of candidates) {
    const rows = await repo.listStatistics({ metric, datasetIds: [id] });
    const dataset = datasets.find((d) => d.id === id);
    if (rows.length && dataset) return { dataset, rows };
  }
  return null;
}

export function periodsOf(rows: Statistic[], type: Statistic["period_type"]): string[] {
  return [...new Set(rows.filter((r) => r.period_type === type).map((r) => r.period))].sort(comparePeriods);
}

/** Último periodo COMPLETO a nivel nacional (evita mostrar años con trimestres pendientes como si fueran anuales). */
export function latestPeriod(rows: Statistic[], type: Statistic["period_type"]): string | null {
  const ps = periodsOf(rows.filter((r) => r.territory_type === "country" && r.procedure_type === "total"), type);
  return ps[ps.length - 1] ?? periodsOf(rows, type).pop() ?? null;
}

export function valueAt(rows: Statistic[], q: { territory: string; period: string; procedure?: ProcedureType; level?: Statistic["territory_type"] }): Statistic | null {
  return (
    rows.find(
      (r) =>
        r.territory_code === q.territory &&
        r.period === q.period &&
        r.procedure_type === (q.procedure ?? "total") &&
        (!q.level || r.territory_type === q.level),
    ) ?? null
  );
}

export interface ChoroplethDatum {
  id: string; // PR-XX | CA-XX
  value: number | null;
  rate: number | null; // por 100.000 hab.
  derivation: Statistic["derivation"] | null;
  note: string | null;
}

export interface Choropleth {
  metric: Metric;
  level: "province" | "ccaa";
  period: string;
  procedure: ProcedureType;
  dataset: Dataset;
  data: ChoroplethDatum[];
  populationYear: string | null;
  notes: string[];
}

export async function choropleth(opts: {
  metric?: Metric;
  level: "province" | "ccaa";
  period?: string;
  periodType?: Statistic["period_type"];
  procedure?: ProcedureType;
}): Promise<Choropleth | null> {
  const metric = opts.metric ?? "lanzamientos_practicados";
  const sel = await primarySeries(metric);
  if (!sel) return null;
  const periodType = opts.periodType ?? "year";
  const period = opts.period ?? latestPeriod(sel.rows, periodType);
  if (!period) return null;
  const procedure = opts.procedure ?? "total";
  const pop = await primarySeries("poblacion");
  const popYear = period.slice(0, 4);
  const notes: string[] = [];

  let rows = sel.rows.filter((r) => r.period === period && r.procedure_type === procedure && r.territory_type === opts.level);
  if (opts.level === "ccaa" && rows.length === 0) {
    // Solo hay datos por TSJ: se muestran sobre la CCAA sede, avisando de Ceuta y Melilla.
    rows = sel.rows.filter((r) => r.period === period && r.procedure_type === procedure && r.territory_type === "tsj");
    if (rows.length) notes.push("Datos por Tribunal Superior de Justicia: el TSJ de Andalucía incluye Ceuta y Melilla.");
  }

  const ids = (opts.level === "province" ? PROVINCES : CCAA).map((t) => t.id);
  const byId = new Map(rows.map((r) => [r.territory_code, r]));
  const data: ChoroplethDatum[] = ids.map((id) => {
    const r = byId.get(id) ?? null;
    let rate: number | null = null;
    if (r && pop) {
      const p = pop.rows.find((x) => x.period === popYear && x.territory_code === id && x.territory_type === (r.territory_type === "tsj" ? "ccaa" : r.territory_type));
      if (p && p.value > 0 && r.territory_type !== "tsj") rate = (r.value / p.value) * 100_000;
    }
    const tsjNote = r?.territory_type === "tsj" && id === "CA-01" ? "Incluye Ceuta y Melilla (TSJ)." : null;
    const cmNote = !r && (id === "CA-18" || id === "CA-19") && rows.some((x) => x.territory_type === "tsj") ? "Incluido en el TSJ de Andalucía." : null;
    return { id, value: r?.value ?? null, rate, derivation: r?.derivation ?? null, note: tsjNote ?? cmNote };
  });
  if (pop && !pop.rows.some((x) => x.period === popYear)) notes.push(`Sin población de ${popYear}: no se calculan tasas.`);

  return { metric, level: opts.level, period, procedure, dataset: sel.dataset, data, populationYear: pop ? popYear : null, notes };
}

export interface TimePoint {
  period: string;
  value: number;
  yoy: number | null; // variación interanual en %
  derivation: Statistic["derivation"];
}

export function timeSeries(rows: Statistic[], q: { territory: string; periodType: Statistic["period_type"]; procedure?: ProcedureType }): TimePoint[] {
  const pts = rows
    .filter((r) => r.territory_code === q.territory && r.period_type === q.periodType && r.procedure_type === (q.procedure ?? "total") && r.territory_type !== "tsj")
    .sort((a, b) => comparePeriods(a.period, b.period));
  const byPeriod = new Map(pts.map((p) => [p.period, p.value]));
  return pts.map((p) => {
    const prev = byPeriod.get(previousYearPeriod(p.period));
    return {
      period: p.period,
      value: p.value,
      yoy: prev ? ((p.value - prev) / prev) * 100 : null,
      derivation: p.derivation,
    };
  });
}

export function procedureBreakdown(rows: Statistic[], territory: string, period: string) {
  const types: ProcedureType[] = ["arrendamientos_urbanos", "ejecucion_hipotecaria", "otros"];
  const parts = types.map((t) => ({ type: t, value: valueAt(rows, { territory, period, procedure: t })?.value ?? null }));
  return parts.some((p) => p.value !== null) ? parts : null;
}

export async function populationFor(territory: string, year: string): Promise<number | null> {
  const pop = await primarySeries("poblacion");
  return pop?.rows.find((r) => r.territory_code === territory && r.period === year)?.value ?? null;
}
