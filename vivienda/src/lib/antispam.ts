/**
 * Anti-spam sin servicios de terceros ni cookies de seguimiento:
 *  - sello temporal firmado (HMAC) emitido al renderizar el formulario:
 *    rechaza envíos demasiado rápidos (<3 s, bots) o caducados (>2 h);
 *  - campo trampa ("website") que una persona no ve ni rellena;
 *  - limitación de frecuencia por hash diario de IP (la IP nunca se guarda).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const MIN_AGE_MS = 3_000;
const MAX_AGE_MS = 2 * 3600_000;

function secret(): string {
  const s = process.env.SUBMISSION_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("SUBMISSION_SECRET es obligatorio en producción");
    return "dev-only-secret";
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 32);
}

export function issueFormToken(now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(`form:${ts}`)}`;
}

export type TokenCheck = { ok: true } | { ok: false; reason: "malformed" | "signature" | "too_fast" | "expired" };

export function checkFormToken(token: string, now = Date.now()): TokenCheck {
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts)) return { ok: false, reason: "malformed" };
  const expected = sign(`form:${ts}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "signature" };
  const age = now - Number(ts);
  if (age < MIN_AGE_MS) return { ok: false, reason: "too_fast" };
  if (age > MAX_AGE_MS) return { ok: false, reason: "expired" };
  return { ok: true };
}

/** Hash de cliente que rota cada día: no permite reconstruir la IP ni seguir a nadie entre días. */
export function clientHash(ip: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return createHmac("sha256", secret()).update(`${day}|${ip}`).digest("hex").slice(0, 24);
}

// ---------------------------------------------------------------------------
// Rate limiting en memoria (ventana deslizante). En despliegues con varias instancias,
// el repositorio Postgres añade un segundo control contando envíos por client_hash.

const buckets = new Map<string, number[]>();

export interface RateRule {
  limit: number;
  windowMs: number;
}

export const RATE_RULES = {
  submission: { limit: 5, windowMs: 3600_000 },
  report: { limit: 10, windowMs: 3600_000 },
  api: { limit: 120, windowMs: 60_000 },
} satisfies Record<string, RateRule>;

export function rateLimit(key: string, rule: RateRule, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < rule.windowMs);
  if (hits.length >= rule.limit) {
    buckets.set(key, hits);
    return { allowed: false, retryAfterSec: Math.ceil((rule.windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    // Poda defensiva para no crecer sin límite.
    for (const [k, v] of buckets) if (!v.some((t) => now - t < rule.windowMs)) buckets.delete(k);
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "0.0.0.0"
  );
}
