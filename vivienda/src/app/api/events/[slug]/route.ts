import { getPublicEvent } from "@/server/events";
import { error, json } from "@/server/http";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const r = await getPublicEvent(slug);
  if (!r) return error(404, "Convocatoria no encontrada");
  return json({ event: r.event }, { cache: "public", maxAge: 60 });
}
