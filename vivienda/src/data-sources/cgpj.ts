/**
 * Adaptador CGPJ — Estadística Judicial (PxWeb).
 *
 * Ver DATA_SOURCES.md para el estado de verificación de cada tabla.
 *
 * Particularidades conocidas del servicio del CGPJ:
 *  - La ruta base cambia con cada publicación (PxWeb2020v2, PxWeb2023v1, PXWeb-2025-v1,
 *    PxWeb-20252-v1…). Probamos una lista de candidatas, empezando por CGPJ_PXWEB_BASE.
 *  - Las tablas están organizadas por TIPO DE ÓRGANO (Juzgados de Primera Instancia,
 *    de Primera Instancia e Instrucción, Servicios Comunes…). Una sola tabla NO es el total
 *    de lanzamientos de un territorio: en las capitales los practican otros órganos.
 *    Por eso cada tabla se guarda como dataset independiente y la serie "principal"
 *    (mapa, contadores) se configura explícitamente en data/config/series.json.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { DataSourceAdapter, FetchContext, NormalizedResult, SnapshotFile, SnapshotManifest, Cube } from "./types";
import { PxWebClient } from "./pxweb";
import { parseJsonStat, type JsonStatDataset } from "./jsonstat";
import { parsePx } from "./px";
import { mapCube, deriveAggregates, describeMapping, type CubeMappingConfig } from "./cube-mapping";
import { saveRaw } from "./snapshot";
import type { Dataset, Metric, Source } from "@/lib/schema";

export const CGPJ_SOURCE_ID = "cgpj-estadistica-judicial";

export const CGPJ_BASE_CANDIDATES = [
  process.env.CGPJ_PXWEB_BASE,
  "https://www6.poderjudicial.es/PxWeb-20252-v1",
  "https://www6.poderjudicial.es/PXWeb-2025-v1",
  "https://www6.poderjudicial.es/PxWeb2023v1",
  "https://www6.poderjudicial.es/PXWeb",
].filter((x): x is string => Boolean(x));

export interface CgpjTable extends Omit<CubeMappingConfig, "sourceId"> {
  title: string;
  db: string;
  table: string;
  organScope: string;
  metric?: Metric;
  methodology: string;
  limitations: string[];
}

/**
 * Tablas localizadas en la base PxWeb del CGPJ (títulos y rutas comprobados en el catálogo
 * público del CGPJ). Sus dimensiones exactas deben confirmarse con `npm run ingest:cgpj:discover`
 * y, si hiciera falta, fijarse en `roles`.
 */
export const CGPJ_TABLES: CgpjTable[] = [
  {
    datasetId: "cgpj-lanzamientos-practicados-jpii",
    title: "Lanzamientos practicados · Juzgados de Primera Instancia e Instrucción",
    db: "10.-Juzgados de Primera Instancia e Instrucción",
    table: "OUJII021.px",
    organScope: "Juzgados de Primera Instancia e Instrucción (partidos judiciales sin separación de jurisdicciones)",
    metric: "lanzamientos_practicados",
    methodology:
      "Lanzamientos practicados comunicados trimestralmente por los órganos al Boletín estadístico del CGPJ. " +
      "Un lanzamiento es la diligencia judicial de desalojo; no equivale a un hogar ni a una persona.",
    limitations: [
      "Cubre solo un tipo de órgano: no incluye los lanzamientos practicados por Juzgados de Primera Instancia ni por Servicios Comunes.",
      "Registra diligencias practicadas, no personas ni hogares afectados.",
    ],
  },
  {
    datasetId: "cgpj-lanzamientos-suspendidos-scpg",
    title: "Lanzamientos suspendidos · Servicio común procesal general",
    db: "13.-Servicios Comunes de Notificaciones y Embargos",
    table: "OUSCPG020.px",
    organScope: "Servicios comunes procesales generales",
    metric: "lanzamientos_suspendidos",
    methodology: "Lanzamientos cuya práctica se suspendió, según los servicios comunes procesales generales.",
    limitations: [
      "Solo existe en los partidos judiciales con servicio común; no es una serie nacional completa.",
      "Una suspensión puede ir seguida de un nuevo señalamiento: no implica que el desalojo no se produzca.",
    ],
  },
];

