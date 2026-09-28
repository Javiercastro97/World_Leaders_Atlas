import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { parseCsv, normalizeManualRows } from "@/data-sources/manual";
import { parseIneSeries } from "@/data-sources/ine";
import { loadCurated } from "@/data-sources/collectives";

describe("adaptador manual (CSV)", () => {
  const csv = `dataset_id,dataset_title,source_name,source_url,retrieved_at,period,territory_code,metric,procedure_type,value
# comentario ignorado
cgpj-efecto-crisis,"Lanzamientos (informe, sintético)",CGPJ informe,https://example.org/informe,2026-09-28,2025-Q4,PR-03,lanzamientos_practicados,arrendamientos_urbanos,123
cgpj-efecto-crisis,"Lanzamientos (informe, sintético)",CGPJ informe,https://example.org/informe,2026-09-28,2025-Q4,TSJ-10,lanzamientos_practicados,total,400
`;
  it("parsea comillas y comentarios y conserva la procedencia", () => {
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].dataset_title).toBe("Lanzamientos (informe, sintético)");
    const r = normalizeManualRows(rows, { snapshotId: "s", file: "x.csv" });
    expect(r.statistics[0]).toMatchObject({ territory_type: "province", period_type: "quarter", value: 123, source_id: "manual-cgpj-informe" });
    expect(r.statistics[1]).toMatchObject({ territory_type: "tsj", territory_code: "CA-10" });
    expect(r.sources[0].url).toBe("https://example.org/informe");
  });
  it("detiene la importación ante una fila inválida", () => {
    const bad = csv.replace("PR-03", "PR-99");
    expect(() => normalizeManualRows(parseCsv(bad), { snapshotId: "s", file: "x.csv" })).toThrow(/x.csv:2/);
  });
});

describe("adaptador INE", () => {
  it("toma solo la serie de ambos sexos y empareja provincias", () => {
    const { rows, unmatched } = parseIneSeries(
      [
        { COD: "1", Nombre: "Total Nacional. Total. Total habitantes. Personas. ", Data: [{ Anyo: 2025, Valor: 1000 }] },
        { COD: "2", Nombre: "03 Alicante/Alacant. Total. Total habitantes. Personas. ", Data: [{ Anyo: 2025, Valor: 10 }] },
        { COD: "3", Nombre: "03 Alicante/Alacant. Hombres. Total habitantes. Personas. ", Data: [{ Anyo: 2025, Valor: 5 }] },
        { COD: "4", Nombre: "Atlántida. Total. Total habitantes. Personas.", Data: [{ Anyo: 2025, Valor: 1 }] },
      ],
      { snapshotId: "s", retrievedAt: "2026-01-01T00:00:00.000Z" },
    );
    expect(rows.map((r) => [r.territory_code, r.value])).toEqual([["ES", 1000], ["PR-03", 10]]);
    expect(unmatched).toEqual(["Atlántida"]);
  });
});

describe("datos curados", () => {
  it("valida fichas y rechaza slugs de territorio y URLs no válidas", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "curated-"));
    await mkdir(path.join(dir, "organizations"));
    await mkdir(path.join(dir, "events"));
    const org = {
      slug: "colectivo-prueba", name: "Colectivo de prueba", type: "colectivo", territory_id: "PR-03", scope: "municipal",
      verified: true, updated_at: "2026-09-01T00:00:00Z",
      source: { name: "Web", url: "https://example.org", type: "web_organizacion", retrieved_at: "2026-09-01T00:00:00Z" },
    };
    await writeFile(path.join(dir, "organizations", "ok.json"), JSON.stringify(org));
    await writeFile(path.join(dir, "organizations", "bad.json"), JSON.stringify({ ...org, slug: "alicante" }));
    await writeFile(
      path.join(dir, "events", "e.json"),
      JSON.stringify({
        slug: "asamblea-prueba", type: "asamblea", title: "Asamblea de prueba", date: "2026-10-01", time: "19:00", status: "programada",
        organization_id: "colectivo-prueba", organizer_name: "Colectivo de prueba", verification_status: "fuente_oficial",
        verified_at: null, last_checked_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
        location: { municipality_code: "35016", municipality_name: "Las Palmas", province_id: "PR-35", latitude: 28.1, longitude: -15.43, precision: "via" },
        source: { name: "Web", url: "https://example.org/a", type: "web_organizacion", retrieved_at: "2026-09-01T00:00:00Z" },
      }),
    );
    const c = await loadCurated(dir);
    expect(c.organizations.map((o) => o.slug)).toEqual(["colectivo-prueba"]);
    expect(c.errors.join()).toMatch(/bad.json.*reservado/);
    expect(c.events[0]).toMatchObject({ organization_id: "org-colectivo-prueba", timezone: "Atlantic/Canary" });
  });
});
