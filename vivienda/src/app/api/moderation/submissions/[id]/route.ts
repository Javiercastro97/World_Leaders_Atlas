import { NextResponse } from "next/server";
import { moderateSubmission, readBody } from "@/server/submissions";
import { error, isModerator, json } from "@/server/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isModerator(req)) return error(401, "No autorizado");
  const { id } = await ctx.params;
  const { body, isForm } = await readBody(req);
  const clean = isForm ? normalizeForm(body as Record<string, string>) : body;
  const r = await moderateSubmission(id, clean, "moderación");
  if (isForm) return NextResponse.redirect(new URL(`/moderacion${r.ok ? "" : `?error=${encodeURIComponent(r.error)}`}#s-${id}`, req.url), 303);
  if (!r.ok) return json({ error: r.error, issues: r.issues }, { status: r.status });
  return json({ submission: r.value });
}

function normalizeForm(o: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === "") continue;
    out[k] = k === "latitude" || k === "longitude" ? Number(v.replace(",", ".")) : v;
  }
  return out;
}
