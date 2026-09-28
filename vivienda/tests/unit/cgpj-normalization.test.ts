/**
 * Normalización de cubos CGPJ. Los cubos de prueba son SINTÉTICOS: imitan la estructura
 * (TSJ + provincias, trimestres, tipo de procedimiento) con cifras inventadas.
 */
import { describe, expect, it } from "vitest";
import { parseJsonStat, type JsonStatDataset } from "@/data-sources/jsonstat";
import { parsePx } from "@/data-sources/px";
import { classifyTerritories, deriveAggregates, detectRoles, mapCube, parsePeriod, classifyProcedure } from "@/data-sources/cube-mapping";
import { PROVINCES } from "@/lib/territories";
import type { Statistic } from "@/lib/schema";

const META = { snapshotId: "test", retrievedAt: "2026-01-01T00:00:00.000Z" };

function cube(territories: string[], periods: string[], procedures: string[], value: (t: number, p: number, k: number) => number | null): JsonStatDataset {
  const ids = ["TSJ_PROV", "PERIODO", "TIPO"];
  const values: (number | null)[] = [];
  territories.forEach((_, t) => periods.forEach((_, p) => procedures.forEach((_, k) => values.push(value(t, p, k)))));
  const cat = (labels: string[]) => ({ index: labels.map((_, i) => String(i)), label: Object.fromEntries(labels.map((l, i) => [String(i), l])) });
  return {
    version: "2.0",
    class: "dataset",
    label: "LANZAMIENTOS PRACTICADOS (sintético)",
    updated: "2026-03-15T10:00:00Z",
    id: ids,
    size: [territories.length, periods.length, procedures.length],
    role: { time: ["PERIODO"] },
    dimension: {
      TSJ_PROV: { label: "TSJ/Provincia", category: cat(territories) },
      PERIODO: { label: "Periodo", category: cat(periods) },
      TIPO: { label: "Tipo de lanzamiento", category: cat(procedures) },
    },
    value: values,
  };
}

describe("parsePeriod", () => {
  it.each([
    ["2024", "2024"],
    ["2024T1", "2024-Q1"],
    ["2024-T3", "2024-Q3"],
    ["T2 2024", "2024-Q2"],
    ["1er trimestre 2024", "2024-Q1"],
    ["Primer trimestre de 2024", "2024-Q1"],
    ["cuarto trimestre 2019", "2019-Q4"],
    ["2023Q4", "2023-Q4"],
    ["4º T 2022", "2022-Q4"],
  ])("%s → %s", (label, expected) => {
    expect(parsePeriod(label)?.period).toBe(expected);
  });

  it("no adivina trimestres ambiguos ni textos sin año", () => {
    expect(parsePeriod("trimestre 2024")).toBeNull();
    expect(parsePeriod("Total")).toBeNull();
  });
});

describe("classifyProcedure", () => {
  it("reconoce los tipos del CGPJ", () => {
    expect(classifyProcedure("Lanzamientos consecuencia de ejecuciones hipotecarias")).toBe("ejecucion_hipotecaria");
    expect(classifyProcedure("Lanzamientos consecuencia de L.A.U.")).toBe("arrendamientos_urbanos");
    expect(classifyProcedure("Lanzamientos derivados de Ley de Arrendamientos Urbanos")).toBe("arrendamientos_urbanos");
    expect(classifyProcedure("Otros lanzamientos")).toBe("otros");
    expect(classifyProcedure("Total lanzamientos")).toBe("total");
  });
});

