/**
 * DATOS DEMO / FICTICIOS — solo para desarrollo.
 *
 * Nunca se cargan cuando NODE_ENV=production (ver `demoEnabled`). Todo lo que se genera aquí
 * lleva `demo: true`, el prefijo "[DEMO]" en títulos y nombres, y la interfaz lo marca con una
 * banda visible. Ni los colectivos ni las convocatorias ni las cifras corresponden a casos reales.
 */
import type { Dataset, HousingEvent, Organization, Source, Statistic } from "@/lib/schema";
import { PROVINCES } from "@/lib/territories";
import { addDays, localDate } from "@/lib/dates";
import { deriveAggregates } from "@/data-sources/cube-mapping";

export function demoEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.DEMO_DATA !== "0";
}

export const DEMO_SOURCE: Source = {
  id: "demo",
  name: "[DEMO] Datos ficticios de desarrollo",
  url: "https://example.org/demo",
  type: "otro",
  retrieved_at: "2026-01-01T00:00:00.000Z",
  published_at: null,
  notes: "Fixture de desarrollo. No representa ningún dato real.",
};

/** Generador pseudoaleatorio determinista (mulberry32) para que las cifras demo sean estables. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_ORG_ROWS: [slug: string, name: string, type: Organization["type"], prov: string, muni: string, lat: number, lon: number][] = [
  ["demo-sindicato-barrio-norte", "[DEMO] Sindicato de Vivienda Barrio Norte", "sindicato_vivienda", "PR-28", "Madrid", 40.4637, -3.6903],
  ["demo-plataforma-costa", "[DEMO] Plataforma Vecinal de la Costa", "plataforma", "PR-03", "Alacant/Alicante", 38.3452, -0.481],
  ["demo-asamblea-ribera", "[DEMO] Asamblea de Vivienda de la Ribera", "colectivo", "PR-46", "València", 39.4699, -0.3763],
  ["demo-asesoria-llar", "[DEMO] Asesoria Popular Llar", "asesoria", "PR-08", "Barcelona", 41.3874, 2.1686],
  ["demo-avv-sur", "[DEMO] Asociación Vecinal Distrito Sur", "asociacion_vecinal", "PR-41", "Sevilla", 37.3772, -5.9869],
];

export function demoOrganizations(): Organization[] {
  return DEMO_ORG_ROWS.map(([slug, name, type, prov, muni, lat, lon], i) => ({
    id: `demo-org-${i + 1}`,
    slug,
    name,
    description: "Organización FICTICIA creada para probar el directorio. No existe.",
    type,
    territory_id: prov,
    municipality_name: muni,
    scope: "municipal",
    website: "https://example.org/",
    social_links: [],
    public_contact: null,
    latitude: lat,
    longitude: lon,
    source_id: "demo",
    verified: i % 2 === 0,
    demo: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }));
}

/** Convocatorias demo relativas a "hoy" para que la agenda siempre tenga contenido en desarrollo. */
export function demoEvents(now: Date): HousingEvent[] {
  const today = localDate(now, "Europe/Madrid");
  const orgs = demoOrganizations();
  const rows: {
    d: number;
    t: string | null;
    type: HousingEvent["type"];
    org: number;
    ver: HousingEvent["verification_status"];
    status?: HousingEvent["status"];
    prec: HousingEvent["location"]["precision"];
    point: string | null;
    hood: string | null;
    dx: number;
    dy: number;
  }[] = [
    { d: 0, t: "09:00", type: "desahucio", org: 0, ver: "fuente_oficial", prec: "exacta", point: "[DEMO] Plaza ficticia, frente al portal indicado por la organización", hood: "Barrio Norte", dx: 0.004, dy: 0.002 },
    { d: 0, t: "19:30", type: "asamblea", org: 2, ver: "verificada", prec: "via", point: "[DEMO] Local social de la calle Ejemplo", hood: "Ribera", dx: -0.003, dy: 0.004 },
    { d: 1, t: "11:30", type: "concentracion", org: 2, ver: "pendiente", prec: "exacta", point: "[DEMO] Ayuntamiento", hood: "Centro", dx: 0.001, dy: 0.001 },
    { d: 2, t: "18:00", type: "asesoria", org: 3, ver: "fuente_oficial", prec: "via", point: "[DEMO] Centro cívico de ejemplo", hood: "Eixample", dx: 0.002, dy: -0.002 },
    { d: 4, t: "12:00", type: "manifestacion", org: 1, ver: "verificada", prec: "exacta", point: "[DEMO] Salida desde la plaza principal", hood: "Centro", dx: 0, dy: 0 },
    { d: 5, t: "10:00", type: "desahucio", org: 4, ver: "fuente_oficial", status: "suspendida", prec: "exacta", point: "[DEMO] Punto de encuentro ficticio", hood: "Distrito Sur", dx: -0.01, dy: -0.02 },
    { d: 9, t: "19:00", type: "charla", org: 0, ver: "verificada", prec: "via", point: "[DEMO] Biblioteca de ejemplo", hood: "Barrio Norte", dx: 0.006, dy: 0.001 },
    { d: 16, t: null, type: "accion", org: 3, ver: "pendiente", prec: "barrio", point: null, hood: "Sants", dx: -0.02, dy: -0.004 },
    { d: -3, t: "09:30", type: "desahucio", org: 1, ver: "fuente_oficial", status: "realizada", prec: "exacta", point: "[DEMO] Portal ficticio ya no visible", hood: "Carolinas", dx: 0.01, dy: 0.01 },
  ];
  return rows.map((r, i) => {
    const o = orgs[r.org];
    const lat = o.latitude! + r.dy;
    const lon = o.longitude! + r.dx;
    const date = addDays(today, r.d);
    const id = `demo-evt-${i + 1}`;
    const created = new Date(now.getTime() - (i + 2) * 3600_000 * 7).toISOString();
    return {
      id,
      slug: `demo-${r.type}-${i + 1}`,
      type: r.type,
      title: `[DEMO] ${labelFor(r.type)} en ${o.municipality_name?.split("/").pop()}`,
      description: "Convocatoria FICTICIA para desarrollo. No acudas: no existe.",
      date,
      time: r.t,
      end_time: null,
      timezone: "Europe/Madrid",
      status: r.status ?? (r.d < 0 ? "realizada" : "programada"),
      organization_id: o.id,
      organizer_name: o.name,
      location: {
        id: `loc-${id}`,
        municipality_code: null,
        municipality_name: o.municipality_name,
        province_id: o.territory_id,
        neighborhood: r.hood,
        public_meeting_point: r.point,
        latitude: lat,
        longitude: lon,
        precision: r.prec,
        neighborhood_latitude: o.latitude! + r.dy / 3,
        neighborhood_longitude: o.longitude! + r.dx / 3,
      },
      source_id: "demo",
      verification_status: r.ver,
      submitted_at: null,
      verified_at: r.ver === "pendiente" ? null : created,
      last_checked_at: created,
      demo: true,
      created_at: created,
      updated_at: created,
    };
  });
}

