/**
 * Genera datos de PRUEBA (ficticios, marcados "[PRUEBA E2E]") en tests/fixtures/data con fechas
 * relativas a hoy. Si hay DATABASE_URL, recrea el esquema y sincroniza. Solo para tests.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { addDays, localDate } from "../../src/lib/dates";
import { PROVINCES } from "../../src/lib/territories";

const root = path.resolve(import.meta.dirname, "../fixtures/data");
const today = localDate(new Date());
const src = (url: string) => ({ name: "[PRUEBA E2E] Web ficticia", url, type: "web_organizacion", retrieved_at: new Date().toISOString() });

async function main() {
  await rm(root, { recursive: true, force: true });
  for (const d of ["curated/organizations", "curated/events", "normalized", "config"]) await mkdir(path.join(root, d), { recursive: true });

  const orgs = [
    { slug: "prueba-sindicato-norte", name: "[PRUEBA E2E] Sindicato Norte", type: "sindicato_vivienda", territory_id: "PR-28", municipality_name: "Madrid", latitude: 40.46, longitude: -3.69 },
    { slug: "prueba-plataforma-sur", name: "[PRUEBA E2E] Plataforma Sur", type: "plataforma", territory_id: "PR-03", municipality_name: "Alacant/Alicante", latitude: 38.35, longitude: -0.48 },
  ];
  for (const o of orgs) {
    await writeFile(
      path.join(root, "curated/organizations", `${o.slug}.json`),
      JSON.stringify({ ...o, description: "Organización ficticia para tests.", scope: "municipal", website: "https://example.org/", social_links: [], public_contact: null, verified: true, updated_at: new Date().toISOString(), source: src("https://example.org/") }),
    );
  }
  const events = [
    { slug: "prueba-hoy-madrid", d: 0, time: "23:00", org: 0, type: "concentracion", ver: "fuente_oficial", prov: "PR-28", muni: "Madrid", lat: 40.42, lon: -3.7 },
    { slug: "prueba-manana-alicante", d: 1, time: "11:30", org: 1, type: "desahucio", ver: "verificada", prov: "PR-03", muni: "Alacant/Alicante", lat: 38.35, lon: -0.49 },
    { slug: "prueba-pendiente-alicante", d: 3, time: "18:00", org: 1, type: "asamblea", ver: "pendiente", prov: "PR-03", muni: "Alacant/Alicante", lat: 38.34, lon: -0.5 },
    { slug: "prueba-proxima-madrid", d: 20, time: null, org: 0, type: "manifestacion", ver: "verificada", prov: "PR-28", muni: "Madrid", lat: 40.41, lon: -3.69 },
  ];
  for (const e of events) {
    await writeFile(
      path.join(root, "curated/events", `${e.slug}.json`),
      JSON.stringify({
        slug: e.slug,
        type: e.type,
        title: `[PRUEBA E2E] ${e.slug}`,
        description: "Convocatoria ficticia para tests automáticos.",
        date: addDays(today, e.d),
        time: e.time,
        status: "programada",
        organization_id: orgs[e.org].slug,
        organizer_name: orgs[e.org].name,
        verification_status: e.ver,
        verified_at: e.ver === "pendiente" ? null : new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        location: { municipality_code: null, municipality_name: e.muni, province_id: e.prov, neighborhood: "Centro", public_meeting_point: "[PRUEBA] Plaza pública", latitude: e.lat, longitude: e.lon, precision: "exacta", neighborhood_latitude: e.lat + 0.001, neighborhood_longitude: e.lon },
        source: src(`https://example.org/${e.slug}`),
      }),
    );
  }

  // Serie estadística sintética (valores inventados) para probar el observatorio
  const retrieved = new Date().toISOString();
  const stats = PROVINCES.flatMap((p, i) =>
    ["2023", "2024"].map((y) => ({
      id: `e2e:lanzamientos_practicados:total:${p.id}:${y}`, period: y, period_type: "year", territory_type: "province", territory_code: p.id,
      metric: "lanzamientos_practicados", procedure_type: "total", value: 100 + i + (y === "2024" ? 10 : 0), derivation: "reported",
      source_id: "e2e-source", dataset_id: "e2e-lanzamientos", snapshot_id: "e2e", retrieved_at: retrieved, demo: false,
    })),
  );
  stats.push(
    ...["2023", "2024"].map((y) => ({ ...stats[0], id: `e2e:ES:${y}`, period: y, territory_type: "country", territory_code: "ES", value: y === "2024" ? 99999 : 88888 })),
  );
  await writeFile(path.join(root, "normalized/statistics.json"), JSON.stringify(stats));
  await writeFile(path.join(root, "normalized/sources.json"), JSON.stringify([{ id: "e2e-source", name: "[PRUEBA E2E] Fuente ficticia", url: "https://example.org/fuente", type: "dataset_oficial", retrieved_at: retrieved, published_at: null, notes: null }]));
  await writeFile(
    path.join(root, "normalized/datasets.json"),
    JSON.stringify([{ id: "e2e-lanzamientos", source_id: "e2e-source", title: "[PRUEBA E2E] Serie ficticia", url: "https://example.org/fuente", methodology: "Ficticia.", limitations: ["Datos inventados para tests."], territorial_levels: ["province", "country"], period_types: ["year"], first_period: "2023", last_period: "2024", source_updated_at: null, retrieved_at: retrieved, demo: false }]),
  );
  await writeFile(path.join(root, "config/series.json"), JSON.stringify({ lanzamientos_practicados: ["e2e-lanzamientos"] }));

  if (process.env.DATABASE_URL) {
    const env = { ...process.env, VIVIENDA_DATA_DIR: root };
    execFileSync("psql", [process.env.DATABASE_URL, "-q", "-c", "drop schema public cascade; create schema public;"], { stdio: "inherit" });
    execFileSync("npx", ["tsx", "scripts/db-migrate.ts"], { stdio: "inherit", env });
    execFileSync("npx", ["tsx", "scripts/db-sync.ts"], { stdio: "inherit", env });
  }
  console.log(`fixtures e2e en ${root}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
