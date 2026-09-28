// Cámara POV: la cámara SON los ojos del personaje.
// Movimientos disparables desde episode.json (scene.camera[]).
// Todo a saltos: un paneo son 2–3 poses, un zoom son 1–4 poses.

import type { CameraMove } from "./types";
import { FPS, H, quant, rs, W } from "./motion";

export interface CameraState {
  cx: number; // punto del mundo en el centro de pantalla
  cy: number;
  zoom: number;
  rot: number; // grados
  shakeX: number; // px de pantalla
  shakeY: number;
}

export const REST: CameraState = { cx: W / 2, cy: H / 2, zoom: 1, rot: 0, shakeX: 0, shakeY: 0 };

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Progreso a saltos de un movimiento que empieza en `at` y dura `dur`. */
function stepped(t: number, at: number, dur: number, steps: number): number {
  if (t < at) return 0;
  if (dur <= 0) return 1;
  return quant((t - at) / dur, steps);
}

function look(s: CameraState, m: CameraMove, t: number, dx: number, dy: number): CameraState {
  const at = m.at ?? 0;
  const amount = m.amount ?? 260;
  const steps = m.steps ?? 2;
  let p = stepped(t, at, m.dur ?? 0.2, steps);
  if (m.returnAt !== undefined && t >= m.returnAt) p = 1 - stepped(t, m.returnAt, m.dur ?? 0.2, steps);
  return { ...s, cx: s.cx + dx * amount * p, cy: s.cy + dy * amount * p };
}

function shake(s: CameraState, m: CameraMove, t: number, amp: number, every: number, rotAmp: number): CameraState {
  const at = m.at ?? 0;
  if (t < at || (m.until !== undefined && t >= m.until)) return s;
  const k = Math.floor((t * FPS) / every);
  return {
    ...s,
    shakeX: s.shakeX + rs(m.move, k, "x") * amp,
    shakeY: s.shakeY + rs(m.move, k, "y") * amp,
    rot: s.rot + rs(m.move, k, "r") * rotAmp,
  };
}

/** Aplica la lista de movimientos en orden, en el segundo `t` de la escena. */
export function evalCamera(moves: CameraMove[] | undefined, t: number): CameraState {
  let s: CameraState = { ...REST };
  for (const m of moves ?? []) {
    const at = m.at ?? 0;
    switch (m.move) {
      case "POV_LOOK_LEFT":
        s = look(s, m, t, -1, 0);
        break;
      case "POV_LOOK_RIGHT":
        s = look(s, m, t, 1, 0);
        break;
      case "POV_LOOK_DOWN":
        s = look(s, m, t, 0, 1);
        break;
      case "POV_LOOK_UP":
        s = look(s, m, t, 0, -1);
        break;
      case "POV_MICRO_SHAKE":
        s = shake(s, m, t, m.amount ?? 3, 3, 0.15);
        break;
      case "POV_PANIC":
        s = shake(s, m, t, m.amount ?? 34, 2, 3.5);
        break;
      case "POV_SNAP_ZOOM":
      case "POV_SLOW_APPROACH": {
        const slow = m.move === "POV_SLOW_APPROACH";
        const dur = m.dur ?? (slow ? 2 : 0);
        const steps = m.steps ?? (slow ? Math.max(2, Math.round(dur * 5)) : 1);
        let p = stepped(t, at, dur, steps);
        if (m.returnAt !== undefined && t >= m.returnAt) p = 0; // corte seco de vuelta
        const [tx, ty] = m.target ?? [s.cx, s.cy];
        const z = m.zoom ?? (slow ? 1.6 : 3);
        s = { ...s, cx: lerp(s.cx, tx, p), cy: lerp(s.cy, ty, p), zoom: lerp(s.zoom, z, p) };
        break;
      }
      case "POV_DOUBLE_TAKE": {
        // mira a un lado, vuelve, y "¿¡QUÉ!?": vuelve a mirar con zoom de golpe
        const dir = m.direction === "left" ? -1 : 1;
        const amount = m.amount ?? 320;
        const [tx, ty] = m.target ?? [s.cx, s.cy];
        if (t >= at && t < at + 0.35) s = { ...s, cx: s.cx + dir * amount };
        else if (t >= at + 0.55) {
          const z = m.zoom ?? 1.5;
          const hold = m.until === undefined || t < m.until;
          if (hold) s = { ...s, cx: tx, cy: ty, zoom: s.zoom * z, rot: s.rot + dir * -2 };
        }
        break;
      }
      case "POV_FREEZE":
        // la congelación la resuelve la escena (congela el tiempo visual)
        break;
    }
  }
  return s;
}

/** Ventana de freeze activa en `t` → devuelve el segundo congelado, o null. */
export function freezeAt(moves: CameraMove[] | undefined, t: number): number | null {
  for (const m of moves ?? []) {
    if (m.move !== "POV_FREEZE") continue;
    const at = m.at ?? 0;
    const until = m.until ?? at + (m.dur ?? 1);
    if (t >= at && t < until) return at;
  }
  return null;
}

/** transform CSS para la capa de mundo. */
export function cameraTransform(c: CameraState): string {
  return `translate(${W / 2 + c.shakeX}px, ${H / 2 + c.shakeY}px) rotate(${c.rot}deg) scale(${c.zoom}) translate(${-c.cx}px, ${-c.cy}px)`;
}
