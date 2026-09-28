// CAPA DE PENSAMIENTO INTRUSIVO: garabatos de rotulador que "ensucian" la realidad.
// Cada aparición tiene su propia semilla → nunca dos garabatos idénticos.
// Se "dibujan" a saltos (3–4 poses) y tiemblan (boil) mientras están en pantalla.

import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { FONT_MARKER, INK, scribble, useWobble, wobblyEllipse, type P } from "./look";
import { boilIndex, FPS, hash, quant, rs } from "./motion";
import type { DoodleSpec } from "./types";

export const RED = "#d0241c";
export const HALO_YELLOW = "#f0b90b";

const Stroke: React.FC<{ d: string; p: number; color: string; w?: number; opacity?: number }> = ({ d, p, color, w = 10, opacity = 1 }) => (
  <path
    d={d}
    fill="none"
    stroke={color}
    strokeWidth={w}
    strokeLinecap="round"
    strokeLinejoin="round"
    pathLength={1}
    strokeDasharray="1 1"
    strokeDashoffset={1 - p}
    opacity={opacity}
  />
);

/** Texto a rotulador: cada letra algo torcida y descolocada. */
export const MarkerText: React.FC<{
  text: string;
  size: number;
  color: string;
  seed: number;
  reveal?: number; // 0..1, letras visibles
  anchor?: "start" | "middle";
}> = ({ text, size, color, seed, reveal = 1, anchor = "middle" }) => {
  const chars = [...text];
  const adv = size * 0.62;
  const x0 = anchor === "middle" ? (-(chars.length - 1) * adv) / 2 : 0;
  const shown = Math.ceil(chars.length * reveal);
  return (
    <g>
      {chars.slice(0, shown).map((c, i) => (
        <text
          key={i}
          x={x0 + i * adv + rs(seed, i, "dx") * size * 0.05}
          y={rs(seed, i, "dy") * size * 0.07}
          fontFamily={FONT_MARKER}
          fontSize={size * (1 + rs(seed, i, "s") * 0.08)}
          fill={color}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(${rs(seed, i, "r") * 7}, ${x0 + i * adv}, 0)`}
        >
          {c}
        </text>
      ))}
    </g>
  );
};

function arrowPath(from: P, to: P, seed: number): { shaft: string; head: string } {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const bow = len * 0.18 * (rs(seed, "bow") > 0 ? 1 : -1);
  const mid: P = [(x1 + x2) / 2 + nx * bow, (y1 + y2) / 2 + ny * bow];
  const shaft = scribble([from, [(x1 + mid[0]) / 2, (y1 + mid[1]) / 2], mid, [(mid[0] + x2) / 2, (mid[1] + y2) / 2], to], seed, 5);
  const ang = Math.atan2(y2 - mid[1], x2 - mid[0]);
  const hl = Math.min(60, len * 0.3);
  const a1 = ang + Math.PI * (0.82 + rs(seed, "h1") * 0.05);
  const a2 = ang - Math.PI * (0.82 + rs(seed, "h2") * 0.05);
  const head = `M${x2 + Math.cos(a1) * hl},${y2 + Math.sin(a1) * hl} L${x2},${y2} L${x2 + Math.cos(a2) * hl},${y2 + Math.sin(a2) * hl}`;
  return { shaft, head };
}

const DoodleBody: React.FC<{ spec: DoodleSpec; t: number; dir: string }> = ({ spec, t, dir }) => {
  const frame = useCurrentFrame();
  const seed = spec.seed ?? hash(spec.type, spec.x, spec.y, spec.at ?? 0);
  const color = spec.color ?? (spec.type === "DOODLE_DEVIL" ? RED : spec.type === "DOODLE_HALO" ? HALO_YELLOW : INK);
  const local = t - (spec.at ?? 0);
  const drawDur = spec.draw ?? 0.25;
  const p = drawDur <= 0 ? 1 : quant(local / drawDur, 4);
  const w = spec.w ?? 200;
  const h = spec.h ?? w;
  const b = boilIndex(frame, 3);

  switch (spec.type) {
    case "DOODLE_CIRCLE": {
      const d = scribble(wobblyEllipse(0, 0, w / 2, h / 2, seed), seed, 3);
      return <Stroke d={d} p={p} color={color} w={11} />;
    }
    case "DOODLE_ARROW": {
      const to = spec.to ?? [spec.x + 150, spec.y + 150];
      const { shaft, head } = arrowPath([0, 0], [to[0] - spec.x, to[1] - spec.y], seed);
      return (
        <g>
          <Stroke d={shaft} p={p} color={color} />
          {p >= 1 && <Stroke d={head} p={1} color={color} />}
          {spec.text && (
            <g transform={`translate(0, ${-(spec.size ?? 70) * 0.7})`}>
              <MarkerText text={spec.text} size={spec.size ?? 70} color={color} seed={seed} reveal={p} />
            </g>
          )}
        </g>
      );
    }
    case "DOODLE_TEXT": {
      const size = spec.size ?? 110;
      const text = spec.text ?? "¿?";
      const ul = scribble(
        [[-text.length * size * 0.33, size * 0.62], [0, size * 0.55 + rs(seed, "u") * 10], [text.length * size * 0.33, size * 0.66]],
        seed,
        6,
      );
      return (
        <g>
          <MarkerText text={text} size={size} color={color} seed={seed} reveal={p} />
          {p >= 1 && <Stroke d={ul} p={quant((local - drawDur) / 0.15, 2)} color={color} w={9} />}
        </g>
      );
    }
    case "DOODLE_EYES": {
      // los ojos te miran… y cambian de sitio a saltos
      const k = Math.floor((t * FPS) / 8);
      const px = rs(seed, k, "px") * w * 0.08;
      const py = rs(seed, k, "py") * h * 0.08;
      const eye = (cx: number, i: number) => (
        <g key={i}>
          <path d={scribble(wobblyEllipse(cx, 0, w * 0.22, h * 0.3, seed + i, 1.05, 16), seed + i, 2)} fill="#fff" stroke={color} strokeWidth={8} />
          <circle cx={cx + px} cy={py} r={w * 0.08} fill={color} />
          {[-1, 0, 1].map((j) => (
            <path key={j} d={`M${cx + j * w * 0.1},${-h * 0.3} l${j * 8},-${h * 0.14}`} stroke={color} strokeWidth={6} strokeLinecap="round" />
          ))}
        </g>
      );
      return p > 0 ? <g>{[eye(-w * 0.25, 0), eye(w * 0.25, 1)]}</g> : null;
    }
    case "DOODLE_SHAKE": {
      // líneas de temblor ( ) alrededor de algo
      const on = b % 2 === 0;
      const arc = (sx: number, r: number) =>
        `M${sx * (w / 2 + r)},${-h * 0.25} Q${sx * (w / 2 + r + 22)},0 ${sx * (w / 2 + r)},${h * 0.25}`;
      return (
        <g>
          {[0, 34, 68].map((r, i) =>
            [-1, 1].map((sx) => (on || i !== 2) && <Stroke key={`${i}${sx}`} d={arc(sx, r + (on ? 0 : 8))} p={p} color={color} w={8} />),
          )}
        </g>
      );
    }
    case "DOODLE_HALO": {
      const d = scribble(wobblyEllipse(0, 0, w / 2, w * 0.14, seed, 1.1), seed, 2);
      return (
        <g>
          <Stroke d={d} p={p} color={color} w={12} />
          {p >= 1 &&
            [0, 1, 2, 3].map((i) => {
              const a = -Math.PI * (0.15 + i * 0.23);
              const r1 = w * 0.62, r2 = w * 0.78;
              return (
                (b + i) % 3 !== 0 && (
                  <path key={i} d={`M${Math.cos(a) * r1},${Math.sin(a) * r1 * 0.5} L${Math.cos(a) * r2},${Math.sin(a) * r2 * 0.5}`} stroke={color} strokeWidth={7} strokeLinecap="round" />
                )
              );
            })}
        </g>
      );
    }
    case "DOODLE_DEVIL": {
      const s = w / 200;
      const bob = (Math.floor((t * FPS) / 6) % 2) * 8;
      return p > 0 ? (
        <g transform={`translate(0,${bob}) scale(${s})`} stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={scribble(wobblyEllipse(0, 0, 70, 78, seed, 1.08, 16), seed, 3)} fill="#fff" />
          <path d="M-50,-50 L-68,-118 L-22,-70" fill={color} />
          <path d="M50,-50 L68,-118 L22,-70" fill={color} />
          <path d="M-38,-18 l22,12 M38,-18 l-22,12" />
          <path d="M-40,22 Q0,62 40,22" />
          <path d="M-18,34 l6,14 l6,-12 M8,36 l6,12 l5,-14" strokeWidth={5} />
          {/* tridente */}
          <path d="M92,120 L130,-40 M108,-44 q22,-30 44,4 M130,-40 l0,-44" />
        </g>
      ) : null;
    }
    case "DOODLE_QUESTION": {
      const n = 3;
      return (
        <g>
          {Array.from({ length: n }, (_, i) => {
            const vis = p * n > i;
            const x = (i - 1) * w * 0.55 + rs(seed, i, "qx") * 20;
            const y = rs(seed, i, "qy") * 40 - (i === 1 ? 40 : 0);
            return (
              vis && (
                <g key={i} transform={`translate(${x},${y}) rotate(${rs(seed, i, b % 2, "qr") * 10})`}>
                  <MarkerText text="?" size={(spec.size ?? 150) * (i === 1 ? 1.25 : 0.9)} color={color} seed={seed + i} />
                </g>
              )
            );
          })}
        </g>
      );
    }
    case "DOODLE_TARGET": {
      const rot = (b % 4) * 4;
      return (
        <g transform={`rotate(${rot})`}>
          {[1, 0.66, 0.33].map((k, i) => (
            <Stroke key={i} d={scribble(wobblyEllipse(0, 0, (w / 2) * k, (h / 2) * k, seed + i, 1.05, 18), seed + i, 2)} p={p} color={color} w={9} />
          ))}
          {p >= 1 && <path d={`M${-w * 0.62},0 H${w * 0.62} M0,${-h * 0.62} V${h * 0.62}`} stroke={color} strokeWidth={7} strokeLinecap="round" />}
        </g>
      );
    }
    case "DOODLE_IMAGE":
      return spec.src ? (
        <foreignObject x={-w / 2} y={-h / 2} width={w} height={h}>
          <Img src={staticFile(`${dir}/${spec.src}`)} style={{ width: w, height: h, objectFit: "contain" }} />
        </foreignObject>
      ) : null;
  }
  return null;
};

/** Renderiza un garabato (en coordenadas de la capa donde se monte). */
export const Doodle: React.FC<{ spec: DoodleSpec; t: number; dir: string }> = ({ spec, t, dir }) => {
  const filter = useWobble(true);
  const frame = useCurrentFrame();
  if (spec.at !== undefined && t < spec.at) return null;
  if (spec.until !== undefined && t >= spec.until) return null;
  const wig = spec.wiggle ?? 0;
  const jx = wig ? rs("wig", spec.x, Math.floor(frame / 2), "x") * wig : 0;
  const jy = wig ? rs("wig", spec.y, Math.floor(frame / 2), "y") * wig : 0;
  return (
    <g transform={`translate(${spec.x + jx},${spec.y + jy}) rotate(${spec.rot ?? 0}) scale(${spec.scale ?? 1})`} filter={filter}>
      <DoodleBody spec={spec} t={t} dir={dir} />
    </g>
  );
};