describe("classifyTerritories", () => {
  it("distingue TSJ y provincia cuando la etiqueta se repite (uniprovinciales)", () => {
    const m = classifyTerritories([
      { code: "0", label: "TOTAL NACIONAL" },
      { code: "1", label: "ANDALUCÍA" },
      { code: "2", label: "ALMERÍA" },
      { code: "3", label: "MADRID" },
      { code: "4", label: "MADRID" },
      { code: "5", label: "PAÍS VASCO" },
      { code: "6", label: "ÁLAVA" },
      { code: "7", label: "Partido judicial de Elche" },
    ]);
    expect(m.get("0")).toEqual({ level: "country", code: "ES" });
    expect(m.get("1")).toEqual({ level: "tsj", code: "CA-01" });
    expect(m.get("2")).toEqual({ level: "province", code: "PR-04" });
    expect(m.get("3")).toEqual({ level: "tsj", code: "CA-13" });
    expect(m.get("4")).toEqual({ level: "province", code: "PR-28" });
    expect(m.get("5")).toEqual({ level: "tsj", code: "CA-16" });
    expect(m.get("6")).toEqual({ level: "province", code: "PR-01" });
    expect(m.get("7")).toBeNull(); // niveles inferiores se ignoran: no se suman dos veces
  });

  it("acepta prefijos numéricos y exónimos", () => {
    const m = classifyTerritories([
      { code: "a", label: "03 Alicante/Alacant" },
      { code: "b", label: "Gerona" },
      { code: "c", label: "Vizcaya" },
      { code: "d", label: "TSJ C. Valenciana" },
    ]);
    expect(m.get("a")).toEqual({ level: "province", code: "PR-03" });
    expect(m.get("b")).toEqual({ level: "province", code: "PR-17" });
    expect(m.get("c")).toEqual({ level: "province", code: "PR-48" });
    expect(m.get("d")).toEqual({ level: "tsj", code: "CA-10" });
  });
});

describe("mapCube (JSON-stat)", () => {
  const territories = ["TOTAL NACIONAL", "C. VALENCIANA", "ALICANTE", "CASTELLÓN", "VALENCIA"];
  const periods = ["2024T1", "2024T2", "2024T3", "2024T4"];
  const procedures = ["Total", "Ejecución hipotecaria", "L.A.U.", "Otros"];
  const ds = cube(territories, periods, procedures, (t, p, k) => (k === 0 ? 100 + t * 10 + p : 10 + k));

  it("detecta roles de las dimensiones", () => {
    const roles = detectRoles(parseJsonStat(ds), { datasetId: "x", sourceId: "s", metric: "lanzamientos_practicados" });
    expect(roles).toEqual({ TSJ_PROV: "territory", PERIODO: "period", TIPO: "procedure" });
  });

  it("produce filas con procedencia completa", () => {
    const { rows, report } = mapCube(parseJsonStat(ds), { datasetId: "cgpj-test", sourceId: "cgpj", metric: "lanzamientos_practicados" }, META);
    expect(report.unmatchedTerritories).toEqual([]);
    const alicante = rows.find((r) => r.territory_code === "PR-03" && r.period === "2024-Q2" && r.procedure_type === "total");
    expect(alicante).toMatchObject({
      value: 121,
      period_type: "quarter",
      territory_type: "province",
      metric: "lanzamientos_practicados",
      source_id: "cgpj",
      dataset_id: "cgpj-test",
      snapshot_id: "test",
      retrieved_at: META.retrievedAt,
      derivation: "reported",
    });
    const tsj = rows.find((r) => r.territory_type === "tsj" && r.period === "2024-Q1" && r.procedure_type === "total");
    expect(tsj?.territory_code).toBe("CA-10");
    expect(rows.filter((r) => r.procedure_type === "arrendamientos_urbanos")).toHaveLength(territories.length * periods.length);
  });

  it("ignora celdas nulas (dato no disponible) en lugar de convertirlas en cero", () => {
    const withNull = cube(["ALICANTE"], ["2024T1"], ["Total"], () => null);
    const { rows } = mapCube(parseJsonStat(withNull), { datasetId: "d", sourceId: "s", metric: "lanzamientos_practicados" }, META);
    expect(rows).toHaveLength(0);
  });

  it("falla de forma explícita si no hay dimensión temporal", () => {
    const bad: JsonStatDataset = { ...cube(["ALICANTE"], ["x"], ["Total"], () => 1) };
    bad.role = {};
    bad.dimension.PERIODO.label = "Cosa";
    bad.dimension.PERIODO.category.label = { "0": "sin fecha" };
    expect(() => mapCube(parseJsonStat(bad), { datasetId: "d", sourceId: "s", metric: "lanzamientos_practicados" }, META)).toThrow(/temporal/);
  });
});

