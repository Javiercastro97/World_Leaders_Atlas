// Presets de animación "mala a propósito" que episode.json aplica a cualquier id.
import type { AnimationSpec } from "./types";
import { FPS, quant, rs } from "./motion";

export interface Delta {
  dx: number;
  dy: number;
  rot: number;
  sx: number;
  sy: number;
  opacity: number;
  hidden: boolean;
}

export const NO_DELTA: Delta = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, opacity: 1, hidden: false };

/** Tiempo cuantizado a "doses" (12 fps efectivos: stop-motion). */
const on2s = (t: number) => Math.floor(t * FPS / 2) * 2 / FPS;

export function evalAnimations(anims: AnimationSpec[] | undefined, id: string | undefined, t: number): Delta {
  const d = { ...NO_DELTA };
  if (!id || !anims) return d;
  for (const a of anims) {
    if (a.target !== id) continue;
    const at = a.at ?? 0;
    const dur = a.dur ?? 0.25;
    const local = t - at;
    switch (a.preset) {
      case "fall": {
        if (local < 0) break;
        const tau = on2s(local);
        d.dy += 0.5 * (a.amount ?? 5200) * tau * tau;
        d.rot += tau * 160 * (rs(id, "fallrot") > 0 ? 1 : -1);
        break;
      }
      case "drop_in":
        if (local < 0) d.hidden = true;
        else d.dy -= (a.amount ?? 700) * (1 - quant(local / dur, 3));
        break;
      case "pop_in": {
        if (local < 0) {
          d.hidden = true;
          break;
        }
        const f = Math.floor(local * FPS);
        const s = f < 2 ? 1.35 : f < 4 ? 0.88 : 1;
        d.sx *= s;
        d.sy *= s;
        break;
      }
      case "slide_in_left":
      case "slide_in_right": {
        if (local < 0) {
          d.hidden = true;
          break;
        }
        const dir = a.preset === "slide_in_left" ? -1 : 1;
        d.dx += dir * (a.amount ?? 900) * (1 - quant(local / dur, 2));
        break;
      }
      case "shake":
        if (local >= 0 && local < dur) {
          const k = Math.floor(local * FPS / 2);
          d.dx += rs(id, k, "sx") * (a.amount ?? 12);
          d.dy += rs(id, k, "sy") * (a.amount ?? 12);
        }
        break;
      case "squash": {
        // squash & stretch deliberadamente torpe: 3 poses y fuera
        if (local < 0) break;
        const f = Math.floor(local * FPS);
        const k = a.amount ?? 0.22;
        if (f < 3) {
          d.sx *= 1 + k;
          d.sy *= 1 - k;
        } else if (f < 5) {
          d.sx *= 1 - k * 0.5;
          d.sy *= 1 + k * 0.5;
        }
        break;
      }
      case "flicker":
        if (local >= 0 && local < dur) d.opacity *= rs(id, Math.floor(local * FPS / 2), "fl") > 0 ? 1 : 0.15;
        break;
      case "wobble":
        if (local >= 0 && local < dur) d.rot += (Math.floor(local * FPS / 4) % 2 ? 1 : -1) * (a.amount ?? 4);
        break;
    }
  }
  return d;
}
