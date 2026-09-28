/**
 * Mapeo semántico de un cubo estadístico (JSON-stat o PC-Axis) al modelo `Statistic`.
 *
 * Los cubos de PxWeb tienen dimensiones con nombres libres ("Periodo", "TSJ/Provincia",
 * "Concepto"…). Aquí se decide qué papel juega cada dimensión:
 *   period     → "2024" | "2024-Q1"
 *   territory  → ES | PR-XX | TSJ (CA-XX)
 *   procedure  → total | ejecucion_hipotecaria | arrendamientos_urbanos | otros
 *   metric     → lanzamientos_practicados | …
 *   other      → se toma su valor "Total"; si no existe, se suman sus valores (y se avisa)
 *
 * La detección es heurística pero SIEMPRE auditable: `describeMapping` genera el informe
 * que imprime `npm run ingest:cgpj:discover`, y cada dataset puede fijar `roles` a mano.
 */
import type { Cube, CubeVariable } from "./types";
import type { Metric, ProcedureType, Statistic } from "@/lib/schema";
import { matchTerritory, PROVINCES, CCAA } from "@/lib/territories";

export type Role = "period" | "territory" | "procedure" | "metric" | "other";

export interface CubeMappingConfig {
  datasetId: string;
  sourceId: string;
  /** Métrica fija si el cubo no tiene dimensión de concepto. */
  metric?: Metric;
  /** Roles forzados por código de variable (tras revisar el informe de descubrimiento). */
  roles?: Record<string, Role>;
}

const PERIOD_VAR = /(periodo|período|trimestre|año|anyo|fecha|tiempo|time|year)/i;
const PROCEDURE_VAR = /(tipo|clase|procedimiento|causa|origen|motivo)/i;
const TERRITORY_VAR = /(tsj|provincia|territor|comunidad|ámbito|ambito|partido|geogr|ccaa)/i;

const PROCEDURE_RULES: [RegExp, ProcedureType][] = [
  [/hipotec/i, "ejecucion_hipotecaria"],
  [/arrendamiento|\bl\.?\s?a\.?\s?u\.?\b|alquiler/i, "arrendamientos_urbanos"],
  [/^\s*(otros|otras|resto)/i, "otros"],
  [/^\s*total/i, "total"],
];

const METRIC_RULES: [RegExp, Metric][] = [
  [/practicad/i, "lanzamientos_practicados"],
  [/suspendid/i, "lanzamientos_suspendidos"],
  [/recibid|ingresad|entrad/i, "lanzamientos_recibidos"],
];

export function classifyProcedure(label: string): ProcedureType | null {
  for (const [re, p] of PROCEDURE_RULES) if (re.test(label)) return p;
  return null;
}

export function classifyMetric(label: string): Metric | null {
  for (const [re, m] of METRIC_RULES) if (re.test(label)) return m;
  return null;
}

const isTotal = (label: string) => /^\s*(total|todos|todas|ambos)\b/i.test(label);

/** "2024", "2024T1", "2024-T1", "T1 2024", "1er trimestre 2024", "Primer trimestre de 2024", "2024Q1"… */
export function parsePeriod(label: string): { period: string; type: "year" | "quarter" } | null {
  const s = label.trim().toLowerCase();
  const ordinals: Record<string, number> = { primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4 };
  const year = /(19|20)\d{2}/.exec(s)?.[0];
  if (!year) return null;
  let q: number | null = null;
  const m1 = /(?:^|[^a-z])(?:t|q)\s?([1-4])(?![0-9])/.exec(s) ?? /(?:^|\D)([1-4])\s?(?:º|er|o|ª)?\s?(?:t\b|trim)/.exec(s);
  if (m1) q = Number(m1[1]);
  else {
    const m2 = /(primer|primero|segundo|tercer|tercero|cuarto)\s+trim/.exec(s);
    if (m2) q = ordinals[m2[1]];
  }
  if (q) return { period: `${year}-Q${q}`, type: "quarter" };
  if (/trim/.test(s)) return null; // trimestre sin número reconocible: mejor no adivinar
  if (/^\s*(19|20)\d{2}\s*$/.test(s) || /^(año|anyo)\s+(19|20)\d{2}$/.test(s)) return { period: year, type: "year" };
  return null;
}

