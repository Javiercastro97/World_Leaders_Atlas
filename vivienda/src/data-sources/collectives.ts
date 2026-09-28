/**
 * Directorio de colectivos y convocatorias curadas vía repositorio (pull requests).
 *
 *   data/curated/organizations/<slug>.json
 *   data/curated/events/<slug>.json
 *
 * Es el canal preferente para que las propias organizaciones mantengan su ficha:
 * cada cambio queda revisado y versionado en git. Cada fichero incluye su `source`
 * (de dónde sale la información) y se valida con el mismo esquema que la base de datos.
 */
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { z } from "zod";
import { EventSchema, OrganizationSchema, SourceSchema, type HousingEvent, type Organization, type Source } from "@/lib/schema";
import { timezoneForProvince } from "@/lib/territories";
import { DATA_DIR } from "./snapshot";

export const CURATED_DIR = path.join(DATA_DIR, "curated");

const EmbeddedSource = SourceSchema.omit({ id: true });

const CuratedOrg = OrganizationSchema.omit({ id: true, source_id: true, demo: true, created_at: true, updated_at: true }).extend({
  source: EmbeddedSource,
  created_at: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }),
});

const CuratedEvent = EventSchema.omit({
  id: true,
  source_id: true,
  demo: true,
  created_at: true,
  timezone: true,
  location: true,
}).extend({
  source: EmbeddedSource,
  location: EventSchema.shape.location.omit({ id: true }),
  created_at: z.string().datetime({ offset: true }).optional(),
});

async function readJsonDir(dir: string): Promise<{ file: string; data: unknown }[]> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
  return Promise.all(names.map(async (n) => ({ file: n, data: JSON.parse(await readFile(path.join(dir, n), "utf8")) as unknown })));
}

export interface CuratedData {
  organizations: Organization[];
  events: HousingEvent[];
  sources: Source[];
  errors: string[];
}

export async function loadCurated(dir = CURATED_DIR): Promise<CuratedData> {
  const out: CuratedData = { organizations: [], events: [], sources: [], errors: [] };
  const orgSlugToId = new Map<string, string>();

  for (const { file, data } of await readJsonDir(path.join(dir, "organizations"))) {
    const r = CuratedOrg.safeParse(data);
    if (!r.success) {
      out.errors.push(`organizations/${file}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    const { source, ...o } = r.data;
    const id = `org-${o.slug}`;
    const sourceId = `src-org-${o.slug}`;
    out.sources.push({ ...source, id: sourceId });
    orgSlugToId.set(o.slug, id);
    out.organizations.push({ ...o, id, source_id: sourceId, demo: false, created_at: o.created_at ?? o.updated_at });
  }

  for (const { file, data } of await readJsonDir(path.join(dir, "events"))) {
    const r = CuratedEvent.safeParse(data);
    if (!r.success) {
      out.errors.push(`events/${file}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    const { source, location, ...e } = r.data;
    const id = `evt-${e.slug}`;
    const sourceId = `src-evt-${e.slug}`;
    out.sources.push({ ...source, id: sourceId });
    // organization_id en ficheros curados puede ser el slug de la organización
    const orgId = e.organization_id ? (orgSlugToId.get(e.organization_id) ?? e.organization_id) : null;
    out.events.push({
      ...e,
      id,
      organization_id: orgId,
      timezone: timezoneForProvince(location.province_id),
      location: { ...location, id: `loc-${id}` },
      source_id: sourceId,
      demo: false,
      created_at: e.created_at ?? e.last_checked_at,
    });
  }
  return out;
}
