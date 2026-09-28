/**
 * ETL:  fuente → snapshot bruto → normalización → data/normalized/*.json  (→ db:sync → PostgreSQL)
 *
 *   npx tsx scripts/ingest.ts cgpj                 descarga + normaliza
 *   npx tsx scripts/ingest.ts cgpj --discover      lista tablas y cómo se mapearían (no escribe)
 *   npx tsx scripts/ingest.ts cgpj --normalize-only  re-normaliza el último snapshot sin red
 *   npx tsx scripts/ingest.ts ine | manual
 */
import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { ADAPTERS } from "../src/data-sources";
import { cgpjAdapter } from "../src/data-sources/cgpj";
import { latestSnapshotDir, NORMALIZED_DIR, readManifest, SNAPSHOT_DIR, snapshotIdFor, verifySnapshot, writeManifest } from "../src/data-sources/snapshot";
import type { NormalizedResult } from "../src/data-sources/types";
import { DatasetSchema, SourceSchema, StatisticSchema, type Dataset, type Source, type Statistic } from "../src/lib/schema";

const [, , sourceId, ...flags] = process.argv;
const log = (m: string) => console.log(`[${new Date().toISOString()}] ${m}`);

async function readArr<T>(name: string): Promise<T[]> {
  try {
    return JSON.parse(await readFile(path.join(NORMALIZED_DIR, name), "utf8")) as T[];
  } catch {
    return [];
  }
}

async function merge(result: NormalizedResult) {
  // Validación estricta antes de escribir nada.
  result.sources.forEach((s) => SourceSchema.parse(s));
  result.datasets.forEach((d) => DatasetSchema.parse(d));
  result.statistics.forEach((s) => StatisticSchema.parse(s));

  const replacedDatasets = new Set(result.datasets.map((d) => d.id));
  const sources = new Map((await readArr<Source>("sources.json")).map((s) => [s.id, s]));
  for (const s of result.sources) sources.set(s.id, s);
  const datasets = (await readArr<Dataset>("datasets.json")).filter((d) => !replacedDatasets.has(d.id)).concat(result.datasets);
  const statistics = (await readArr<Statistic>("statistics.json")).filter((s) => !replacedDatasets.has(s.dataset_id)).concat(result.statistics);
  statistics.sort((a, b) => a.id.localeCompare(b.id));

  await mkdir(NORMALIZED_DIR, { recursive: true });
  const w = (n: string, d: unknown) => writeFile(path.join(NORMALIZED_DIR, n), JSON.stringify(d, null, 1) + "\n");
  await Promise.all([
    w("sources.json", [...sources.values()].sort((a, b) => a.id.localeCompare(b.id))),
    w("datasets.json", datasets.sort((a, b) => a.id.localeCompare(b.id))),
    w("statistics.json", statistics),
  ]);
  log(`normalizado: ${result.datasets.length} datasets, ${result.statistics.length} filas`);
}

async function main() {
  const adapter = ADAPTERS[sourceId as keyof typeof ADAPTERS];
  if (!adapter) {
    console.error(`Uso: ingest <${Object.keys(ADAPTERS).join("|")}> [--discover|--normalize-only]`);
    process.exit(2);
  }
  const now = new Date();

  if (flags.includes("--discover")) {
    if (adapter.id !== "cgpj") throw new Error("--discover solo está disponible para cgpj");
    const report = await cgpjAdapter.discover({ dir: "", snapshotId: "", now, fetch, log });
    const out = path.join(SNAPSHOT_DIR, "cgpj", `discover-${snapshotIdFor(now)}.txt`);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, report);
    console.log(report);
    log(`informe guardado en ${path.relative(process.cwd(), out)}`);
    return;
  }

  let dir: string;
  if (flags.includes("--normalize-only")) {
    const latest = await latestSnapshotDir(adapter.id);
    if (!latest) throw new Error(`No hay snapshots de ${adapter.id}`);
    dir = latest;
    const problems = await verifySnapshot(dir, await readManifest(dir));
    if (problems.length) throw new Error(`Snapshot alterado: ${problems.join(", ")}`);
  } else {
    const snapshotId = snapshotIdFor(now);
    dir = path.join(SNAPSHOT_DIR, adapter.id, snapshotId);
    await mkdir(dir, { recursive: true });
    let manifest;
    try {
      manifest = await adapter.fetchSnapshot({ dir, snapshotId, now, fetch, log });
    } catch (e) {
      await rm(dir, { recursive: true, force: true });
      throw e;
    }
    log(`snapshot ${snapshotId}: ${manifest.files.length} ficheros`);
    if (!manifest.files.length) {
      await rm(dir, { recursive: true, force: true });
      log("snapshot vacío: no se modifica data/normalized");
      return;
    }
    await writeManifest(dir, manifest);
  }

  const manifest = await readManifest(dir);
  const result = await adapter.normalize(dir, manifest);
  await writeFile(path.join(dir, "report.json"), JSON.stringify({ warnings: result.warnings, rows: result.statistics.length }, null, 2));
  for (const w of result.warnings) log(`AVISO ${w}`);
  await merge(result);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
