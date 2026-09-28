/** Vista pública de convocatorias: aplica privacidad y adjunta procedencia. */
import type { HousingEvent, Source } from "@/lib/schema";
import { publicLocation, type PublicLocation } from "@/lib/privacy";
import { isPast } from "@/lib/dates";
import { getRepo } from "./repo";
import type { EventFilter } from "./repo/types";
import { municipioCentroid } from "./municipios";

export interface PublicEvent {
  id: string;
  slug: string;
  type: HousingEvent["type"];
  title: string;
  description: string;
  date: string;
  time: string | null;
  end_time: string | null;
  timezone: HousingEvent["timezone"];
  status: HousingEvent["status"];
  /** "realizada" se infiere cuando la convocatoria ya pasó aunque nadie la haya marcado. */
  effective_status: HousingEvent["status"];
  verification_status: HousingEvent["verification_status"];
  organizer_name: string;
  organization: { slug: string; name: string } | null;
  location: PublicLocation;
  source: Pick<Source, "name" | "url" | "type" | "published_at" | "retrieved_at"> | null;
  submitted_at: string | null;
  verified_at: string | null;
  last_checked_at: string;
  updated_at: string;
  demo: boolean;
}

export async function toPublic(events: HousingEvent[], now: Date): Promise<PublicEvent[]> {
  const repo = await getRepo();
  const [sources, orgs] = await Promise.all([repo.listSources(), repo.listOrganizations()]);
  const srcById = new Map(sources.map((s) => [s.id, s]));
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  return events.map((e) => {
    const s = srcById.get(e.source_id);
    const o = e.organization_id ? orgById.get(e.organization_id) : undefined;
    return {
      id: e.id,
      slug: e.slug,
      type: e.type,
      title: e.title,
      description: e.description,
      date: e.date,
      time: e.time,
      end_time: e.end_time,
      timezone: e.timezone,
      status: e.status,
      effective_status: e.status === "programada" && isPast(e, now) ? "realizada" : e.status,
      verification_status: e.verification_status,
      organizer_name: e.organizer_name,
      organization: o ? { slug: o.slug, name: o.name } : null,
      location: publicLocation(e, now, municipioCentroid),
      source: s ? { name: s.name, url: s.url, type: s.type, published_at: s.published_at, retrieved_at: s.retrieved_at } : null,
      submitted_at: e.submitted_at,
      verified_at: e.verified_at,
      last_checked_at: e.last_checked_at,
      updated_at: e.updated_at,
      demo: e.demo,
    };
  });
}

export async function listPublicEvents(f: EventFilter, now = new Date()): Promise<PublicEvent[]> {
  const repo = await getRepo();
  return toPublic(await repo.listEvents(f), now);
}

export async function getPublicEvent(slug: string, now = new Date()): Promise<{ event: PublicEvent; raw: HousingEvent } | null> {
  const repo = await getRepo();
  const raw = await repo.getEvent(slug);
  if (!raw) return null;
  const [event] = await toPublic([raw], now);
  return { event, raw };
}

/** Próximas convocatorias (no pasadas, no canceladas) ordenadas por fecha. */
export function upcoming(events: PublicEvent[]): PublicEvent[] {
  return events.filter((e) => e.effective_status === "programada" || e.effective_status === "suspendida");
}