const TABLE_TITLE_RE = /lanzamiento|desahucio|ejecuci[oó]n(es)? hipotecaria/i;

export function tableWebUrl(base: string, t: Pick<CgpjTable, "db" | "table">): string {
  return `${base}/pxweb/es/${encodeURIComponent(t.db)}/-/${encodeURIComponent(t.table)}/`;
}

async function resolveBase(ctx: FetchContext): Promise<{ client: PxWebClient; api: boolean } | null> {
  for (const base of CGPJ_BASE_CANDIDATES) {
    const client = new PxWebClient({ base, fetch: ctx.fetch });
    try {
      const dbs = await client.list();
      if (dbs.length) {
        ctx.log(`CGPJ: API PxWeb disponible en ${base} (${dbs.length} bases de datos)`);
        return { client, api: true };
      }
    } catch (e) {
      ctx.log(`CGPJ: ${base} sin API (${(e as Error).message})`);
    }
    try {
      const res = await ctx.fetch(`${base}/pxweb/es/`, { signal: AbortSignal.timeout(20_000) });
      if (res.ok) {
        ctx.log(`CGPJ: interfaz PxWeb disponible en ${base}; se usarán ficheros .px`);
        return { client, api: false };
      }
    } catch {
      /* siguiente candidata */
    }
  }
  return null;
}

