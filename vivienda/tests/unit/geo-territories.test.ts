import { describe, expect, it } from "vitest";
import { distanceKm, coarsen, searchMunicipios, type MunicipioRow } from "@/lib/geo";
import { matchTerritory, provinceFromPostalCode, PROVINCES, CCAA, getProvinceBySlug, RESERVED_TERRITORY_SLUGS } from "@/lib/territories";
import { OrganizationSchema } from "@/lib/schema";
import muni from "../../public/geo/municipios.json";

describe("geo", () => {
  it("calcula distancias (Madrid–Barcelona ≈ 505 km)", () => {
    expect(distanceKm(40.4168, -3.7038, 41.3874, 2.1686)).toBeGreaterThan(500);
    expect(distanceKm(40.4168, -3.7038, 41.3874, 2.1686)).toBeLessThan(510);
  });
  it("redondea la posición del usuario a ~1 km", () => {
    expect(coarsen(40.416812, -3.703812)).toEqual({ lat: 40.42, lon: -3.7 });
  });
  it("busca municipios sin acentos y con nombres bilingües", () => {
    const rows = muni as MunicipioRow[];
    expect(rows.length).toBeGreaterThan(8000);
    expect(searchMunicipios(rows, "elx")[0].ine).toBe("03065");
    expect(searchMunicipios(rows, "alicante")[0].ine).toBe("03014");
    expect(searchMunicipios(rows, "a coruna")[0].ine).toBe("15030");
  });
});

describe("territorios", () => {
  it("tiene 52 provincias y 19 CCAA con slugs únicos", () => {
    expect(PROVINCES).toHaveLength(52);
    expect(CCAA).toHaveLength(19);
    expect(new Set([...PROVINCES, ...CCAA].map((t) => t.slug)).size).toBe(71);
    expect(getProvinceBySlug("alicante")?.id).toBe("PR-03");
    expect(getProvinceBySlug("madrid")?.id).toBe("PR-28");
  });
  it("código postal → provincia", () => {
    expect(provinceFromPostalCode("03203")?.id).toBe("PR-03");
    expect(provinceFromPostalCode("28013")?.id).toBe("PR-28");
    expect(provinceFromPostalCode("99999")).toBeNull();
    expect(provinceFromPostalCode("2801")).toBeNull();
  });
  it("Canarias usa hora canaria; Ceuta y Melilla pertenecen al TSJ de Andalucía", () => {
    expect(PROVINCES.find((p) => p.id === "PR-35")?.timezone).toBe("Atlantic/Canary");
    expect(CCAA.find((c) => c.id === "CA-18")?.tsj).toBe("01");
    expect(matchTerritory("Ceuta", "tsj")).toBeNull();
    expect(matchTerritory("Andalucía, Ceuta y Melilla", "tsj")?.id).toBe("CA-01");
  });
  it("una organización no puede ocupar el slug de un territorio", () => {
    expect(RESERVED_TERRITORY_SLUGS.has("madrid")).toBe(true);
    const r = OrganizationSchema.shape.slug.safeParse("madrid");
    expect(r.success).toBe(false);
  });
});
