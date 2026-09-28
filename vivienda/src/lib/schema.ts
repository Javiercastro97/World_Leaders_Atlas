/**
 * Modelo de dominio. Fuente única de verdad para tipos y validación (Zod).
 * Las migraciones SQL (migrations/*.sql) reflejan exactamente estos campos.
 */
import { z } from "zod";
import { RESERVED_TERRITORY_SLUGS, isTerritoryId } from "./territories";
import {
  EVENT_TYPES,
  EVENT_STATUSES,
  VERIFICATION_STATUSES,
  PRECISIONS,
  SOURCE_TYPES,
  ORG_TYPES,
  METRICS,
  PROCEDURE_TYPES,
} from "./vocab";

export * from "./vocab";

const slug = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug: minúsculas, números y guiones");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha AAAA-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "hora HH:MM");
const isoDateTime = z.string().datetime({ offset: true });
const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "solo http(s)");

export const territoryId = z.string().refine(isTerritoryId, "territorio desconocido");

// ---------------------------------------------------------------------------

export const SourceSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(200),
  url: httpUrl,
  type: z.enum(SOURCE_TYPES),
  retrieved_at: isoDateTime,
  published_at: isoDateTime.nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
});
export type Source = z.infer<typeof SourceSchema>;

export const LocationSchema = z.object({
  id: z.string(),
  municipality_code: z.string().regex(/^\d{5}$/).nullable(),
  municipality_name: z.string().max(120).nullable(),
  province_id: territoryId,
  neighborhood: z.string().max(120).nullable().default(null),
  /** Punto de encuentro público tal y como lo publica la organización (nunca un domicilio no difundido). */
  public_meeting_point: z.string().max(240).nullable().default(null),
  latitude: z.number().min(27).max(44.5),
  longitude: z.number().min(-18.5).max(4.6),
  precision: z.enum(PRECISIONS),
  /** Centroide de barrio, si se conoce, para degradar la precisión sin perder contexto. */
  neighborhood_latitude: z.number().nullable().default(null),
  neighborhood_longitude: z.number().nullable().default(null),
});
export type Location = z.infer<typeof LocationSchema>;

const socialLinks = z
  .array(z.object({ network: z.string().max(40), url: httpUrl }))
  .max(12)
  .default([]);

export const OrganizationSchema = z.object({
  id: z.string(),
  slug: slug.refine((s) => !RESERVED_TERRITORY_SLUGS.has(s), "slug reservado para un territorio"),
  name: z.string().min(2).max(200),
  description: z.string().max(3000).default(""),
  type: z.enum(ORG_TYPES),
  /** Territorio de actuación principal. */
  territory_id: territoryId,
  municipality_name: z.string().max(120).nullable().default(null),
  scope: z.enum(["barrio", "municipal", "comarcal", "provincial", "autonomico", "estatal"]),
  website: httpUrl.nullable().default(null),
  social_links: socialLinks,
  /** Solo contactos PÚBLICOS de la organización (email o teléfono de la sede publicados por ella). */
  public_contact: z.string().max(200).nullable().default(null),
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  source_id: z.string(),
  verified: z.boolean(),
  demo: z.boolean().default(false),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const EventSchema = z.object({
  id: z.string(),
  slug: slug,
  type: z.enum(EVENT_TYPES),
  title: z.string().min(4).max(200),
  description: z.string().max(4000).default(""),
  date: isoDate,
  time: hhmm.nullable(),
  end_time: hhmm.nullable().default(null),
  timezone: z.enum(["Europe/Madrid", "Atlantic/Canary"]),
  status: z.enum(EVENT_STATUSES),
  organization_id: z.string().nullable(),
  /** Nombre de la organización convocante tal como aparece en la fuente (si no está en el directorio). */
  organizer_name: z.string().max(200),
  location: LocationSchema,
  source_id: z.string(),
  verification_status: z.enum(VERIFICATION_STATUSES),
  submitted_at: isoDateTime.nullable().default(null),
  verified_at: isoDateTime.nullable(),
  last_checked_at: isoDateTime,
  demo: z.boolean().default(false),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});
export type HousingEvent = z.infer<typeof EventSchema>;

// ---------------------------------------------------------------------------
// Estadísticas agregadas

export const periodSchema = z.string().regex(/^\d{4}(-Q[1-4])?$/, "periodo AAAA o AAAA-QN");

export const StatisticSchema = z.object({
  id: z.string(),
  period: periodSchema,
  period_type: z.enum(["year", "quarter"]),
  territory_type: z.enum(["country", "ccaa", "province", "tsj"]),
  territory_code: z.string(),
  metric: z.enum(METRICS),
  procedure_type: z.enum(PROCEDURE_TYPES),
  value: z.number().nonnegative(),
  /** "reported": tal cual en la fuente; "derived": suma calculada por nosotros a partir de datos reportados. */
  derivation: z.enum(["reported", "derived"]).default("reported"),
  source_id: z.string(),
  dataset_id: z.string(),
  snapshot_id: z.string(),
  retrieved_at: isoDateTime,
  demo: z.boolean().default(false),
});
export type Statistic = z.infer<typeof StatisticSchema>;

/** Metadatos de dataset: se muestran junto a cada visualización. */
export const DatasetSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  title: z.string(),
  url: httpUrl,
  methodology: z.string(),
  limitations: z.array(z.string()).default([]),
  territorial_levels: z.array(z.enum(["country", "ccaa", "province", "tsj"])),
  period_types: z.array(z.enum(["year", "quarter"])),
  first_period: periodSchema.nullable(),
  last_period: periodSchema.nullable(),
  source_updated_at: isoDateTime.nullable(),
  retrieved_at: isoDateTime.nullable(),
  demo: z.boolean().default(false),
});
export type Dataset = z.infer<typeof DatasetSchema>;

