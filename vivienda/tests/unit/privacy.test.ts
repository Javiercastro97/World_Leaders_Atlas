import { describe, expect, it } from "vitest";
import { publicLocation, scrubPersonalData, maxAllowedPrecision } from "@/lib/privacy";
import type { HousingEvent } from "@/lib/schema";

const NOW = new Date("2026-09-28T08:00:00Z");

function ev(p: Partial<HousingEvent> & { loc?: Partial<HousingEvent["location"]> } = {}): HousingEvent {
  const { loc, ...rest } = p;
  return {
    id: "e1", slug: "e1", type: "desahucio", title: "Prueba", description: "", date: "2026-09-28", time: "12:00", end_time: null,
    timezone: "Europe/Madrid", status: "programada", organization_id: null, organizer_name: "Colectivo X",
    location: {
      id: "l1", municipality_code: "03014", municipality_name: "Alicante", province_id: "PR-03", neighborhood: "Carolinas",
      public_meeting_point: "Portal publicado por la organización", latitude: 38.3561, longitude: -0.4812, precision: "exacta",
      neighborhood_latitude: 38.357, neighborhood_longitude: -0.482, ...loc,
    },
    source_id: "s", verification_status: "fuente_oficial", submitted_at: null, verified_at: null,
    last_checked_at: NOW.toISOString(), demo: false, created_at: NOW.toISOString(), updated_at: NOW.toISOString(), ...rest,
  };
}

const centroid = (code: string) => (code === "03014" ? { lat: 38.3699, lon: -0.5471 } : null);

describe("precisión geográfica", () => {
  it("muestra el punto exacto solo en convocatorias activas de fuente oficial o verificadas", () => {
    const l = publicLocation(ev(), NOW, centroid);
    expect(l.precision).toBe("exacta");
    expect(l.latitude).toBe(38.3561);
    expect(l.meeting_point).toBe("Portal publicado por la organización");
  });
  it("las pendientes de verificación nunca pasan de barrio", () => {
    const l = publicLocation(ev({ verification_status: "pendiente" }), NOW, centroid);
    expect(l.precision).toBe("barrio");
    expect(l.latitude).toBe(38.357);
    expect(l.meeting_point).toBeNull();
    expect(l.precision_note).toMatch(/hasta verificar/);
  });
  it("degrada el histórico tras la convocatoria", () => {
    const past = ev({ date: "2026-09-20" });
    const l = publicLocation(past, NOW, centroid);
    expect(l.precision).toBe("barrio");
    expect(l.meeting_point).toBeNull();
    expect(l.precision_note).toMatch(/finalizada/);
  });
  it("sin centroide de barrio cae a municipio", () => {
    const l = publicLocation(ev({ status: "realizada", loc: { neighborhood_latitude: null, neighborhood_longitude: null } }), NOW, centroid);
    expect(l.precision).toBe("municipio");
    expect(l).toMatchObject({ latitude: 38.3699, longitude: -0.5471 });
  });
  it("sin centroide municipal redondea a ~1 km", () => {
    const l = publicLocation(ev({ status: "cancelada", loc: { municipality_code: null, neighborhood_latitude: null, neighborhood_longitude: null } }), NOW);
    expect(l).toMatchObject({ precision: "municipio", latitude: 38.36, longitude: -0.48 });
  });
  it("canceladas y suspendidas también se degradan", () => {
    expect(maxAllowedPrecision(ev({ status: "suspendida" }), NOW)).toBe("barrio");
    expect(maxAllowedPrecision(ev({ status: "cancelada" }), NOW)).toBe("barrio");
  });
});

describe("retirada de datos personales", () => {
  it("retira teléfonos, DNI, NIE, IBAN y emails", () => {
    const r = scrubPersonalData("Llamad a Ana al 612 345 678 o +34 912345678. DNI 12345678Z, NIE X1234567L, ES91 2100 0418 4502 0005 1332, ana@correo.es");
    expect(r.clean).not.toMatch(/612|912345678|12345678Z|X1234567L|2100|ana@/);
    expect(r.flags.sort()).toEqual(["dni_nie", "email", "iban", "telefono"]);
  });
  it("marca posibles domicilios y datos personales sin borrar el texto", () => {
    const r = scrubPersonalData("Concentración en el portal, 3º B, la familia de María tiene dos menores");
    expect(r.flags).toContain("posible_domicilio");
    expect(r.flags).toContain("posible_dato_personal");
  });
  it("no toca textos limpios ni horas o fechas", () => {
    const r = scrubPersonalData("Concentración a las 09:00 del 12/10/2026 en la plaza del Ayuntamiento");
    expect(r.flags).toEqual([]);
    expect(r.clean).toBe("Concentración a las 09:00 del 12/10/2026 en la plaza del Ayuntamiento");
  });
});
