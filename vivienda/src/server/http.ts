import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ZodError } from "zod";
import { clientHash, clientIp, rateLimit, RATE_RULES, type RateRule } from "@/lib/antispam";

export function json(data: unknown, init: { status?: number; cache?: "public" | "none"; maxAge?: number; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.cache === "public") {
    const age = init.maxAge ?? 60;
    headers["Cache-Control"] = `public, s-maxage=${age}, stale-while-revalidate=${age * 5}`;
    // Datos públicos: reutilizables por terceros (periodistas, otras herramientas).
    headers["Access-Control-Allow-Origin"] = "*";
  } else {
    headers["Cache-Control"] = "no-store";
  }
  return NextResponse.json(data, { status: init.status ?? 200, headers });
}

export function zodError(e: ZodError) {
  return json(
    { error: "validation", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
    { status: 400 },
  );
}

export function error(status: number, message: string, extra: Record<string, unknown> = {}) {
  return json({ error: message, ...extra }, { status });
}

export function guardRate(req: Request, bucket: keyof typeof RATE_RULES | RateRule, name = "api") {
  const hash = clientHash(clientIp(req.headers));
  const rule = typeof bucket === "string" ? RATE_RULES[bucket] : bucket;
  const r = rateLimit(`${name}:${hash}`, rule);
  return { hash, ...r };
}

export function tooMany(retryAfterSec: number) {
  return json({ error: "Demasiadas peticiones. Inténtalo más tarde." }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });
}

// ---------------------------------------------------------------------------
// Autenticación de moderación (token compartido; la cookie guarda un HMAC, no el token)

export const MOD_COOKIE = "mod_session";

function modSecret(): string | null {
  return process.env.MODERATION_TOKEN || null;
}

export function sessionValue(token: string): string {
  return createHmac("sha256", token).update("moderation-session-v1").digest("base64url");
}

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkModeratorToken(token: string): boolean {
  const s = modSecret();
  return Boolean(s) && safeEq(token, s!);
}

export function isModerator(req: Request): boolean {
  const s = modSecret();
  if (!s) return false;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && safeEq(auth.slice(7), s)) return true;
  const cookie = req.headers.get("cookie") ?? "";
  const m = new RegExp(`${MOD_COOKIE}=([^;]+)`).exec(cookie);
  if (!m || !safeEq(decodeURIComponent(m[1]), sessionValue(s))) return false;
  // Sesión por cookie: las escrituras deben venir de nuestro propio origen (defensa CSRF además de SameSite=Strict).
  if (req.method !== "GET") {
    const origin = req.headers.get("origin") ?? req.headers.get("referer");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!origin || !host) return false;
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function isModeratorCookie(value: string | undefined): boolean {
  const s = modSecret();
  return Boolean(s && value && safeEq(value, sessionValue(s)));
}
