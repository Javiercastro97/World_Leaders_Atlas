import type { PublicEvent } from "@/server/events";
import type { Choropleth } from "@/server/stats";
import type { OrgType } from "@/lib/schema";

export interface MapOrg {
  id: string;
  slug: string;
  name: string;
  type: OrgType;
  latitude: number;
  longitude: number;
  territory_id: string;
  municipality_name: string | null;
  verified: boolean;
  demo: boolean;
}

export type Selection = { kind: "event"; id: string } | { kind: "org"; id: string } | { kind: "territory"; id: string } | null;

export interface Layers {
  events: boolean;
  stats: boolean;
  orgs: boolean;
}

export interface StatsOptions {
  level: "province" | "ccaa";
  mode: "abs" | "rate";
  period: string;
  procedure: "total" | "ejecucion_hipotecaria" | "arrendamientos_urbanos" | "otros";
}

export interface Classified {
  breaks: number[]; // límites superiores de cada clase
  byId: Map<string, { cls: number; value: number | null; rate: number | null; note: string | null }>;
}

export type { PublicEvent, Choropleth };

export const CLASS_COLORS = ["#e2ddd3", "#bdb6aa", "#948c80", "#5f5a53", "#2a2825"];

/** Quintiles sobre los valores no nulos. Devuelve clase -1 para "sin datos". */
export function classify(c: Choropleth | null, mode: StatsOptions["mode"]): Classified {
  const byId: Classified["byId"] = new Map();
  if (!c) return { breaks: [], byId };
  const vals = c.data
    .map((d) => (mode === "rate" ? d.rate : d.value))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const breaks: number[] = [];
  if (vals.length) {
    const k = Math.min(5, new Set(vals).size);
    for (let i = 1; i <= k; i++) breaks.push(vals[Math.min(vals.length - 1, Math.ceil((i / k) * vals.length) - 1)]);
  }
  for (const d of c.data) {
    const v = mode === "rate" ? d.rate : d.value;
    const cls = v === null ? -1 : Math.max(0, breaks.findIndex((b) => v <= b));
    byId.set(d.id, { cls, value: d.value, rate: d.rate, note: d.note });
  }
  return { breaks, byId };
}
