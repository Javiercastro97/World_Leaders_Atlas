/**
 * Flujo de moderación de envíos ciudadanos.
 *
 *   submitted ──start_review──▶ pending_review ──verify──▶ verified ──publish──▶ published
 *        │                          │   ▲                     │
 *        └──────────reject──────────┴───┴──request_changes────┴──reject──▶ rejected
 *
 * Nunca se publica automáticamente: `publish` solo es válido desde `verified`,
 * y solo lo puede ejecutar una persona moderadora autenticada.
 */
import type { HousingEvent, ModerationAction, Submission, SubmissionStatus, VerificationStatus, Precision } from "./schema";
import { timezoneForProvince, getTerritory } from "./territories";

const TRANSITIONS: Record<ModerationAction["action"], { from: SubmissionStatus[]; to: SubmissionStatus }> = {
  start_review: { from: ["submitted"], to: "pending_review" },
  verify: { from: ["pending_review"], to: "verified" },
  publish: { from: ["verified"], to: "published" },
  request_changes: { from: ["pending_review", "verified"], to: "pending_review" },
  reject: { from: ["submitted", "pending_review", "verified"], to: "rejected" },
};

export class ModerationError extends Error {}

export function nextStatus(current: SubmissionStatus, action: ModerationAction["action"]): SubmissionStatus {
  const t = TRANSITIONS[action];
  if (!t.from.includes(current)) {
    throw new ModerationError(`No se puede aplicar "${action}" a un envío en estado "${current}".`);
  }
  return t.to;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export interface PublishOptions {
  eventId: string;
  sourceId: string;
  verification_status: VerificationStatus;
  precision: Precision;
  latitude: number;
  longitude: number;
  title?: string;
  municipality_code: string | null;
  organization_id: string | null;
  now: Date;
}

/** Construye el evento público a partir de un envío verificado y las decisiones de moderación. */
export function eventFromSubmission(sub: Submission, o: PublishOptions): HousingEvent {
  if (sub.status !== "verified") throw new ModerationError("Solo se publican envíos verificados.");
  const p = sub.payload;
  const nowIso = o.now.toISOString();
  const province = getTerritory(p.province_id);
  const title = o.title ?? `${p.organization} · ${p.municipality}`;
  return {
    id: o.eventId,
    slug: `${slugify(title)}-${p.date}-${o.eventId.slice(0, 6)}`.replace(/--+/g, "-"),
    type: p.type,
    title,
    description: p.description,
    date: p.date,
    time: p.time,
    end_time: null,
    timezone: timezoneForProvince(p.province_id),
    status: "programada",
    organization_id: o.organization_id,
    organizer_name: p.organization,
    location: {
      id: `loc-${o.eventId}`,
      municipality_code: o.municipality_code,
      municipality_name: p.municipality,
      province_id: province?.id ?? p.province_id,
      neighborhood: null,
      public_meeting_point: p.meeting_point,
      latitude: o.latitude,
      longitude: o.longitude,
      precision: o.precision,
      neighborhood_latitude: null,
      neighborhood_longitude: null,
    },
    source_id: o.sourceId,
    verification_status: o.verification_status,
    submitted_at: sub.created_at,
    verified_at: o.verification_status === "pendiente" ? null : nowIso,
    last_checked_at: nowIso,
    demo: false,
    created_at: nowIso,
    updated_at: nowIso,
  };
}
