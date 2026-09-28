/**
 * API y formularios contra el repositorio de ficheros (datos DEMO de desarrollo).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { GET as eventsGET } from "@/app/api/events/route";
import { GET as statsGET } from "@/app/api/statistics/route";
import { GET as orgsGET } from "@/app/api/organizations/route";
import { POST as submissionsPOST } from "@/app/api/submissions/route";
import { POST as moderatePOST } from "@/app/api/moderation/submissions/[id]/route";
import { GET as icsGET } from "@/app/api/events/[slug]/ics/route";
import { issueFormToken, resetRateLimits } from "@/lib/antispam";
import { getRepo, setRepoForTests } from "@/server/repo";
import { FileRepo } from "@/server/repo/file";
import { filterEvents } from "@/server/repo/filters";

const req = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init);
const valid = () => ({
  type: "concentracion",
  date: new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10),
  time: "18:00",
  municipality: "Elche",
  province_id: "PR-03",
  organization: "Colectivo de prueba",
  source_url: "https://example.org/convocatoria",
  description: "Concentración de prueba. Contacto 612 345 678.",
  meeting_point: "Plaça de Baix",
  confirm_public: "on",
  form_token: issueFormToken(Date.now() - 10_000),
});
const post = (body: unknown, headers: Record<string, string> = {}) =>
  submissionsPOST(req("/api/submissions", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250)}`, ...headers }, body: JSON.stringify(body) }));

beforeEach(() => {
  resetRateLimits();
  setRepoForTests(new FileRepo());
  process.env.MODERATION_TOKEN = "t0k3n";
});

describe("GET /api/events", () => {
  it("filtra por provincia (slug o id) y valida parámetros", async () => {
    const r = await eventsGET(req("/api/events?province=valencia"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.events.length).toBeGreaterThan(0);
    expect(body.events.every((e: { location: { province_id: string } }) => e.location.province_id === "PR-46")).toBe(true);
    expect((await eventsGET(req("/api/events?province=atlantida"))).status).toBe(400);
    expect((await eventsGET(req("/api/events?type=fiesta"))).status).toBe(400);
    expect((await eventsGET(req("/api/events?from=ayer"))).status).toBe(400);
  });
  it("busca por radio sin cachear la respuesta", async () => {
    const r = await eventsGET(req("/api/events?lat=39.47&lon=-0.38&radius=10"));
    expect(r.headers.get("cache-control")).toBe("no-store");
    const { events } = await r.json();
    expect(events.every((e: { distance_km: number }) => e.distance_km <= 10)).toBe(true);
    expect((await eventsGET(req("/api/events?lat=39.47&lon=-0.38&radius=7"))).status).toBe(400);
  });
  it("nunca expone el punto exacto de convocatorias pendientes", async () => {
    const { events } = await (await eventsGET(req("/api/events"))).json();
    for (const e of events.filter((x: { verification_status: string }) => x.verification_status === "pendiente")) {
      expect(["barrio", "municipio"]).toContain(e.location.precision);
      expect(e.location.meeting_point).toBeNull();
    }
  });
  it("las respuestas públicas son cacheables", async () => {
    const r = await eventsGET(req("/api/events"));
    expect(r.headers.get("cache-control")).toMatch(/s-maxage/);
  });
});

describe("GET /api/statistics y /api/organizations", () => {
  it("devuelve choropleth y serie con su dataset", async () => {
    const c = await (await statsGET(req("/api/statistics?view=choropleth&level=ccaa"))).json();
    expect(c.choropleth.data).toHaveLength(19);
    expect(c.choropleth.dataset.id).toBeTruthy();
    const s = await (await statsGET(req("/api/statistics?view=series&territory=alicante"))).json();
    expect(s.territory).toBe("PR-03");
    expect(s.series.length).toBeGreaterThan(0);
    expect((await statsGET(req("/api/statistics?period=2024-13"))).status).toBe(400);
  });
  it("adjunta la fuente de cada organización", async () => {
    const { organizations } = await (await orgsGET(req("/api/organizations?territory=madrid"))).json();
    expect(organizations.every((o: { source: unknown; territory_id: string }) => o.source && o.territory_id === "PR-28")).toBe(true);
  });
});

describe("POST /api/submissions", () => {
  it("acepta un aviso válido, lo deja en 'submitted' y retira el teléfono", async () => {
    const r = await post(valid());
    expect(r.status).toBe(201);
    const { id, privacy_flags } = await r.json();
    expect(privacy_flags).toContain("telefono");
    const sub = await (await getRepo()).getSubmission(id);
    expect(sub?.status).toBe("submitted");
    expect(sub?.payload.description).not.toContain("612");
    expect(sub?.client_hash).toMatch(/^[a-f0-9]{24}$/);
    // Nunca aparece publicado automáticamente
    const events = await (await getRepo()).listEvents();
    expect(events.some((e) => e.organizer_name === "Colectivo de prueba")).toBe(false);
  });
  it("rechaza el campo trampa, envíos demasiado rápidos y sin confirmación", async () => {
    expect((await post({ ...valid(), website: "http://spam" })).status).toBe(400);
    expect((await post({ ...valid(), form_token: issueFormToken(Date.now()) })).status).toBe(400);
    const { confirm_public: _c, ...noConfirm } = valid();
    void _c;
    const r = await post(noConfirm);
    expect(r.status).toBe(400);
    expect((await r.json()).issues.some((i: { path: string }) => i.path === "confirm_public")).toBe(true);
  });
  it("rechaza URLs no http y fechas pasadas", async () => {
    expect((await post({ ...valid(), source_url: "javascript:alert(1)" })).status).toBe(400);
    expect((await post({ ...valid(), date: "2020-01-01" })).status).toBe(400);
  });
  it("limita la frecuencia por cliente", async () => {
    const h = { "x-forwarded-for": "203.0.113.99" };
    const codes = [];
    for (let i = 0; i < 7; i++) codes.push((await post(valid(), h)).status);
    expect(codes.filter((c) => c === 201).length).toBe(5);
    expect(codes).toContain(429);
  });
  it("funciona sin JavaScript (formulario clásico → redirección)", async () => {
    const fd = new URLSearchParams(Object.entries(valid()).map(([k, v]) => [k, String(v)]));
    const r = await submissionsPOST(req("/api/submissions", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "192.0.2.1" }, body: fd }));
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toMatch(/\/avisa\/gracias$/);
  });
});

describe("moderación de envíos", () => {
  const mod = (id: string, body: unknown, headers: Record<string, string> = { authorization: "Bearer t0k3n" }) =>
    moderatePOST(req(`/api/moderation/submissions/${id}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

  it("exige autenticación y recorre el flujo completo hasta publicar", async () => {
    const { id } = await (await post(valid())).json();
    expect((await mod(id, { action: "start_review" }, {})).status).toBe(401);
    expect((await mod(id, { action: "publish", verification_status: "verificada" })).status).toBe(409);
    expect((await mod(id, { action: "start_review" })).status).toBe(200);
    expect((await mod(id, { action: "verify", note: "Confirmado con la organización" })).status).toBe(200);
    expect((await mod(id, { action: "publish" })).status).toBe(400); // falta estado de verificación
    const r = await mod(id, { action: "publish", verification_status: "fuente_oficial" });
    expect(r.status).toBe(200);
    const repo = await getRepo();
    const sub = await repo.getSubmission(id);
    expect(sub?.status).toBe("published");
    const ev = await repo.getEventById(sub!.event_id!);
    expect(ev?.location.precision).toBe("municipio"); // sin coordenadas: nunca más precisión de la conocida
    expect(ev?.location.municipality_code).toBe("03065");
    const log = await repo.listLog(id);
    expect(log.map((l) => l.action).reverse()).toEqual(["submit", "start_review", "verify", "publish"]);
    // El calendario funciona para la convocatoria publicada
    const ics = await icsGET(req(`/api/events/${ev!.slug}/ics`), { params: Promise.resolve({ slug: ev!.slug }) });
    expect(ics.headers.get("content-type")).toMatch(/text\/calendar/);
  });
  it("no publica con ubicación exacta una convocatoria pendiente", async () => {
    const { id } = await (await post(valid())).json();
    await mod(id, { action: "start_review" });
    await mod(id, { action: "verify" });
    const r = await mod(id, { action: "publish", verification_status: "pendiente", latitude: 38.26, longitude: -0.7, precision: "exacta" });
    expect(r.status).toBe(400);
  });
  it("exige motivo para rechazar", async () => {
    const { id } = await (await post(valid())).json();
    expect((await mod(id, { action: "reject" })).status).toBe(400);
    expect((await mod(id, { action: "reject", note: "No es una convocatoria pública" })).status).toBe(200);
  });
  it("con cookie de sesión exige el mismo origen (CSRF)", async () => {
    const { sessionValue, MOD_COOKIE } = await import("@/server/http");
    const cookie = `${MOD_COOKIE}=${sessionValue("t0k3n")}`;
    const { id } = await (await post(valid())).json();
    expect((await mod(id, { action: "start_review" }, { cookie, host: "localhost", origin: "https://evil.example" })).status).toBe(401);
    expect((await mod(id, { action: "start_review" }, { cookie, host: "localhost", origin: "http://localhost" })).status).toBe(200);
  });
});

describe("filtros", () => {
  it("filtra por CCAA, municipio (sin acentos), tipo y fechas", async () => {
    const all = await (await getRepo()).listEvents();
    expect(filterEvents(all, { territory: "CA-10" }).every((e) => ["PR-03", "PR-12", "PR-46"].includes(e.location.province_id))).toBe(true);
    expect(filterEvents(all, { municipality: "valencia", includeDemo: true }).length).toBeGreaterThan(0);
    expect(filterEvents(all, { types: ["asesoria"] }).every((e) => e.type === "asesoria")).toBe(true);
    const f = filterEvents(all, { from: "2099-01-01" });
    expect(f).toHaveLength(0);
  });
});
