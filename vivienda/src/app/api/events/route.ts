import { listPublicEvents } from "@/server/events";
import { EventQuery, queryObject, resolveTerritory } from "@/server/params";
import { error, guardRate, json, tooMany, zodError } from "@/server/http";
import { distanceKm } from "@/lib/geo";
import { addDays, localDate } from "@/lib/dates";
import { getRepo } from "@/server/repo";

/**
 * GET /api/events
 *   ?province=alicante|PR-03  ?territory=CA-10  ?municipality=Elche
 *   ?from=AAAA-MM-DD&to=AAAA-MM-DD  ?type=desahucio,concentracion  ?organization=<slug>
 *   ?lat=..&lon=..&radius=5|10|25|50|100   (la posición no se registra en ningún log)
 *   ?include_past=1
 */
export async function GET(req: Request) {
  const rl = guardRate(req, "api");
  if (!rl.allowed) return tooMany(rl.retryAfterSec);
  const url = new URL(req.url);
  const parsed = EventQuery.safeParse(queryObject(url));
  if (!parsed.success) return zodError(parsed.error);
  const q = parsed.data;

  const territoryParam = q.province ?? q.territory;
  const territory = resolveTerritory(territoryParam);
  if (territoryParam && !territory) return error(400, `Territorio desconocido: ${territoryParam}`);

  let organizationId: string | undefined;
  if (q.organization) {
    const org = await (await getRepo()).getOrganization(q.organization);
    if (!org) return error(404, "Organización no encontrada");
    organizationId = org.id;
  }

  const now = new Date();
  const from = q.from ?? (q.include_past === "1" ? undefined : addDays(localDate(now), -1));
  let events = await listPublicEvents({ territory: territory ?? undefined, municipality: q.municipality, from, to: q.to, types: q.type, organizationId }, now);
  if (q.include_past !== "1") events = events.filter((e) => e.effective_status !== "realizada");

  let withDistance: (typeof events[number] & { distance_km?: number })[] = events;
  if (q.lat !== undefined && q.lon !== undefined) {
    const radius = q.radius ?? 25;
    withDistance = events
      .map((e) => ({ ...e, distance_km: Math.round(distanceKm(q.lat!, q.lon!, e.location.latitude, e.location.longitude) * 10) / 10 }))
      .filter((e) => e.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km);
  }

  return json(
    {
      events: withDistance,
      meta: {
        count: withDistance.length,
        generated_at: now.toISOString(),
        note: "Convocatorias públicas difundidas por organizaciones. La ubicación de convocatorias finalizadas o pendientes de verificar se muestra con precisión reducida.",
      },
    },
    { cache: q.lat !== undefined ? "none" : "public", maxAge: 60 },
  );
}
