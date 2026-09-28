import { z } from "zod";
import { EVENT_TYPES } from "@/lib/vocab";
import { getCcaaBySlug, getProvinceBySlug, isTerritoryId } from "@/lib/territories";

/** Acepta un id (PR-03, CA-10), un slug de provincia ("alicante") o de CCAA. */
export function resolveTerritory(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  const up = s.toUpperCase();
  if (isTerritoryId(up)) return up;
  const lower = s.toLowerCase();
  return getProvinceBySlug(lower)?.id ?? getCcaaBySlug(lower)?.id ?? null;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const EventQuery = z.object({
  province: z.string().optional(),
  territory: z.string().optional(),
  municipality: z.string().max(120).optional(),
  from: date.optional(),
  to: date.optional(),
  type: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : undefined))
    .pipe(z.array(z.enum(EVENT_TYPES)).optional()),
  organization: z.string().max(80).optional(),
  lat: z.coerce.number().min(27).max(44.5).optional(),
  lon: z.coerce.number().min(-18.5).max(4.6).optional(),
  radius: z.coerce.number().refine((r) => [5, 10, 25, 50, 100].includes(r), "radio: 5, 10, 25, 50 o 100").optional(),
  include_past: z.enum(["0", "1"]).optional(),
});

export function queryObject(url: URL): Record<string, string> {
  return Object.fromEntries([...url.searchParams.entries()].filter(([, v]) => v !== ""));
}
