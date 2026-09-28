import { NextResponse } from "next/server";
import { readBody, resolveReport } from "@/server/submissions";
import { error, isModerator, json } from "@/server/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isModerator(req)) return error(401, "No autorizado");
  const { id } = await ctx.params;
  const { body, isForm } = await readBody(req);
  const b = (body ?? {}) as { action?: string; note?: string };
  if (b.action !== "resolve" && b.action !== "dismiss") return error(400, "Acción no válida");
  const r = await resolveReport(id, b.action, b.note || undefined, "moderación");
  if (isForm) return NextResponse.redirect(new URL(`/moderacion${r.ok ? "" : `?error=${encodeURIComponent(r.error)}`}#reportes`, req.url), 303);
  if (!r.ok) return json({ error: r.error }, { status: r.status });
  return json({ ok: true });
}
