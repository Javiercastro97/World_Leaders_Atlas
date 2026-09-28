/**
 * Sincroniza en PostgreSQL los datos versionados en git:
 *   - territorios de referencia
 *   - data/normalized (estadísticas del ETL)
 *   - data/curated (organizaciones y convocatorias revisadas por PR)
 * Idempotente (upsert). Nunca carga datos DEMO.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { ALL_TERRITORIES } from "../src/lib/territories";
import { loadCurated } from "../src/data-sources/collectives";
import type { Dataset, Source, Statistic } from "../src/lib/schema";
import { NORMALIZED_DIR } from "../src/data-sources/snapshot";

const read = async <T>(n: string): Promise<T[]> => {
  try {
    return JSON.parse(await readFile(path.join(NORMALIZED_DIR, n), "utf8")) as T[];
  } catch {
    return [];
  }
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definido");
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  await sql.begin(async (tx) => {
    for (const t of ALL_TERRITORIES) {
      if (t.type === "municipality") continue;
      const row = { id: t.id, type: t.type, ine: t.ine, name: t.name, short_name: t.shortName, slug: t.slug, parent_id: t.parent, tsj: t.tsj, timezone: t.timezone };
      await tx`insert into territories ${tx(row)} on conflict (id) do update set ${tx(row)}`;
    }

    const curated = await loadCurated();
    if (curated.errors.length) throw new Error("Ficheros curados inválidos:\n" + curated.errors.join("\n"));
    const sources = [...(await read<Source>("sources.json")), ...curated.sources];
    for (const s of sources) await tx`insert into sources ${tx(s)} on conflict (id) do update set ${tx(s)}`;

    for (const d of await read<Dataset>("datasets.json")) {
      const row = { ...d, limitations: tx.json(d.limitations), territorial_levels: tx.json(d.territorial_levels), period_types: tx.json(d.period_types) };
      await tx`insert into datasets ${tx(row as Record<string, unknown>)} on conflict (id) do update set ${tx(row as Record<string, unknown>)}`;
    }

    const stats = await read<Statistic>("statistics.json");
    const datasetIds = [...new Set(stats.map((s) => s.dataset_id))];
    if (datasetIds.length) await tx`delete from statistics where dataset_id in ${tx(datasetIds)}`;
    for (let i = 0; i < stats.length; i += 1000) {
      await tx`insert into statistics ${tx(stats.slice(i, i + 1000) as unknown as Record<string, unknown>[])}`;
    }

    for (const o of curated.organizations) {
      const row = { ...o, social_links: tx.json(o.social_links) };
      await tx`insert into organizations ${tx(row as Record<string, unknown>)} on conflict (id) do update set ${tx(row as Record<string, unknown>)}`;
    }
    for (const e of curated.events) {
      const l = e.location;
      await tx`insert into locations ${tx(l)} on conflict (id) do update set ${tx(l)}`;
      const row = {
        id: e.id, slug: e.slug, type: e.type, title: e.title, description: e.description, date: e.date, time: e.time,
        end_time: e.end_time, timezone: e.timezone, status: e.status, organization_id: e.organization_id,
        organizer_name: e.organizer_name, location_id: l.id, latitude: l.latitude, longitude: l.longitude,
        precision: l.precision, source_id: e.source_id, verification_status: e.verification_status,
        submitted_at: e.submitted_at, verified_at: e.verified_at, last_checked_at: e.last_checked_at,
        demo: false, created_at: e.created_at, updated_at: e.updated_at,
      };
      await tx`insert into events ${tx(row)} on conflict (id) do update set ${tx(row)}`;
    }
    console.log(`sincronizado: ${sources.length} fuentes, ${stats.length} estadísticas, ${curated.organizations.length} organizaciones, ${curated.events.length} convocatorias`);
  });
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
