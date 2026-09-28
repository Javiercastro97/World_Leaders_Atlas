// Lenguaje de movimiento de la serie: POCAS POSES, SALTOS, TEMBLORES.
// Aquí no hay easings bonitos a propósito.

import type { Key, Placed } from "./types";

export const FPS = 30;
export const W = 1080;
export const H = 1920;

/** Zonas seguras TikTok/Reels (px). Nada importante fuera de este rectángulo. */
export const SAFE = { top: 230, bottom: 1920 - 420, left: 70, right: 1080 - 170 };

/** Aleatorio determinista: mismo seed → mismo número, en cada render. */
export function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const p of parts.join("|")) {
    h ^= p.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rand(...parts: (string | number)[]): number {
  let t = (hash(...parts) + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** Rango simétrico [-1, 1]. */
export const rs = (...p: (string | number)[]) => rand(...p) * 2 - 1;

/**
 * "Boil": los dibujos a mano tiemblan porque cada frame se redibuja.
 * Devuelve un índice que cambia cada `every` frames (≈ animar "a doses/treses").
 */
export const boilIndex = (frame: number, every = 3) => Math.floor(frame / every);

/** Temblor escalonado (cambia cada `every` frames), en [-amp, amp]. */
export function jitter(frame: number, amp: number, salt: string | number, every = 2): [number, number] {
  const k = Math.floor(frame / every);
  return [rs(salt, k, "x") * amp, rs(salt, k, "y") * amp];
}

/** Cuantiza un progreso 0..1 en `steps` saltos (animación limitada). */
export const quant = (p: number, steps: number) =>
  steps <= 0 ? p : Math.min(1, Math.floor(Math.min(1, Math.max(0, p)) * steps + 1e-6) / steps);

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

type Numeric = "x" | "y" | "scale" | "sx" | "sy" | "rot" | "opacity";
const NUMERIC: Numeric[] = ["x", "y", "scale", "sx", "sy", "rot", "opacity"];

export interface Pose {
  x: number;
  y: number;
  scale: number;
  sx: number;
  sy: number;
  rot: number;
  opacity: number;
  pose?: string;
  visible: boolean;
}

/**
 * Evalúa un elemento colocado con keyframes en el segundo `t` de la escena.
 * - "step" (defecto): mantiene cada pose hasta el siguiente keyframe. Cortes secos.
 * - "jerk": pasa de una pose a otra en N saltos visibles (3 por defecto).
 * - "linear": disponible, pero úsalo casi nunca.
 */
export function evalPlaced(el: Placed & { pose?: string }, t: number): Pose {
  const base: Pose = {
    x: el.x,
    y: el.y,
    scale: el.scale ?? 1,
    sx: 1,
    sy: 1,
    rot: el.rot ?? 0,
    opacity: el.opacity ?? 1,
    pose: el.pose,
    visible: (el.at === undefined || t >= el.at) && (el.until === undefined || t < el.until),
  };
  const keys = el.keys;
  if (!keys || keys.length === 0) return base;

  // cada propiedad se sigue por separado: un key puede tocar solo "pose"
  const out = { ...base };
  const mode = el.ease ?? "step";
  for (const prop of NUMERIC) {
    const track = keys.filter((k) => k[prop] !== undefined);
    if (!track.length) continue;
    let prev: Key | undefined;
    let next: Key | undefined;
    for (const k of track) {
      if (k.t <= t) prev = k;
      else if (!next) next = k;
    }
    const pv = prev ? (prev[prop] as number) : (base[prop] as number);
    if (!prev && track[0].t > t) {
      out[prop] = base[prop];
      continue;
    }
    if (mode === "step" || !next) {
      out[prop] = pv;
    } else {
      const p = (t - prev!.t) / (next.t - prev!.t);
      const q = mode === "jerk" ? quant(p, el.jerkSteps ?? 3) : p;
      out[prop] = pv + ((next[prop] as number) - pv) * q;
    }
  }
  const poses = keys.filter((k) => k.pose !== undefined && k.t <= t);
  if (poses.length) out.pose = poses[poses.length - 1].pose;
  return out;
}

export const secToFrame = (s: number) => Math.round(s * FPS);