describe("deriveAggregates", () => {
  const base = (patch: Partial<Statistic>): Statistic => ({
    id: "x",
    period: "2024-Q1",
    period_type: "quarter",
    territory_type: "province",
    territory_code: "PR-03",
    metric: "lanzamientos_practicados",
    procedure_type: "total",
    value: 1,
    derivation: "reported",
    source_id: "s",
    dataset_id: "d",
    snapshot_id: "t",
    retrieved_at: META.retrievedAt,
    demo: false,
    ...patch,
  });

  it("suma trimestres a año solo con los 4 trimestres", () => {
    const four = [1, 2, 3, 4].map((q) => base({ period: `2024-Q${q}`, value: q * 10 }));
    const three = [1, 2, 3].map((q) => base({ period: `2023-Q${q}`, value: 5 }));
    const { rows } = deriveAggregates([...four, ...three]);
    expect(rows.find((r) => r.period === "2024" && r.territory_code === "PR-03")).toMatchObject({ value: 100, derivation: "derived", period_type: "year" });
    expect(rows.find((r) => r.period === "2023")).toBeUndefined();
  });

  it("deriva CCAA y España solo si están todas sus provincias", () => {
    const cv = ["PR-03", "PR-12", "PR-46"].map((id, i) => base({ territory_code: id, value: (i + 1) * 100 }));
    const { rows } = deriveAggregates(cv);
    expect(rows.find((r) => r.territory_code === "CA-10")).toMatchObject({ value: 600, territory_type: "ccaa", derivation: "derived" });
    expect(rows.find((r) => r.territory_code === "ES")).toBeUndefined();

    const all = PROVINCES.map((p) => base({ territory_code: p.id, value: 2 }));
    const r2 = deriveAggregates(all).rows;
    expect(r2.find((r) => r.territory_code === "ES")?.value).toBe(104);
    // Ceuta y Melilla son CCAA uniprovinciales: su agregado es su propia provincia
    expect(r2.find((r) => r.territory_code === "CA-18")?.value).toBe(2);
  });

  it("nunca sobrescribe un total reportado y avisa si no cuadra", () => {
    const cv = ["PR-03", "PR-12", "PR-46"].map((id) => base({ territory_code: id, value: 100 }));
    const reported = base({ territory_type: "ccaa", territory_code: "CA-10", value: 290 });
    const { rows, warnings } = deriveAggregates([...cv, reported]);
    expect(rows.find((r) => r.territory_code === "CA-10")).toMatchObject({ value: 290, derivation: "reported" });
    expect(warnings[0]).toMatch(/CA-10.*reportado=290 suma=300/);
  });
});

describe("parsePx (PC-Axis)", () => {
  const px = `CHARSET="ANSI";
AXIS-VERSION="2013";
LANGUAGE="es";
TITLE="LANZAMIENTOS PRACTICADOS por TSJ/Provincia, "
"Periodo y Tipo (sintético)";
CONTENTS="Lanzamientos";
LAST-UPDATED="20260315 10:00";
STUB="TSJ/Provincia";
HEADING="Periodo","Tipo";
VALUES("TSJ/Provincia")="ALICANTE","CASTELLÓN";
VALUES("Periodo")="2024T1","2024T2";
VALUES("Tipo")="Total","L.A.U.";
TIMEVAL("Periodo")=TLIST(Q1),"20241","20242";
DATA=
10 7 12 8
3 ".." 4 2;
`;
  it("lee dimensiones, valores ausentes y datos en orden STUB+HEADING", () => {
    const c = parsePx(px);
    expect(c.title).toBe("LANZAMIENTOS PRACTICADOS por TSJ/Provincia, Periodo y Tipo (sintético)");
    expect(c.updated).toBe("20260315 10:00");
    expect(c.variables.map((v) => v.code)).toEqual(["TSJ/Provincia", "Periodo", "Tipo"]);
    expect(c.variables[1].time).toBe(true);
    const at = (t: string, p: string, k: string) =>
      c.cells.find((x) => x.dims["TSJ/Provincia"].label === t && x.dims.Periodo.label === p && x.dims.Tipo.label === k)?.value;
    expect(at("ALICANTE", "2024T2", "Total")).toBe(12);
    expect(at("CASTELLÓN", "2024T1", "L.A.U.")).toBeNull();
    const { rows } = mapCube(c, { datasetId: "px", sourceId: "s", metric: "lanzamientos_practicados" }, META);
    expect(rows.find((r) => r.territory_code === "PR-12" && r.period === "2024-Q2" && r.procedure_type === "arrendamientos_urbanos")?.value).toBe(2);
  });

  it("rechaza ficheros con número de datos incoherente", () => {
    expect(() => parsePx(px.replace("3 \"..\" 4 2", "3 4 2"))).toThrow(/DATA/);
  });
});
