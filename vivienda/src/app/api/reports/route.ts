import { NextResponse } from "next/server";
import { createReport, readBody } from "@/server/submissions";
import { guardRate, json, tooMany } from "@/server/http";

/** POST /api/reports — solicitud de corrección o retirada de información. */
export async function POST(req: Request) {
  const rl = guardRate(req, "report", "report");
  if (!rl.allowed) return tooMany(rl.retryAfterSec);
  const { body, isForm } = await readBody(req);
  const r = await createReport(body, rl.hash);
  if (isForm) {
    return NextResponse.redirect(new URL(r.ok ? "/reportar?enviado=1" : `/reportar?error=${encodeURIComponent(r.error)}`, req.url), 303);
  }
  if (!r.ok) return json({ error: r.error, issues: r.issues }, { status: r.status });
  return json({ id: r.value.id, status: "open" }, { status: 201 });
}
