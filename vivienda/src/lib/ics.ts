/** Genera un fichero iCalendar (RFC 5545) para "Añadir al calendario". Sin servicios de terceros. */
import type { HousingEvent } from "./schema";
import { EVENT_TYPE_LABEL } from "./schema";
import { eventEnd, eventStart } from "./dates";
import type { PublicLocation } from "./privacy";

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Pliega líneas a 75 octetos como exige el estándar. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(e: HousingEvent, loc: PublicLocation, opts: { url: string; sourceUrl: string; now: Date }): string {
  const allDay = !e.time;
  const place = [loc.meeting_point, loc.neighborhood, loc.municipality_name].filter(Boolean).join(", ");
  const desc = [
    `${EVENT_TYPE_LABEL[e.type]} convocada por ${e.organizer_name}.`,
    e.description,
    `Convocatoria original: ${opts.sourceUrl}`,
    `Ficha: ${opts.url}`,
    "Comprueba la convocatoria original antes de acudir: puede cambiar.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mapa por la Vivienda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@mapa-vivienda`,
    `DTSTAMP:${utcStamp(opts.now)}`,
    allDay ? `DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}` : `DTSTART:${utcStamp(eventStart(e))}`,
    allDay ? `DTEND;VALUE=DATE:${utcStamp(eventEnd(e)).slice(0, 8)}` : `DTEND:${utcStamp(eventEnd(e))}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(desc)}`,
    place ? `LOCATION:${esc(place)}` : null,
    `URL:${opts.url}`,
    e.status === "cancelada" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);

  return lines.map(fold).join("\r\n") + "\r\n";
}
