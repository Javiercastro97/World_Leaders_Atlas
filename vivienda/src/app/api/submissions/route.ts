import { NextResponse } from "next/server";
import { createSubmission, readBody } from "@/server/submissions";
import { guardRate, json, tooMany } from "@/server/http";

/** POST /api/submissions — "Avisa de una convocatoria". Nunca publica: crea un envío en estado `submitted`. */
export async function POST(req: Request) {
  const rl = guardRate(req, "submission", "submission");
  if (!rl.allowed) return tooMany(rl.retryAfterSec);
  const { body, isForm } = await readBody(req);
  const r = await createSubmission(body, rl.hash);
  if (isForm) {
    const url = new URL(r.ok ? "/avisa/gracias" : `/avisa?error=${encodeURIComponent(r.error)}`, req.url);
    return NextResponse.redirect(url, 303);
  }
  if (!r.ok) return json({ error: r.error, issues: r.issues }, { status: r.status });
  return json({ id: r.value.id, status: "submitted", privacy_flags: r.value.privacy_flags }, { status: 201 });
}
