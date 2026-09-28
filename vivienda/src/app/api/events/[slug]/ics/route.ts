import { getPublicEvent } from "@/server/events";
import { buildIcs } from "@/lib/ics";
import { absoluteUrl } from "@/lib/site";
import { error } from "@/server/http";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const now = new Date();
  const r = await getPublicEvent(slug, now);
  if (!r) return error(404, "Convocatoria no encontrada");
  const body = buildIcs(r.raw, r.event.location, {
    url: absoluteUrl(`/convocatorias/${slug}`),
    sourceUrl: r.event.source?.url ?? absoluteUrl(`/convocatorias/${slug}`),
    now,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
      "Cache-Control": "public, s-maxage=300",
    },
  });
}