// ---------------------------------------------------------------------------
// Envíos ciudadanos y moderación

export const SUBMISSION_STATUSES = ["submitted", "pending_review", "verified", "published", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Formulario público "Avisa de una convocatoria". */
export const SubmissionInputSchema = z.object({
  type: z.enum(EVENT_TYPES),
  date: isoDate,
  time: hhmm.optional().or(z.literal("")).transform((v) => v || null),
  municipality: z.string().trim().min(2).max(120),
  province_id: territoryId.refine((id) => id.startsWith("PR-"), "provincia no válida"),
  organization: z.string().trim().min(2).max(200),
  source_url: httpUrl.max(1000),
  description: z.string().trim().min(10).max(2000),
  meeting_point: z.string().trim().max(240).optional().transform((v) => v || null),
  comments: z.string().trim().max(1000).optional().transform((v) => v || null),
  /** Confirmación explícita: difusión pública por la organización y sin datos de personas afectadas. */
  confirm_public: z.union([z.literal("on"), z.literal("true"), z.literal(true)], { message: "Debes confirmar que la convocatoria es pública" }),
  // Anti-spam
  website: z.string().max(0, "spam").optional(), // honeypot: debe llegar vacío
  form_token: z.string().min(10).max(200),
});
export type SubmissionInput = z.infer<typeof SubmissionInputSchema>;

export const SubmissionSchema = z.object({
  id: z.string(),
  status: z.enum(SUBMISSION_STATUSES),
  payload: z.object({
    type: z.enum(EVENT_TYPES),
    date: isoDate,
    time: hhmm.nullable(),
    municipality: z.string(),
    province_id: z.string(),
    organization: z.string(),
    source_url: z.string(),
    description: z.string(),
    meeting_point: z.string().nullable(),
    comments: z.string().nullable(),
  }),
  /** Avisos automáticos de privacidad detectados en el texto (teléfonos, DNI, emails…). */
  privacy_flags: z.array(z.string()).default([]),
  /** Hash diario (HMAC) de la IP: permite limitar abusos sin guardar la IP. */
  client_hash: z.string(),
  event_id: z.string().nullable().default(null),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});
export type Submission = z.infer<typeof SubmissionSchema>;

export const REPORT_REASONS = ["dato_incorrecto", "datos_personales", "evento_cancelado", "retirada", "otro"] as const;
export const ReportInputSchema = z.object({
  target_type: z.enum(["event", "organization", "statistic", "other"]),
  target_id: z.string().max(120).optional().transform((v) => v || null),
  reason: z.enum(REPORT_REASONS),
  message: z.string().trim().min(5).max(2000),
  contact: z.string().trim().max(200).optional().transform((v) => v || null),
  website: z.string().max(0).optional(),
  form_token: z.string().min(10).max(200),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

export const ModerationActionSchema = z.object({
  action: z.enum(["start_review", "verify", "publish", "reject", "request_changes"]),
  note: z.string().trim().max(2000).optional(),
  /** Al publicar: nivel de verificación y precisión de ubicación decididos por moderación. */
  verification_status: z.enum(VERIFICATION_STATUSES).optional(),
  precision: z.enum(PRECISIONS).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  title: z.string().min(4).max(200).optional(),
  source_name: z.string().min(2).max(200).optional(),
  source_type: z.enum(SOURCE_TYPES).optional(),
  organization_slug: z.string().max(80).optional(),
});
export type ModerationAction = z.infer<typeof ModerationActionSchema>;