export type TerritoryHit =
  | { level: "country"; code: "ES" }
  | { level: "province"; code: string }
  | { level: "tsj"; code: string }
  | null;

function cleanLabel(l: string) {
  return l.replace(/^\s*\d{1,5}\s*[-.:]?\s+/, "").trim();
}

/**
 * Clasifica los valores de una dimensión territorial. Regla para los nombres ambiguos
 * (uniprovinciales: Madrid, Murcia, Navarra…): si la misma etiqueta aparece dos veces,
 * la primera aparición es el TSJ (nivel superior, listado antes) y la segunda la provincia.
 */
export function classifyTerritories(values: CubeVariable["values"]): Map<string, TerritoryHit> {
  const out = new Map<string, TerritoryHit>();
  const seen = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const v of values) {
    const k = cleanLabel(v.label).toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const v of values) {
    const label = cleanLabel(v.label);
    const k = label.toLowerCase();
    const occurrence = (seen.get(k) ?? 0) + 1;
    seen.set(k, occurrence);
    if (/^(total|total nacional|nacional|españa|espana)\b/i.test(label)) {
      out.set(v.code, { level: "country", code: "ES" });
      continue;
    }
    const explicitTsj = /^(tsj|t\.s\.j\.|tribunal superior)/i.test(label);
    const duplicated = (counts.get(k) ?? 0) > 1;
    if (explicitTsj || (duplicated && occurrence === 1)) {
      const t = matchTerritory(label, "tsj");
      out.set(v.code, t ? { level: "tsj", code: t.id } : null);
      continue;
    }
    const p = matchTerritory(label, "province");
    if (p) {
      out.set(v.code, { level: "province", code: p.id });
      continue;
    }
    const t = matchTerritory(label, "tsj");
    out.set(v.code, t ? { level: "tsj", code: t.id } : null);
  }
  return out;
}

export function detectRoles(cube: Cube, cfg: CubeMappingConfig): Record<string, Role> {
  const roles: Record<string, Role> = {};
  for (const v of cube.variables) {
    if (cfg.roles?.[v.code]) {
      roles[v.code] = cfg.roles[v.code];
      continue;
    }
    const text = `${v.code} ${v.label}`;
    const periodHits = v.values.filter((x) => parsePeriod(x.label)).length;
    if (v.time || (PERIOD_VAR.test(text) && periodHits > 0) || periodHits >= Math.max(1, v.values.length * 0.8)) {
      roles[v.code] = "period";
      continue;
    }
    if (TERRITORY_VAR.test(text)) {
      roles[v.code] = "territory";
      continue;
    }
    const nonTotal = v.values.filter((x) => !isTotal(x.label));
    const procHits = nonTotal.filter((x) => classifyProcedure(x.label) && classifyProcedure(x.label) !== "total").length;
    if (procHits >= 2 || (procHits >= 1 && PROCEDURE_VAR.test(text))) {
      roles[v.code] = "procedure";
      continue;
    }
    const metricHits = v.values.filter((x) => classifyMetric(x.label)).length;
    if (metricHits >= 1 && (!cfg.metric || metricHits >= 2)) {
      roles[v.code] = "metric";
      continue;
    }
    // Territorio sin nombre de variable reconocible: mayoría de valores son provincias.
    const terr = classifyTerritories(v.values);
    const terrHits = [...terr.values()].filter(Boolean).length;
    if (terrHits >= Math.min(10, v.values.length * 0.5)) {
      roles[v.code] = "territory";
      continue;
    }
    roles[v.code] = "other";
  }
  return roles;
}

export interface MappingReport {
  roles: Record<string, Role>;
  unmatchedTerritories: string[];
  unmatchedPeriods: string[];
  summedDimensions: string[];
  warnings: string[];
}

type RowKey = string;

