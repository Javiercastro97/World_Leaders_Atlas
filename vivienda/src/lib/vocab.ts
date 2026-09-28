/**
 * Vocabulario controlado del dominio (sin dependencias: se puede usar en el cliente).
 */

export const EVENT_TYPES = [
  "desahucio",
  "concentracion",
  "manifestacion",
  "asamblea",
  "asesoria",
  "accion",
  "charla",
  "otro",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  desahucio: "Parada de desahucio",
  concentracion: "Concentración",
  manifestacion: "Manifestación",
  asamblea: "Asamblea",
  asesoria: "Asesoría",
  accion: "Acción",
  charla: "Charla",
  otro: "Otro",
};

/** Estado del evento en sí (independiente de su verificación). */
export const EVENT_STATUSES = ["programada", "cancelada", "suspendida", "realizada"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/**
 * Grado de verificación de la información publicada.
 *  - verificada: el equipo ha contrastado la convocatoria con la organización o con 2 fuentes independientes.
 *  - fuente_oficial: procede de un canal público y oficial del propio colectivo convocante.
 *  - pendiente: publicada con aviso visible; aún no contrastada.
 */
export const VERIFICATION_STATUSES = ["verificada", "fuente_oficial", "pendiente"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * Precisión de la ubicación publicada.
 *  - exacta: punto público de concentración difundido expresamente por la organización convocante.
 *  - via: calle o plaza sin número.
 *  - barrio / municipio: precisión reducida (por defecto para el histórico).
 */
export const PRECISIONS = ["exacta", "via", "barrio", "municipio"] as const;
export type Precision = (typeof PRECISIONS)[number];

export const SOURCE_TYPES = [
  "web_organizacion",
  "red_social_publica",
  "boletin_oficial",
  "prensa",
  "dataset_oficial",
  "envio_ciudadano",
  "otro",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const ORG_TYPES = [
  "sindicato_vivienda",
  "pah",
  "asociacion_vecinal",
  "plataforma",
  "colectivo",
  "asesoria",
  "otros",
] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  sindicato_vivienda: "Sindicato de vivienda",
  pah: "PAH",
  asociacion_vecinal: "Asociación vecinal",
  plataforma: "Plataforma",
  colectivo: "Colectivo",
  asesoria: "Asesoría",
  otros: "Otros",
};

export const METRICS = [
  "lanzamientos_practicados",
  "lanzamientos_suspendidos",
  "lanzamientos_recibidos",
  "ejecuciones_hipotecarias_ingresadas",
  "poblacion",
] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_LABEL: Record<Metric, string> = {
  lanzamientos_practicados: "Lanzamientos practicados",
  lanzamientos_suspendidos: "Lanzamientos suspendidos",
  lanzamientos_recibidos: "Lanzamientos recibidos",
  ejecuciones_hipotecarias_ingresadas: "Ejecuciones hipotecarias ingresadas",
  poblacion: "Población",
};

export const PROCEDURE_TYPES = ["total", "ejecucion_hipotecaria", "arrendamientos_urbanos", "otros"] as const;
export type ProcedureType = (typeof PROCEDURE_TYPES)[number];

export const PROCEDURE_LABEL: Record<ProcedureType, string> = {
  total: "Total",
  ejecucion_hipotecaria: "Ejecución hipotecaria",
  arrendamientos_urbanos: "Arrendamientos urbanos (LAU)",
  otros: "Otras causas",
};

