/**
 * Envíos ciudadanos, reportes y acciones de moderación.
 * Ningún envío se publica sin pasar por submitted → pending_review → verified → published.
 */
import { randomUUID } from "node:crypto";
import {
  ModerationActionSchema,
  ReportInputSchema,
  SubmissionInputSchema,
  type ModerationAction,
  type Submission,
} from "@/lib/schema";
import { checkFormToken } from "@/lib/antispam";
import { scrubPersonalData } from "@/lib/privacy";
import { eventFromSubmission, ModerationError, nextStatus } from "@/lib/moderation";
import { addDays, localDate } from "@/lib/dates";
import { getTerritory } from "@/lib/territories";
import { getRepo } from "./repo";
import type { StoredReport } from "./repo/types";
import { findMunicipio } from "./municipios";

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string; issues?: { path: string; message: string }[] };

const fail = (status: number, error: string, issues?: { path: string; message: string }[]) => ({ ok: false as const, status, error, issues });

export async function createSubmission(body: unknown, clientHash: string, now = new Date()): Promise<Outcome<{ id: string; privacy_flags: string[] }>> {
  const repo = await getRepo();
  if (!repo.writable) return fail(503, "Los envíos están desactivados temporalmente en este despliegue.");

  const parsed = SubmissionInputSchema.safeParse(body);
  if (!parsed.success) {
    // El campo trampa no se explica: un bot no debe saber por qué falla.
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return fail(400, "Envío no válido.");
    return fail(400, "Revisa los campos marcados.", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  const input = parsed.data;
  const token = checkFormToken(input.form_token, now.getTime());
  if (!token.ok) {
    return fail(400, token.reason === "expired" ? "El formulario ha caducado: recarga la página." : "Envío no válido. Recarga la página e inténtalo de nuevo.");
  }
  const today = localDate(now);
  if (input.date < addDays(today, -1)) return fail(400, "La fecha ya ha pasado.", [{ path: "date", message: "fecha pasada" }]);
  if (input.date > addDays(today, 366)) return fail(400, "La fecha es demasiado lejana.", [{ path: "date", message: "más de un año" }]);

  const since = new Date(now.getTime() - 3600_000).toISOString();
  if ((await repo.countSubmissionsSince(clientHash, since)) >= 5) return fail(429, "Has enviado varios avisos seguidos. Inténtalo en una hora.");

  const flags = new Set<string>();
  const scrub = (t: string | null) => {
    const r = scrubPersonalData(t);
    r.flags.forEach((f) => flags.add(f));
    return t === null ? null : r.clean;
  };
  const sub: Submission = {
    id: randomUUID(),
    status: "submitted",
    payload: {
      type: input.type,
      date: input.date,
      time: input.time,
      municipality: input.municipality,
      province_id: input.province_id,
      organization: input.organization,
      source_url: input.source_url,
      description: scrub(input.description)!,
      meeting_point: scrub(input.meeting_point),
      comments: scrub(input.comments),
    },
    privacy_flags: [...flags],
    client_hash: clientHash,
    event_id: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  await repo.createSubmission(sub);
  await repo.log({ target_type: "submission", target_id: sub.id, action: "submit", from_status: null, to_status: "submitted", note: flags.size ? `avisos: ${[...flags].join(", ")}` : null, moderator: "público", created_at: sub.created_at });
  return { ok: true, value: { id: sub.id, privacy_flags: sub.privacy_flags } };
}

export async function createReport(body: unknown, clientHash: string, now = new Date()): Promise<Outcome<{ id: string }>> {
  const repo = await getRepo();
  if (!repo.writable) return fail(503, "Los reportes están desactivados temporalmente en este despliegue. Escríbenos por el repositorio público.");
  const parsed = ReportInputSchema.safeParse(body);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return fail(400, "Envío no válido.");
    return fail(400, "Revisa los campos marcados.", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  const token = checkFormToken(parsed.data.form_token, now.getTime());
  if (!token.ok) return fail(400, "Envío no válido. Recarga la página e inténtalo de nuevo.");
  const { website: _w, form_token: _t, ...rest } = parsed.data;
  void _w;
  void _t;
  const r: StoredReport = { ...rest, message: scrubPersonalData(rest.message).clean, id: randomUUID(), status: "open", client_hash: clientHash, created_at: now.toISOString(), resolved_at: null };
  await repo.createReport(r);
  await repo.log({ target_type: "report", target_id: r.id, action: "report", from_status: null, to_status: "open", note: `${r.reason} → ${r.target_type}:${r.target_id ?? "-"}`, moderator: "público", created_at: r.created_at });
  return { ok: true, value: { id: r.id } };
}

export async function moderateSubmission(id: string, body: unknown, moderator: string, now = new Date()): Promise<Outcome<Submission>> {
  const repo = await getRepo();
  const parsed = ModerationActionSchema.safeParse(body);
  if (!parsed.success) return fail(400, "Acción no válida", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  const action: ModerationAction = parsed.data;
  const sub = await repo.getSubmission(id);
  if (!sub) return fail(404, "Envío no encontrado");

  let to;
  try {
    to = nextStatus(sub.status, action.action);
  } catch (e) {
    return fail(409, (e as ModerationError).message);
  }
  if (action.action === "reject" && !action.note) return fail(400, "Indica el motivo del rechazo (queda en el registro).");

  let eventId: string | null = sub.event_id;
  if (action.action === "publish") {
    if (!action.verification_status) return fail(400, "Indica el estado de verificación con el que se publica.");
    const prov = getTerritory(sub.payload.province_id);
    const muni = prov ? findMunicipio(sub.payload.municipality, prov.ine) : null;
    const lat = action.latitude ?? muni?.[4];
    const lon = action.longitude ?? muni?.[3];
    if (lat == null || lon == null) return fail(400, "No se encuentra el municipio: indica latitud y longitud del punto público.");
    // Sin coordenadas explícitas solo sabemos el municipio: nunca se finge más precisión.
    const precision = action.latitude != null ? (action.precision ?? "via") : "municipio";
    if (precision === "exacta" && action.verification_status === "pendiente") {
      return fail(400, "Una convocatoria pendiente de verificación no puede publicarse con ubicación exacta.");
    }
    const org = action.organization_slug ? await repo.getOrganization(action.organization_slug) : null;
    eventId = randomUUID();
    const sourceId = `src-sub-${eventId.slice(0, 8)}`;
    const event = eventFromSubmission(
      { ...sub, status: "verified" },
      {
        eventId,
        sourceId,
        verification_status: action.verification_status,
        precision,
        latitude: lat,
        longitude: lon,
        title: action.title,
        municipality_code: muni?.[0] ?? null,
        organization_id: org?.id ?? null,
        now,
      },
    );
    await repo.createEvent(event, {
      id: sourceId,
      name: action.source_name ?? sub.payload.organization,
      url: sub.payload.source_url,
      type: action.source_type ?? "red_social_publica",
      retrieved_at: now.toISOString(),
      published_at: null,
      notes: "Convocatoria recibida por el formulario público y revisada por moderación.",
    });
  }

  const patch: Partial<Submission> = { status: to, event_id: eventId, updated_at: now.toISOString() };
  await repo.updateSubmission(id, patch);
  await repo.log({ target_type: "submission", target_id: id, action: action.action, from_status: sub.status, to_status: to, note: action.note ?? null, moderator, created_at: now.toISOString() });
  if (eventId && action.action === "publish") {
    await repo.log({ target_type: "event", target_id: eventId, action: "publish", from_status: null, to_status: action.verification_status!, note: `desde envío ${id}`, moderator, created_at: now.toISOString() });
  }
  return { ok: true, value: { ...sub, ...patch } };
}

export async function resolveReport(id: string, action: "resolve" | "dismiss", note: string | undefined, moderator: string, now = new Date()): Promise<Outcome<null>> {
  const repo = await getRepo();
  const reports = await repo.listReports();
  const r = reports.find((x) => x.id === id);
  if (!r) return fail(404, "Reporte no encontrado");
  if (r.status !== "open") return fail(409, "El reporte ya está cerrado");
  const to = action === "resolve" ? "resolved" : "dismissed";
  // Al cerrar se borra el contacto de quien reportó: ya no hace falta.
  await repo.updateReport(id, { status: to, resolved_at: now.toISOString(), contact: null });
  await repo.log({ target_type: "report", target_id: id, action, from_status: "open", to_status: to, note: note ?? null, moderator, created_at: now.toISOString() });
  return { ok: true, value: null };
}

/** Acepta JSON o formulario clásico (funciona sin JavaScript). */
export async function readBody(req: Request): Promise<{ body: unknown; isForm: boolean }> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return { body: await req.json().catch(() => null), isForm: false };
  const fd = await req.formData();
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return { body: o, isForm: true };
}

export async function moderateEvent(id: string, body: { action?: string; status?: string; note?: string }, moderator: string, now = new Date()): Promise<Outcome<null>> {
  const repo = await getRepo();
  const e = await repo.getEventById(id);
  if (!e) return fail(404, "Convocatoria no encontrada");
  if (body.action === "withdraw") {
    if (!body.note) return fail(400, "Indica el motivo de la retirada.");
    await repo.deleteEvent(id);
    await repo.log({ target_type: "event", target_id: id, action: "withdraw", from_status: e.status, to_status: null, note: body.note, moderator, created_at: now.toISOString() });
    return { ok: true, value: null };
  }
  const statuses = ["programada", "cancelada", "suspendida", "realizada"] as const;
  const status = statuses.find((x) => x === body.status);
  if (body.action !== "status" || !status) return fail(400, "Acción no válida");
  await repo.updateEvent(id, { status, last_checked_at: now.toISOString(), updated_at: now.toISOString() });
  await repo.log({ target_type: "event", target_id: id, action: "status", from_status: e.status, to_status: status, note: body.note ?? null, moderator, created_at: now.toISOString() });
  return { ok: true, value: null };
}