export function mapCube(
  cube: Cube,
  cfg: CubeMappingConfig,
  meta: { snapshotId: string; retrievedAt: string },
): { rows: Statistic[]; report: MappingReport } {
  const roles = detectRoles(cube, cfg);
  const warnings: string[] = [];
  const byRole = (r: Role) => cube.variables.filter((v) => roles[v.code] === r);
  const [periodVar] = byRole("period");
  const [territoryVar] = byRole("territory");
  const procedureVar = byRole("procedure")[0];
  const metricVar = byRole("metric")[0];
  const others = byRole("other");

  if (!periodVar) throw new Error(`${cfg.datasetId}: no se identifica la dimensión temporal`);
  if (!territoryVar) throw new Error(`${cfg.datasetId}: no se identifica la dimensión territorial`);
  if (!metricVar && !cfg.metric) throw new Error(`${cfg.datasetId}: sin dimensión de concepto ni métrica fija`);
  if (byRole("territory").length > 1) warnings.push(`${cfg.datasetId}: varias dimensiones territoriales; se usa "${territoryVar.label}"`);

  const terr = classifyTerritories(territoryVar.values);
  const unmatchedTerritories = territoryVar.values.filter((v) => !terr.get(v.code)).map((v) => v.label);

  const otherTotals = new Map<string, string | null>();
  const summedDimensions: string[] = [];
  for (const o of others) {
    const tot = o.values.find((x) => isTotal(x.label));
    otherTotals.set(o.code, tot?.code ?? null);
    if (!tot) summedDimensions.push(o.label);
  }
  if (summedDimensions.length) warnings.push(`${cfg.datasetId}: sin valor "Total" en ${summedDimensions.join(", ")}; se suman sus valores`);

  const unmatchedPeriods = new Set<string>();
  const acc = new Map<RowKey, Statistic>();

  for (const cell of cube.cells) {
    if (cell.value === null) continue;
    let skip = false;
    for (const o of others) {
      const tot = otherTotals.get(o.code);
      if (tot && cell.dims[o.code].code !== tot) skip = true;
    }
    if (skip) continue;

    const pLabel = cell.dims[periodVar.code];
    const p = parsePeriod(pLabel.label) ?? parsePeriod(pLabel.code);
    if (!p) {
      unmatchedPeriods.add(pLabel.label);
      continue;
    }
    const t = terr.get(cell.dims[territoryVar.code].code);
    if (!t) continue;

    let procedure: ProcedureType = "total";
    if (procedureVar) {
      const c = classifyProcedure(cell.dims[procedureVar.code].label);
      if (!c) continue;
      procedure = c;
    }
    let metric = cfg.metric;
    if (metricVar) {
      const m = classifyMetric(cell.dims[metricVar.code].label);
      if (!m) continue;
      metric = m;
    }
    if (!metric) continue;

    const key = [metric, procedure, t.level, t.code, p.period].join("|");
    const prev = acc.get(key);
    if (prev) {
      prev.value += cell.value;
    } else {
      acc.set(key, {
        id: `${cfg.datasetId}:${metric}:${procedure}:${t.code}:${p.period}`,
        period: p.period,
        period_type: p.type,
        territory_type: t.level,
        territory_code: t.code,
        metric,
        procedure_type: procedure,
        value: cell.value,
        derivation: "reported",
        source_id: cfg.sourceId,
        dataset_id: cfg.datasetId,
        snapshot_id: meta.snapshotId,
        retrieved_at: meta.retrievedAt,
        demo: false,
      });
    }
  }

  return {
    rows: [...acc.values()],
    report: {
      roles,
      unmatchedTerritories,
      unmatchedPeriods: [...unmatchedPeriods],
      summedDimensions,
      warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// Agregados derivados

/**
 * Deriva CCAA y total nacional sumando provincias, y años sumando trimestres,
 * SOLO cuando todas las piezas existen (si falta una provincia o un trimestre no se deriva:
 * un total incompleto sería engañoso). Nunca sobrescribe un valor reportado por la fuente.
 * Devuelve también avisos cuando un total reportado no coincide con la suma de sus partes.
 */
export function deriveAggregates(rows: Statistic[]): { rows: Statistic[]; warnings: string[] } {
  const warnings: string[] = [];
  const out = new Map(rows.map((r) => [keyOf(r), r]));

  const add = (r: Statistic) => {
    const k = keyOf(r);
    const existing = out.get(k);
    if (existing) {
      const diff = Math.abs(existing.value - r.value);
      if (diff > Math.max(1, existing.value * 0.005)) {
        warnings.push(
          `${r.dataset_id}: ${r.territory_code} ${r.period} ${r.metric}/${r.procedure_type} reportado=${existing.value} suma=${r.value}`,
        );
      }
      return;
    }
    out.set(k, r);
  };

  // 1) trimestres → año (por territorio)
  const groups = new Map<string, Statistic[]>();
  for (const r of out.values()) {
    if (r.period_type !== "quarter") continue;
    const g = [r.dataset_id, r.metric, r.procedure_type, r.territory_type, r.territory_code, r.period.slice(0, 4)].join("|");
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(r);
  }
  for (const qs of groups.values()) {
    if (qs.length !== 4) continue;
    const b = qs[0];
    add(derived(b, { period: b.period.slice(0, 4), period_type: "year", value: sum(qs) }));
  }

  // 2) provincias → CCAA → España
  const provRows = [...out.values()].filter((r) => r.territory_type === "province");
  const byPeriod = new Map<string, Statistic[]>();
  for (const r of provRows) {
    const g = [r.dataset_id, r.metric, r.procedure_type, r.period].join("|");
    (byPeriod.get(g) ?? byPeriod.set(g, []).get(g)!).push(r);
  }
  for (const list of byPeriod.values()) {
    const b = list[0];
    const have = new Map(list.map((r) => [r.territory_code, r]));
    for (const c of CCAA) {
      const provs = PROVINCES.filter((p) => p.parent === c.id);
      if (provs.every((p) => have.has(p.id))) {
        add(derived(b, { territory_type: "ccaa", territory_code: c.id, value: sum(provs.map((p) => have.get(p.id)!)) }));
      }
    }
    if (PROVINCES.every((p) => have.has(p.id))) {
      add(derived(b, { territory_type: "country", territory_code: "ES", value: sum(list) }));
    }
  }

  return { rows: [...out.values()], warnings };
}

function sum(rs: Statistic[]) {
  return rs.reduce((a, r) => a + r.value, 0);
}

function keyOf(r: Pick<Statistic, "dataset_id" | "metric" | "procedure_type" | "territory_type" | "territory_code" | "period">) {
  return [r.dataset_id, r.metric, r.procedure_type, r.territory_type, r.territory_code, r.period].join("|");
}

function derived(base: Statistic, patch: Partial<Statistic>): Statistic {
  const r = { ...base, ...patch, derivation: "derived" as const };
  r.id = `${r.dataset_id}:${r.metric}:${r.procedure_type}:${r.territory_code}:${r.period}`;
  return r;
}

/** Texto legible del mapeo para revisión humana. */
export function describeMapping(cube: Cube, cfg: CubeMappingConfig): string {
  const roles = detectRoles(cube, cfg);
  const lines = [`# ${cfg.datasetId} — ${cube.title}`, `Actualizado en origen: ${cube.updated ?? "desconocido"}`, ""];
  for (const v of cube.variables) {
    lines.push(`## ${v.code} "${v.label}" → ${roles[v.code]}${v.time ? " (time)" : ""} · ${v.values.length} valores`);
    const terr = roles[v.code] === "territory" ? classifyTerritories(v.values) : null;
    for (const x of v.values.slice(0, 80)) {
      let note = "";
      if (roles[v.code] === "period") note = parsePeriod(x.label)?.period ?? "¿?";
      if (terr) {
        const t = terr.get(x.code);
        note = t ? `${t.level}:${t.code}` : "(ignorado)";
      }
      if (roles[v.code] === "procedure") note = classifyProcedure(x.label) ?? "(ignorado)";
      if (roles[v.code] === "metric") note = classifyMetric(x.label) ?? "(ignorado)";
      if (roles[v.code] === "other") note = isTotal(x.label) ? "TOTAL (se usa)" : "";
      lines.push(`   ${x.code.padEnd(12)} ${x.label.padEnd(50)} ${note}`);
    }
    if (v.values.length > 80) lines.push(`   … ${v.values.length - 80} más`);
  }
  return lines.join("\n");
}
