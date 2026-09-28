// Cabecera/cierre de la serie: letras recortadas de revistas distintas (anónimo de secuestro),
// pegadas sobre papel. Cada letra con su fuente, su papel y su torcedura.

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONT_MARKER, FONT_SUB, INK, PAPER } from "../engine/look";
import { boilIndex, hash, rs } from "../engine/motion";

const FONTS = [
  FONT_SUB,
  "'DejaVu Serif', Georgia, serif",
  FONT_MARKER,
  "'Liberation Mono', 'Courier New', monospace",
  "'DejaVu Sans', Verdana, sans-serif",
];
const PAPERS = ["#fffdf6", "#ffe14d", "#111", "#e8e1cf", "#d81f1a", "#fffdf6", "#9fd3e6"];

const Letter: React.FC<{ ch: string; i: number; row: number; size: number }> = ({ ch, i, row, size }) => {
  const frame = useCurrentFrame();
  const s = hash(ch, i, row);
  const paper = PAPERS[s % PAPERS.length];
  const dark = paper === "#111" || paper === "#d81f1a";
  const b = boilIndex(frame, 3);
  const rot = rs(s, "r") * 9 + rs(s, b, "rb") * 0.8;
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: FONTS[s % FONTS.length],
        fontWeight: s % 3 === 0 ? 700 : 400,
        fontSize: size * (0.86 + (s % 5) * 0.06),
        lineHeight: 1,
        background: paper,
        color: dark ? "#fffdf6" : INK,
        padding: `${6 + (s % 4) * 2}px ${7 + (s % 3) * 2}px`,
        margin: "0 3px",
        transform: `rotate(${rot}deg) translateY(${rs(s, "y") * 10}px)`,
        boxShadow: "6px 7px 0 rgba(0,0,0,0.35)",
      }}
    >
      {ch}
    </span>
  );
};

export const SeriesLogo: React.FC<{ props?: Record<string, unknown> }> = ({ props }) => {
  const lines = (props?.lines as string[]) ?? ["PENSAMIENTOS", "INTRUSIVOS"];
  const stamp = (props?.stamp as string) ?? "";
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 34, alignItems: "center", transform: "rotate(-3deg)" }}>
        {lines.map((line, row) => (
          <div key={row} style={{ whiteSpace: "nowrap" }}>
            {[...line].map((ch, i) => (
              <Letter key={i} ch={ch} i={i} row={row} size={row === 0 ? 92 : 112} />
            ))}
          </div>
        ))}
        {stamp && (
          <div
            style={{
              marginTop: 40,
              fontFamily: FONT_MARKER,
              fontSize: 48,
              color: "#d81f1a",
              border: "6px solid #d81f1a",
              padding: "4px 22px",
              transform: "rotate(7deg)",
              opacity: 0.9,
            }}
          >
            {stamp}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** Fondo de papel de cuaderno (cuadrícula de fotocopia). */
export const PaperSet: React.FC = () => (
  <g>
    <rect x={-700} y={-700} width={2480} height={3320} fill={PAPER} />
    {Array.from({ length: 70 }, (_, i) => (
      <path key={i} d={`M-700,${-700 + i * 48} H1780`} stroke="#9fc2d8" strokeWidth={2} opacity={0.6} />
    ))}
    <path d="M150,-700 V2620" stroke="#e59090" strokeWidth={3} />
  </g>
);

export const BlackSet: React.FC = () => <rect x={-700} y={-700} width={2480} height={3320} fill="#0b0a09" />;