function labelFor(t: HousingEvent["type"]) {
  return (
    {
      desahucio: "Parada de desahucio",
      concentracion: "Concentración",
      manifestacion: "Manifestación",
      asamblea: "Asamblea abierta",
      asesoria: "Asesoría colectiva",
      accion: "Acción",
      charla: "Charla",
      otro: "Encuentro",
    } as const
  )[t];
}

export const DEMO_DATASET: Dataset = {
  id: "demo-lanzamientos",
  source_id: "demo",
  title: "[DEMO] Serie ficticia de lanzamientos",
  url: "https://example.org/demo",
  methodology: "Cifras FICTICIAS generadas aleatoriamente para probar visualizaciones. No usar.",
  limitations: ["Datos inventados para desarrollo: no tienen relación con la realidad."],
  territorial_levels: ["country", "ccaa", "province"],
  period_types: ["year", "quarter"],
  first_period: "2013-Q1",
  last_period: "2025-Q4",
  source_updated_at: null,
  retrieved_at: "2026-01-01T00:00:00.000Z",
  demo: true,
};

export const DEMO_POP_DATASET: Dataset = {
  ...DEMO_DATASET,
  id: "demo-poblacion",
  title: "[DEMO] Población ficticia",
  territorial_levels: ["country", "ccaa", "province"],
  period_types: ["year"],
  first_period: "2013",
  last_period: "2025",
};

let cachedStats: Statistic[] | null = null;

export function demoStatistics(): Statistic[] {
  if (cachedStats) return cachedStats;
  const rand = rng(20260101);
  const rows: Statistic[] = [];
  const base = (id: string, patch: Partial<Statistic>): Statistic => ({
    id,
    period: "2013",
    period_type: "year",
    territory_type: "province",
    territory_code: "PR-01",
    metric: "lanzamientos_practicados",
    procedure_type: "total",
    value: 0,
    derivation: "reported",
    source_id: "demo",
    dataset_id: "demo-lanzamientos",
    snapshot_id: "demo",
    retrieved_at: "2026-01-01T00:00:00.000Z",
    demo: true,
    ...patch,
  });
  for (const p of PROVINCES) {
    const size = 20 + rand() * 600;
    const pop = Math.round(size * 2500 + rand() * 200_000);
    for (let y = 2013; y <= 2025; y++) {
      rows.push(base(`demo-poblacion:poblacion:total:${p.id}:${y}`, { dataset_id: "demo-poblacion", metric: "poblacion", period: String(y), territory_code: p.id, value: pop }));
      const trend = y === 2020 ? 0.55 : 1 - (y - 2013) * 0.035;
      for (let q = 1; q <= 4; q++) {
        const period = `${y}-Q${q}`;
        const lau = Math.round(size * trend * (0.6 + rand() * 0.2) * (q === 3 ? 0.8 : 1));
        const hip = Math.round(size * trend * (y < 2017 ? 0.35 : 0.18) * (0.8 + rand() * 0.4));
        const otr = Math.round(size * 0.05 * (0.5 + rand()));
        const common = { period, period_type: "quarter" as const, territory_code: p.id };
        rows.push(base(`demo:lau:${p.id}:${period}`, { ...common, procedure_type: "arrendamientos_urbanos", value: lau }));
        rows.push(base(`demo:hip:${p.id}:${period}`, { ...common, procedure_type: "ejecucion_hipotecaria", value: hip }));
        rows.push(base(`demo:otr:${p.id}:${period}`, { ...common, procedure_type: "otros", value: otr }));
        rows.push(base(`demo:tot:${p.id}:${period}`, { ...common, procedure_type: "total", value: lau + hip + otr }));
      }
    }
  }
  cachedStats = deriveAggregates(rows).rows.map((r) => ({ ...r, demo: true }));
  return cachedStats;
}
