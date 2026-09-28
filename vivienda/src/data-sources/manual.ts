/**
 * Adaptador "manual": cifras oficiales transcritas o exportadas a CSV por una persona
 * mantenedora cuando la fuente solo se publica como informe (p. ej. las tablas por TSJ y
 * provincia del informe trimestral "Efecto de la crisis en los órganos judiciales" del CGPJ).
 *
 * Cada fila conserva su procedencia. Formato (data/manual/*.csv, separador coma, UTF-8):
 *
 *   dataset_id,dataset_title,source_name,source_url,retrieved_at,period,territory_code,metric,procedure_type,value
 *
 *   territory_code: ES | CA-XX | PR-XX | TSJ-XX
 *   period: AAAA | AAAA-QN
 *
 * Las filas no válidas detienen la importación (mejor no publicar que publicar mal).
 */
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { z } from "zod";
import type { DataSourceAdapter, NormalizedResult } from "./types";
import { DATA_DIR, saveRaw } from "./snapshot";
import { METRICS, PROCEDURE_TYPES, periodSchema, type Dataset, type Source, type Statistic } from "@/lib/schema";
import { isTerritoryId } from "@/lib/territories";
import { slugify } from "@/lib/moderation";

export const MANUAL_DIR = path.join(DATA_DIR, "manual");

const RowSchema = z.object({
  dataset_id: z.string().regex(/^[a-z0-9-]+$/),
  dataset_title: z.string().min(3),
  source_name: z.string().min(3),
  source_url: z.string().url(),
  retrieved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  period: periodSchema,
  territory_code: z.string().refine((c) => isTerritoryId(c) || /^TSJ-\d{2}$/.test(c), "territorio desconocido"),
  metric: z.enum(METRICS),
  procedure_type: z.enum(PROCEDURE_TYPES),
  value: z.coerce.number().nonnegative(),
});

/** CSV mínimo con soporte de comillas dobles. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().replace(/^\uFEFF/, ""));
  return body.filter((r) => !r[0]?.startsWith("#")).map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

export function normalizeManualRows(records: Record<string, string>[], meta: { snapshotId: string; file: string }): NormalizedResult {
  const statistics: Statistic[] = [];
  const datasets = new Map<string, Dataset>();
  const sources = new Map<string, Source>();
  records.forEach((rec, i) => {
    const parsed = RowSchema.safeParse(rec);
    if (!parsed.success) {
      throw new Error(`${meta.file}:${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
    }
    const r = parsed.data;
    const sourceId = `manual-${slugify(r.source_name)}`;
    const retrieved = new Date(r.retrieved_at).toISOString();
    sources.set(sourceId, {
      id: sourceId,
      name: r.source_name,
      url: r.source_url,
      type: "dataset_oficial",
      retrieved_at: retrieved,
      published_at: null,
      notes: "Transcripción manual revisada de una publicación oficial.",
    });
    const tsj = /^TSJ-(\d{2})$/.exec(r.territory_code);
    const territory_type: Statistic["territory_type"] = tsj
      ? "tsj"
      : r.territory_code === "ES"
        ? "country"
        : r.territory_code.startsWith("CA-")
          ? "ccaa"
          : "province";
    const territory_code = tsj ? `CA-${tsj[1]}` : r.territory_code;
    statistics.push({
      id: `${r.dataset_id}:${r.metric}:${r.procedure_type}:${territory_type === "tsj" ? "TSJ-" : ""}${territory_code}:${r.period}`,
      period: r.period,
      period_type: r.period.includes("-Q") ? "quarter" : "year",
      territory_type,
      territory_code,
      metric: r.metric,
      procedure_type: r.procedure_type,
      value: r.value,
      derivation: "reported",
      source_id: sourceId,
      dataset_id: r.dataset_id,
      snapshot_id: meta.snapshotId,
      retrieved_at: retrieved,
      demo: false,
    });
    const d = datasets.get(r.dataset_id);
    const levels = new Set(d?.territorial_levels ?? []);
    levels.add(territory_type);
    const pts = new Set(d?.period_types ?? []);
    pts.add(r.period.includes("-Q") ? "quarter" : "year");
    datasets.set(r.dataset_id, {
      id: r.dataset_id,
      source_id: sourceId,
      title: r.dataset_title,
      url: r.source_url,
      methodology: "Cifras transcritas de la publicación oficial enlazada. Ver METHODOLOGY.md.",
      limitations: ["Transcripción manual: cualquier discrepancia con la fuente original prevalece a favor de la fuente."],
      territorial_levels: [...levels],
      period_types: [...pts],
      first_period: [d?.first_period, r.period].filter(Boolean).sort()[0] ?? r.period,
      last_period: [d?.last_period, r.period].filter(Boolean).sort().pop() ?? r.period,
      source_updated_at: null,
      retrieved_at: retrieved,
      demo: false,
    });
  });
  return { sources: [...sources.values()], datasets: [...datasets.values()], statistics, warnings: [] };
}

export const manualAdapter: DataSourceAdapter = {
  id: "manual",
  name: "Transcripciones manuales de publicaciones oficiales",

  async fetchSnapshot(ctx) {
    // "Descargar" = copiar los CSV actuales al snapshot para congelar la versión usada.
    let names: string[] = [];
    try {
      names = (await readdir(MANUAL_DIR)).filter((n) => n.endsWith(".csv"));
    } catch {
      /* sin carpeta: snapshot vacío */
    }
    const files = [];
    for (const n of names) {
      const body = await readFile(path.join(MANUAL_DIR, n), "utf8");
      files.push(await saveRaw(ctx.dir, n, body, `file://data/manual/${n}`, "text/csv"));
    }
    return { source: "manual", snapshot_id: ctx.snapshotId, retrieved_at: ctx.now.toISOString(), files, notes: [] };
  },

  async normalize(dir, manifest) {
    const acc: NormalizedResult = { sources: [], datasets: [], statistics: [], warnings: [] };
    for (const f of manifest.files) {
      const text = await readFile(path.join(dir, f.name), "utf8");
      const r = normalizeManualRows(parseCsv(text), { snapshotId: manifest.snapshot_id, file: f.name });
      acc.sources.push(...r.sources);
      acc.datasets.push(...r.datasets);
      acc.statistics.push(...r.statistics);
    }
    return acc;
  },
};