export const cgpjAdapter: DataSourceAdapter & {
  discover(ctx: FetchContext): Promise<string>;
} = {
  id: "cgpj",
  name: "Consejo General del Poder Judicial — Estadística Judicial (PxWeb)",

  async fetchSnapshot(ctx) {
    const resolved = await resolveBase(ctx);
    if (!resolved) throw new Error("CGPJ: ninguna base PxWeb accesible. Ajusta CGPJ_PXWEB_BASE (ver DATA_SOURCES.md).");
    const { client, api } = resolved;
    const files: SnapshotFile[] = [];
    const notes: string[] = [`base=${client.base}`, `modo=${api ? "api-json-stat2" : "fichero-px"}`];

    for (const t of CGPJ_TABLES) {
      const id = t.datasetId;
      try {
        if (api) {
          const meta = await client.metadata(t.db, t.table);
          files.push(await saveRaw(ctx.dir, `${id}.meta.json`, JSON.stringify(meta), client.apiUrl(t.db, t.table), "application/json"));
          const data = await client.queryAll(meta, t.db, t.table);
          files.push(await saveRaw(ctx.dir, `${id}.jsonstat.json`, data, client.apiUrl(t.db, t.table), "application/json"));
        } else {
          throw new Error("sin API");
        }
      } catch (e) {
        ctx.log(`CGPJ: ${id} vía API falló (${(e as Error).message}); probando fichero .px`);
        try {
          const px = await client.pxFile(t.db, t.table);
          files.push(await saveRaw(ctx.dir, `${id}.px`, px.text, px.url, "text/plain; charset=utf-8"));
        } catch (e2) {
          notes.push(`${id}: no descargado (${(e2 as Error).message})`);
          ctx.log(`CGPJ: ${id} no disponible: ${(e2 as Error).message}`);
        }
      }
    }
    return { source: "cgpj", snapshot_id: ctx.snapshotId, retrieved_at: ctx.now.toISOString(), files, notes };
  },

  async normalize(dir, manifest): Promise<NormalizedResult> {
    const base = manifest.notes.find((n) => n.startsWith("base="))?.slice(5) ?? CGPJ_BASE_CANDIDATES[0];
    const warnings: string[] = [];
    const source: Source = {
      id: CGPJ_SOURCE_ID,
      name: "Consejo General del Poder Judicial · Estadística Judicial",
      url: `${base}/pxweb/es/`,
      type: "dataset_oficial",
      retrieved_at: manifest.retrieved_at,
      published_at: null,
      notes: "Base de datos PxWeb de la Sección de Estadística Judicial del CGPJ.",
    };
    const datasets: Dataset[] = [];
    let statistics: NormalizedResult["statistics"] = [];

    for (const t of CGPJ_TABLES) {
      const cube = await loadCube(dir, manifest, t.datasetId);
      if (!cube) {
        warnings.push(`${t.datasetId}: sin fichero en el snapshot`);
        continue;
      }
      const { rows, report } = mapCube(cube, { ...t, sourceId: CGPJ_SOURCE_ID }, {
        snapshotId: manifest.snapshot_id,
        retrievedAt: manifest.retrieved_at,
      });
      warnings.push(...report.warnings);
      if (report.unmatchedPeriods.length) warnings.push(`${t.datasetId}: periodos no reconocidos: ${report.unmatchedPeriods.slice(0, 5).join(", ")}`);
      const { rows: all, warnings: w2 } = deriveAggregates(rows);
      warnings.push(...w2);
      statistics = statistics.concat(all);
      const periods = all.map((r) => r.period).sort();
      datasets.push({
        id: t.datasetId,
        source_id: CGPJ_SOURCE_ID,
        title: t.title,
        url: tableWebUrl(base, t),
        methodology: `${t.methodology} Ámbito: ${t.organScope}.`,
        limitations: t.limitations,
        territorial_levels: [...new Set(all.map((r) => r.territory_type))],
        period_types: [...new Set(all.map((r) => r.period_type))],
        first_period: periods[0] ?? null,
        last_period: periods[periods.length - 1] ?? null,
        source_updated_at: toIso(cube.updated),
        retrieved_at: manifest.retrieved_at,
        demo: false,
      });
    }
    return { sources: [source], datasets, statistics, warnings };
  },

  /**
   * Recorre el catálogo PxWeb buscando tablas relacionadas con lanzamientos y
   * describe cómo se mapearían sus dimensiones. No escribe nada.
   */
  async discover(ctx) {
    const resolved = await resolveBase(ctx);
    if (!resolved?.api) return "No hay API PxWeb accesible para descubrir tablas.";
    const { client } = resolved;
    const out: string[] = [`Base: ${client.base}`];
    const dbs = await client.list();
    for (const db of dbs) {
      const walk = async (pathParts: string[], depth: number): Promise<void> => {
        if (depth > 3) return;
        const nodes = await client.list(...pathParts);
        for (const n of nodes) {
          if (n.type === "t" && TABLE_TITLE_RE.test(n.text)) {
            out.push(`\n[TABLA] ${[...pathParts, n.id].join(" / ")} — ${n.text}`);
            try {
              const meta = await client.metadata(...pathParts, n.id);
              const data = await client.queryAll(meta, ...pathParts, n.id);
              const cube = parseJsonStat(JSON.parse(data) as JsonStatDataset);
              out.push(describeMapping(cube, { datasetId: n.id, sourceId: CGPJ_SOURCE_ID }));
            } catch (e) {
              out.push(`   (no se pudo leer: ${(e as Error).message})`);
            }
          } else if (n.type === "l") {
            await walk([...pathParts, n.id], depth + 1);
          }
        }
      };
      await walk([db.id], 0);
    }
    return out.join("\n");
  },
};

async function loadCube(dir: string, manifest: SnapshotManifest, id: string): Promise<Cube | null> {
  const js = manifest.files.find((f) => f.name === `${id}.jsonstat.json`);
  if (js) return parseJsonStat(JSON.parse(await readFile(path.join(dir, js.name), "utf8")) as JsonStatDataset);
  const px = manifest.files.find((f) => f.name === `${id}.px`);
  if (px) return parsePx(await readFile(path.join(dir, px.name), "utf8"), "es");
  return null;
}

function toIso(s: string | null): string | null {
  if (!s) return null;
  // PC-Axis: "20250315 10:00"; JSON-stat: ISO
  const m = /^(\d{4})(\d{2})(\d{2})\s+(\d{2}):(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
