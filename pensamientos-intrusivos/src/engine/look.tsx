// La "textura" de la serie: rotulador, recorte con tijera, fotocopia.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { boilIndex, H, hash, rs, W } from "./motion";

export const INK = "#161412";
export const PAPER = "#f4efe3";
export const CUT_BORDER = "#fbf8ef";

export const FONT_SUB = "'Archivo Black', 'Arial Black', sans-serif";
export const FONT_MARKER = "'Permanent Marker', 'Comic Sans MS', cursive";

/**
 * Filtros SVG globales. `wob-0..2` = tembleque de línea a mano (se alterna cada
 * pocos frames: "boil"). Se montan una vez en la raíz del episodio.
 */
export const FilterDefs: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <defs>
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          <filter id={`wob-${i}`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={i * 7 + 3} />
            <feDisplacementMap in="SourceGraphic" scale={7} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id={`wobS-${i}`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves={1} seed={i * 11 + 5} />
            <feDisplacementMap in="SourceGraphic" scale={4} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </React.Fragment>
      ))}
    </defs>
  </svg>
);

/** Filtro de tembleque para el frame actual. strong=false para fondos grandes. */
export function useWobble(strong = true, every = 3): string {
  const frame = useCurrentFrame();
  return `url(#${strong ? "wob" : "wobS"}-${boilIndex(frame, every) % 3})`;
}

// ---------- geometría de rotulador ----------

export type P = [number, number];

/** Convierte puntos en un trazo suave con imperfecciones deterministas. */
export function scribble(points: P[], seed: number | string, jit = 4, closed = false): string {
  const pts = points.map(([x, y], i) => [x + rs(seed, i, "a") * jit, y + rs(seed, i, "b") * jit] as P);
  if (closed) pts.push(pts[0], pts[1]);
  if (pts.length < 3) return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]}`;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L${l[0].toFixed(1)},${l[1].toFixed(1)}`;
}

/** Elipse dibujada "de un tirón" que no cierra bien y se pasa de vueltas. */
export function wobblyEllipse(cx: number, cy: number, rx: number, ry: number, seed: number | string, turns = 1.15, n = 22): P[] {
  const start = rs(seed, "st") * Math.PI;
  const pts: P[] = [];
  for (let i = 0; i <= n * turns; i++) {
    const a = start + (i / n) * Math.PI * 2;
    const k = 1 + rs(seed, i, "r") * 0.06 + (i / n) * 0.05;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

// primitivas para siluetas recortadas
export const capsule = (x: number, y: number, w: number, h: number) => {
  const r = w / 2;
  return `M${x},${y + r} A${r},${r} 0 0 1 ${x + w},${y + r} L${x + w},${y + h - r} A${r},${r} 0 0 1 ${x},${y + h - r} Z`;
};
export const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;
export const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx},${cy} A${rx},${ry} 0 1 0 ${cx + rx},${cy} A${rx},${ry} 0 1 0 ${cx - rx},${cy} Z`;
/** Polígono "a tijera": los vértices se desplazan un poco. */
export const snip = (pts: P[], seed: number | string, jit = 3) =>
  "M" + pts.map(([x, y], i) => `${(x + rs(seed, i, "sx") * jit).toFixed(1)},${(y + rs(seed, i, "sy") * jit).toFixed(1)}`).join(" L") + " Z";

export interface Shape {
  d: string;
  fill?: string;
  /** transform SVG opcional para esta pieza (p. ej. rotate de un dedo) */
  tf?: string;
}

/**
 * RECORTE: une varias formas en una silueta con contorno de rotulador,
 * borde blanco de tijera y sombra dura (sin desenfoque: sombra de collage).
 */
export const Cutout: React.FC<{
  shapes: Shape[];
  fill?: string;
  outline?: number;
  border?: number;
  shadow?: [number, number] | null;
  children?: React.ReactNode; // detalles dibujados encima (arrugas, uñas…)
  wobble?: boolean;
}> = ({ shapes, fill = "#ddd", outline = 5, border = 9, shadow = [10, 12], children, wobble = true }) => {
  const filter = useWobble(true);
  const paths = (style: React.SVGProps<SVGPathElement>, own: boolean) =>
    shapes.map((s, i) => <path key={i} d={s.d} transform={s.tf} {...style} fill={own ? s.fill ?? fill : style.fill} />);
  return (
    <g filter={wobble ? filter : undefined}>
      {shadow && (
        <g transform={`translate(${shadow[0]},${shadow[1]})`} opacity={0.28}>
          {paths({ fill: "#000", stroke: "#000", strokeWidth: (outline + border) * 2, strokeLinejoin: "round" }, false)}
        </g>
      )}
      {border > 0 && paths({ fill: CUT_BORDER, stroke: CUT_BORDER, strokeWidth: (outline + border) * 2, strokeLinejoin: "round" }, false)}
      {paths({ fill: INK, stroke: INK, strokeWidth: outline * 2, strokeLinejoin: "round" }, false)}
      {paths({ stroke: "none" }, true)}
      <g fill="none" stroke={INK} strokeWidth={outline * 0.8} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </g>
  );
};

/** Trama de semitono (fotocopia de periódico) para rellenar recortes "fotográficos". */
export const HalftoneDefs: React.FC<{ id: string; color?: string; size?: number; opacity?: number }> = ({
  id,
  color = "#000",
  size = 9,
  opacity = 0.25,
}) => (
  <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
    <circle cx={size / 2} cy={size / 2} r={size * 0.28} fill={color} opacity={opacity} />
  </pattern>
);

/**
 * Grano de fotocopia + ligera deriva del encuadre cada 2 frames (stop-motion).
 * Es lo último que se pinta.
 */
export const PhotocopyGrain: React.FC<{ strength?: number }> = ({ strength = 0.22 }) => {
  const frame = useCurrentFrame();
  const k = Math.floor(frame / 2) % 6;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "multiply", opacity: strength }}>
      <svg width={W} height={H}>
        <filter id={`grain-${k}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={k * 13 + 1} stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.42  0 0 0 0 0.38  0 0 0 -1.6 1.25" />
        </filter>
        <rect width={W} height={H} filter={`url(#grain-${k})`} />
        {/* motas de fotocopiadora sucia, siempre en el mismo sitio */}
        {Array.from({ length: 26 }, (_, i) => (
          <circle
            key={i}
            cx={(hash("mota", i) % 1000) * 1.08}
            cy={(hash("motay", i) % 1000) * 1.92}
            r={1 + (hash("motar", i) % 4)}
            fill="#2a2520"
            opacity={0.5}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/** Deriva del encuadre (gate weave de cámara barata), en px. */
export function gateWeave(frame: number, amp = 2.2): [number, number] {
  const k = Math.floor(frame / 2);
  return [rs("gw", k, "x") * amp, rs("gw", k, "y") * amp];
}
