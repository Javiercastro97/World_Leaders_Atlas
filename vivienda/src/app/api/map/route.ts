import { listPublicEvents, upcoming } from "@/server/events";
import { getRepo } from "@/server/repo";
import { choropleth } from "@/server/stats";
import { addDays, localDate } from "@/lib/dates";
import { json } from "@/server/http";

/**
 * GET /api/map — todo lo que pinta el mapa en un solo documento:
 * convocatorias (GeoJSON, ubicaciones ya degradadas por privacidad), colectivos (GeoJSON)
 * y el choropleth provincial del último periodo disponible (valores agregados, no puntos).
 */
export async function GET() {
  const now = new Date();
  const today = localDate(now);
  const repo = await getRepo();
  const [events, orgs, stats] = await Promise.all([
    listPublicEvents({ from: addDays(today, -1), to: addDays(today, 90) }, now),
    repo.listOrganizations(),
    choropleth({ level: "province" }),
  ]);
  return json(
    {
      events: {
        type: "FeatureCollection",
        features: upcoming(events).map((e) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [e.location.longitude, e.location.latitude] },
          properties: {
            slug: e.slug, type: e.type, title: e.title, date: e.date, time: e.time, status: e.effective_status,
            verification_status: e.verification_status, organizer: e.organizer_name, precision: e.location.precision,
            source_url: e.source?.url ?? null,
          },
        })),
      },
      organizations: {
        type: "FeatureCollection",
        features: orgs
          .filter((o) => o.latitude != null)
          .map((o) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [o.longitude, o.latitude] },
            properties: { slug: o.slug, name: o.name, type: o.type, verified: o.verified },
          })),
      },
      statistics: stats,
      generated_at: now.toISOString(),
    },
    { cache: "public", maxAge: 60 },
  );
}
