import { NextResponse } from "next/server";
import { moderateEvent, readBody } from "@/server/submissions";
import { error, isModerator, json } from "@/server/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isModerator(req)) return error(401, "No autorizado");
  const { id } = await ctx.params;
  const { body, isForm } = await readBody(req);
  const r = await moderateEvent(id, (body ?? {}) as Record<string, string>, "moderación");
  if (isForm) return NextResponse.redirect(new URL(`/moderacion${r.ok ? "" : `?error=${encodeURIComponent(r.error)}`}#eventos`, req.url), 303);
  if (!r.ok) return json({ error: r.error }, { status: r.status });
  return json({ ok: true });
}
