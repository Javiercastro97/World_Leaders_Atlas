/**
 * Privacidad por diseño.
 *
 * 1. La precisión geográfica que se publica depende del estado de la convocatoria:
 *    - Solo una convocatoria ACTIVA, cuya fuente es la propia organización o está verificada,
 *      puede mostrar un punto exacto (el punto público de concentración difundido por el colectivo).
 *    - Las convocatorias pendientes de verificación nunca muestran más que el barrio.
 *    - Al terminar (o cancelarse/suspenderse), el histórico se degrada a barrio o municipio.
 * 2. Los textos libres de envíos ciudadanos se limpian de datos personales antes de guardarse.
 */
import type { HousingEvent, Precision } from "./schema";
import { isPast } from "./dates";

const ORDER: Precision[] = ["exacta", "via", "barrio", "municipio"];

/** Devuelve la precisión menos detallada de las dos. */
export function coarserOf(a: Precision, b: Precision): Precision {
  return ORDER[Math.max(ORDER.indexOf(a), ORDER.indexOf(b))];
}

export interface PublicLocation {
  latitude: number;
  longitude: number;
  precision: Precision;
  meeting_point: string | null;
  neighborhood: string | null;
  municipality_name: string | null;
  province_id: string;
  /** Explica al usuario por qué la ubicación no es exacta. */
  precision_note: string | null;
}

export type CentroidLookup = (municipalityCode: string) => { lat: number; lon: number } | null;

/** Precisión máxima permitida para un evento en un instante dado. */
export function maxAllowedPrecision(e: Pick<HousingEvent, "status" | "verification_status" | "date" | "time" | "end_time" | "timezone">, now: Date): Precision {
  const finished = e.status !== "programada" || isPast(e, now);
  if (finished) return "barrio";
  if (e.verification_status === "pendiente") return "barrio";
  return "exacta";
}

export function publicLocation(e: HousingEvent, now: Date, centroid?: CentroidLookup): PublicLocation {
  const loc = e.location;
  const allowed = maxAllowedPrecision(e, now);
  let precision = coarserOf(loc.precision, allowed);

  let latitude = loc.latitude;
  let longitude = loc.longitude;
  let note: string | null = null;

  if (precision === "barrio") {
    if (loc.neighborhood_latitude != null && loc.neighborhood_longitude != null) {
      latitude = loc.neighborhood_latitude;
      longitude = loc.neighborhood_longitude;
    } else {
      precision = "municipio";
    }
  }
  if (precision === "municipio") {
    const c = loc.municipality_code && centroid ? centroid(loc.municipality_code) : null;
    if (c) {
      latitude = c.lat;
      longitude = c.lon;
    } else {
      // Sin centroide conocido: redondeo a ~1 km para no revelar el punto original.
      latitude = Math.round(loc.latitude * 100) / 100;
      longitude = Math.round(loc.longitude * 100) / 100;
    }
  }

  if (precision !== loc.precision) {
    note =
      allowed === "barrio" && e.verification_status === "pendiente" && e.status === "programada" && !isPast(e, now)
        ? "Ubicación aproximada hasta verificar la convocatoria."
        : "Convocatoria finalizada: la ubicación se muestra con precisión reducida.";
  }

  const showMeetingPoint = precision === "exacta" || precision === "via";
  return {
    latitude,
    longitude,
    precision,
    meeting_point: showMeetingPoint ? loc.public_meeting_point : null,
    neighborhood: loc.neighborhood,
    municipality_name: loc.municipality_name,
    province_id: loc.province_id,
    precision_note: note,
  };
}

// ---------------------------------------------------------------------------
// Detección y retirada de datos personales en texto libre

const PATTERNS: { flag: string; re: RegExp }[] = [
  // DNI (8 dígitos + letra) y NIE (X/Y/Z + 7 dígitos + letra)
  { flag: "dni_nie", re: /\b(?:\d{8}|[XYZ]\d{7})[-\s]?[A-HJ-NP-TV-Z]\b/gi },
  // IBAN español
  { flag: "iban", re: /\bES\d{2}(?:[\s-]?\d{4}){5}\b/gi },
  // Teléfonos españoles: 6xx/7xx/8xx/9xx con o sin prefijo +34, agrupados de varias formas
  { flag: "telefono", re: /(?:\+34[\s.-]?|0034[\s.-]?)?\b[6789](?:[\s.-]?\d){8}\b/g },
  { flag: "email", re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
];

// Indicios de domicilio concreto (piso/puerta). No se retiran automáticamente,
// pero se marcan para que moderación revise antes de publicar.
const RESIDENTIAL_HINTS = /\b(\d{1,2}\s?[ºª°]\s?[A-Z]?\b|piso\s+\d|puerta\s+\d|escalera\s+[A-Z0-9]|bajo\s+[A-Z]\b|[1-9]\s?(?:izq|izda|dcha|der)\.?)/i;
// Menciones a personas afectadas con nombre o circunstancias familiares/económicas.
const PERSONAL_HINTS = /\b(la familia de|los hijos de|su hija|su hijo|menores|discapacidad|nómina|deuda de|debe \d)/i;

export interface ScanResult {
  clean: string;
  flags: string[];
}

export function scrubPersonalData(text: string | null): ScanResult {
  if (!text) return { clean: text ?? "", flags: [] };
  const flags = new Set<string>();
  let clean = text;
  for (const { flag, re } of PATTERNS) {
    clean = clean.replace(re, () => {
      flags.add(flag);
      return "[dato retirado]";
    });
  }
  if (RESIDENTIAL_HINTS.test(clean)) flags.add("posible_domicilio");
  if (PERSONAL_HINTS.test(clean)) flags.add("posible_dato_personal");
  return { clean, flags: [...flags] };
}
