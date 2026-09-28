import { describe, expect, it } from "vitest";
import { nextStatus, eventFromSubmission, ModerationError, slugify } from "@/lib/moderation";
import { checkFormToken, issueFormToken, rateLimit, resetRateLimits, clientHash } from "@/lib/antispam";
import { buildIcs } from "@/lib/ics";
import type { Submission } from "@/lib/schema";

const sub: Submission = {
  id: "11111111-2222-3333-4444-555555555555", status: "verified",
  payload: { type: "concentracion", date: "2026-10-10", time: "11:00", municipality: "Las Palmas de Gran Canaria", province_id: "PR-35", organization: "Colectivo Y", source_url: "https://example.org/post", description: "Concentración por la vivienda", meeting_point: "Plaza X", comments: null },
  privacy_flags: [], client_hash: "h", event_id: null, created_at: "2026-09-28T08:00:00.000Z", updated_at: "2026-09-28T08:00:00.000Z",
};

describe("moderación", () => {
  it("sigue submitted → pending_review → verified → published", () => {
    expect(nextStatus("submitted", "start_review")).toBe("pending_review");
    expect(nextStatus("pending_review", "verify")).toBe("verified");
    expect(nextStatus("verified", "publish")).toBe("published");
  });
  it("no permite publicar sin verificar ni saltarse pasos", () => {
    expect(() => nextStatus("submitted", "publish")).toThrow(ModerationError);
    expect(() => nextStatus("pending_review", "publish")).toThrow(ModerationError);
    expect(() => nextStatus("published", "reject")).toThrow(ModerationError);
    expect(() => nextStatus("rejected", "start_review")).toThrow(ModerationError);
  });
  it("crea el evento con zona horaria canaria y trazabilidad", () => {
    const e = eventFromSubmission(sub, { eventId: "abcdef123456", sourceId: "src", verification_status: "fuente_oficial", precision: "via", latitude: 28.1, longitude: -15.4, municipality_code: "35016", organization_id: null, now: new Date("2026-09-29T00:00:00Z") });
    expect(e.timezone).toBe("Atlantic/Canary");
    expect(e.submitted_at).toBe(sub.created_at);
    expect(e.verified_at).toBe("2026-09-29T00:00:00.000Z");
    expect(e.slug).toMatch(/^colectivo-y-las-palmas-de-gran-canaria-2026-10-10-abcdef$/);
    expect(() => eventFromSubmission({ ...sub, status: "pending_review" }, { eventId: "x", sourceId: "s", verification_status: "pendiente", precision: "municipio", latitude: 1, longitude: 1, municipality_code: null, organization_id: null, now: new Date() })).toThrow();
  });
  it("slugify quita acentos y símbolos", () => {
    expect(slugify("Sindicat d'Habitatge · Sants!")).toBe("sindicat-d-habitatge-sants");
  });
});

describe("anti-spam", () => {
  it("valida el sello temporal firmado", () => {
    const t = issueFormToken(1_000_000);
    expect(checkFormToken(t, 1_000_500)).toEqual({ ok: false, reason: "too_fast" });
    expect(checkFormToken(t, 1_010_000)).toEqual({ ok: true });
    expect(checkFormToken(t, 1_000_000 + 3 * 3600_000)).toEqual({ ok: false, reason: "expired" });
    expect(checkFormToken(t.replace(/.$/, "x"), 1_010_000).ok).toBe(false);
    expect(checkFormToken("basura", 1_010_000)).toEqual({ ok: false, reason: "malformed" });
  });
  it("limita la frecuencia por cliente", () => {
    resetRateLimits();
    const rule = { limit: 2, windowMs: 1000 };
    expect(rateLimit("k", rule, 0).allowed).toBe(true);
    expect(rateLimit("k", rule, 10).allowed).toBe(true);
    expect(rateLimit("k", rule, 20).allowed).toBe(false);
    expect(rateLimit("k", rule, 1500).allowed).toBe(true);
  });
  it("el hash de cliente rota cada día y no contiene la IP", () => {
    const a = clientHash("203.0.113.7", new Date("2026-09-28T10:00:00Z"));
    const b = clientHash("203.0.113.7", new Date("2026-09-29T10:00:00Z"));
    expect(a).not.toBe(b);
    expect(a).not.toContain("203");
  });
});

describe("iCalendar", () => {
  it("genera un VEVENT válido con hora UTC y escapado", () => {
    const e = eventFromSubmission(sub, { eventId: "abcdef123456", sourceId: "src", verification_status: "verificada", precision: "via", latitude: 28.1, longitude: -15.4, municipality_code: null, organization_id: null, now: new Date("2026-09-29T00:00:00Z") });
    const ics = buildIcs({ ...e, title: "Concentración; vivienda, ya" }, { latitude: 28.1, longitude: -15.4, precision: "via", meeting_point: "Plaza X", neighborhood: null, municipality_name: "Las Palmas", province_id: "PR-35", precision_note: null }, { url: "https://x/c", sourceUrl: "https://example.org/post", now: new Date("2026-09-29T00:00:00Z") });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20261010T100000Z"); // 11:00 en Canarias = 10:00 UTC
    expect(ics).toContain("SUMMARY:Concentración\\; vivienda\\, ya");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});
