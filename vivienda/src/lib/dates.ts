/**
 * Fechas de convocatorias.
 *
 * Una convocatoria se guarda como fecha + hora LOCALES más su zona horaria
 * (Europe/Madrid o Atlantic/Canary). Así "10:00 en Las Palmas" es siempre las 10:00
 * de Canarias, y el cálculo de "hoy"/"mañana" se hace en la zona del evento.
 */

export type Tz = "Europe/Madrid" | "Atlantic/Canary";

const dayFmt = new Map<string, Intl.DateTimeFormat>();
function fmtFor(tz: string) {
  let f = dayFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    dayFmt.set(tz, f);
  }
  return f;
}

function parts(d: Date, tz: string) {
  const p = Object.fromEntries(fmtFor(tz).formatToParts(d).map((x) => [x.type, x.value]));
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    min: Number(p.minute),
    s: Number(p.second),
  };
}

/** "AAAA-MM-DD" de un instante en una zona horaria. */
export function localDate(now: Date, tz: Tz | string = "Europe/Madrid"): string {
  const p = parts(now, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Suma días a una fecha civil "AAAA-MM-DD" (sin ambigüedad horaria). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Convierte fecha+hora local de una zona a instante UTC. Gestiona cambios de horario. */
export function zonedToUtc(date: string, time: string | null, tz: Tz | string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Dos pasadas bastan para converger incluso en el día del cambio de hora.
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(ts), tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    ts = ts + (guess - asUtc);
  }
  return new Date(ts);
}

interface Timed {
  date: string;
  time: string | null;
  end_time?: string | null;
  timezone: Tz;
}

export function eventStart(e: Timed): Date {
  return zonedToUtc(e.date, e.time, e.timezone);
}

/** Fin estimado: hora de fin si existe; si no, inicio + 3 h; sin hora, final del día local. */
export function eventEnd(e: Timed): Date {
  if (e.end_time) return zonedToUtc(e.date, e.end_time, e.timezone);
  if (e.time) return new Date(eventStart(e).getTime() + 3 * 3600_000);
  return zonedToUtc(addDays(e.date, 1), "00:00", e.timezone);
}

export function isPast(e: Timed, now: Date): boolean {
  return eventEnd(e).getTime() < now.getTime();
}

export const AGENDA_TABS = ["hoy", "manana", "semana", "proximas"] as const;
export type AgendaTab = (typeof AGENDA_TABS)[number];

export const AGENDA_TAB_LABEL: Record<AgendaTab, string> = {
  hoy: "Hoy",
  manana: "Mañana",
  semana: "Esta semana",
  proximas: "Próximas",
};

/**
 * Pestañas de la agenda como filtros acumulativos:
 *  hoy ⊂ semana ⊂ próximas ; mañana ⊂ semana.
 * "Esta semana" = hoy y los 6 días siguientes (7 días naturales).
 */
export function inAgendaTab(e: Timed, tab: AgendaTab, now: Date): boolean {
  if (isPast(e, now)) return false;
  const today = localDate(now, e.timezone);
  switch (tab) {
    case "hoy":
      return e.date === today;
    case "manana":
      return e.date === addDays(today, 1);
    case "semana":
      return e.date >= today && e.date <= addDays(today, 6);
    case "proximas":
      return true;
  }
}

const longDay = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function civil(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "hoy", "mañana" o "jueves, 2 de octubre". */
export function humanDay(date: string, now: Date, tz: Tz = "Europe/Madrid", style: "long" | "short" = "long"): string {
  const today = localDate(now, tz);
  if (date === today) return "Hoy";
  if (date === addDays(today, 1)) return "Mañana";
  if (date === addDays(today, -1)) return "Ayer";
  const s = (style === "long" ? longDay : shortDay).format(civil(date));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    civil(date),
  );
}

/** "hace 3 h", "hace 2 días", "hace 5 min". */
export function timeAgo(iso: string, now: Date): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const min = Math.round(diff / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `hace ${d} ${d === 1 ? "día" : "días"}`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `hace ${mo} ${mo === 1 ? "mes" : "meses"}`;
  const y = Math.round(mo / 12);
  return `hace ${y} ${y === 1 ? "año" : "años"}`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Periodos estadísticos "2024" | "2024-Q3"

export function periodLabel(p: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(p);
  if (m) return `${m[2]}.º trim. ${m[1]}`;
  return p;
}

export function periodYear(p: string): number {
  return Number(p.slice(0, 4));
}

/** Periodo equivalente del año anterior (para variación interanual). */
export function previousYearPeriod(p: string): string {
  const m = /^(\d{4})(-Q[1-4])?$/.exec(p);
  if (!m) throw new Error(`periodo no válido: ${p}`);
  return `${Number(m[1]) - 1}${m[2] ?? ""}`;
}

export function comparePeriods(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
