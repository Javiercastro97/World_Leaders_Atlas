import { describe, expect, it } from "vitest";
import { addDays, eventEnd, eventStart, inAgendaTab, isPast, localDate, periodLabel, previousYearPeriod, zonedToUtc, humanDay, timeAgo } from "@/lib/dates";

describe("zonas horarias", () => {
  it("convierte hora local de Madrid a UTC en verano e invierno", () => {
    expect(zonedToUtc("2026-07-10", "10:00", "Europe/Madrid").toISOString()).toBe("2026-07-10T08:00:00.000Z");
    expect(zonedToUtc("2026-01-10", "10:00", "Europe/Madrid").toISOString()).toBe("2026-01-10T09:00:00.000Z");
  });
  it("respeta la hora canaria", () => {
    expect(zonedToUtc("2026-07-10", "10:00", "Atlantic/Canary").toISOString()).toBe("2026-07-10T09:00:00.000Z");
  });
  it("gestiona el día del cambio de hora", () => {
    // 29/03/2026: en Madrid se pasa de 02:00 a 03:00
    expect(zonedToUtc("2026-03-29", "12:00", "Europe/Madrid").toISOString()).toBe("2026-03-29T10:00:00.000Z");
    expect(zonedToUtc("2026-10-25", "12:00", "Europe/Madrid").toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });
  it("calcula 'hoy' en la zona del evento, no en UTC", () => {
    const lateNightUtc = new Date("2026-06-30T22:30:00Z"); // 00:30 del 1 de julio en Madrid
    expect(localDate(lateNightUtc, "Europe/Madrid")).toBe("2026-07-01");
    expect(localDate(lateNightUtc, "Atlantic/Canary")).toBe("2026-06-30");
  });
});

describe("agenda", () => {
  const now = new Date("2026-09-28T08:00:00Z"); // lunes 10:00 en Madrid
  const ev = (date: string, time: string | null = "19:00") => ({ date, time, end_time: null, timezone: "Europe/Madrid" as const });

  it("clasifica hoy, mañana, semana y próximas", () => {
    expect(inAgendaTab(ev("2026-09-28"), "hoy", now)).toBe(true);
    expect(inAgendaTab(ev("2026-09-29"), "manana", now)).toBe(true);
    expect(inAgendaTab(ev("2026-09-29"), "hoy", now)).toBe(false);
    expect(inAgendaTab(ev("2026-10-04"), "semana", now)).toBe(true);
    expect(inAgendaTab(ev("2026-10-05"), "semana", now)).toBe(false);
    expect(inAgendaTab(ev("2026-12-01"), "proximas", now)).toBe(true);
  });
  it("excluye convocatorias ya terminadas", () => {
    expect(inAgendaTab(ev("2026-09-28", "06:00"), "hoy", now)).toBe(false); // 06:00 + 3 h < 10:00
    expect(isPast(ev("2026-09-28", null), now)).toBe(false); // sin hora: vale todo el día
    expect(isPast(ev("2026-09-27", null), now)).toBe(true);
  });
  it("usa la hora de fin cuando existe", () => {
    const e = { date: "2026-09-28", time: "09:00", end_time: "14:00", timezone: "Europe/Madrid" as const };
    expect(eventEnd(e).toISOString()).toBe("2026-09-28T12:00:00.000Z");
    expect(eventStart(e).toISOString()).toBe("2026-09-28T07:00:00.000Z");
  });
  it("formatea días relativos en español", () => {
    expect(humanDay("2026-09-28", now)).toBe("Hoy");
    expect(humanDay("2026-09-29", now)).toBe("Mañana");
    expect(humanDay("2026-10-01", now)).toMatch(/^Jueves, 1 de octubre/);
    expect(timeAgo("2026-09-28T05:00:00Z", now)).toBe("hace 3 h");
  });
});

describe("periodos", () => {
  it("etiqueta y compara periodos", () => {
    expect(periodLabel("2024-Q3")).toBe("3.º trim. 2024");
    expect(previousYearPeriod("2024-Q3")).toBe("2023-Q3");
    expect(previousYearPeriod("2024")).toBe("2023");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
