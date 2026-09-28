import { NextResponse } from "next/server";
import { checkModeratorToken, guardRate, json, MOD_COOKIE, sessionValue, tooMany } from "@/server/http";

export async function POST(req: Request) {
  const rl = guardRate(req, { limit: 10, windowMs: 15 * 60_000 }, "login");
  if (!rl.allowed) return tooMany(rl.retryAfterSec);
  const fd = await req.formData().catch(() => null);
  const token = String(fd?.get("token") ?? "");
  if (!checkModeratorToken(token)) return NextResponse.redirect(new URL("/moderacion?error=1", req.url), 303);
  const res = NextResponse.redirect(new URL("/moderacion", req.url), 303);
  res.cookies.set(MOD_COOKIE, sessionValue(token), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 3600,
  });
  return res;
}

export async function DELETE() {
  const res = json({ ok: true });
  res.cookies.delete(MOD_COOKIE);
  return res;
}
