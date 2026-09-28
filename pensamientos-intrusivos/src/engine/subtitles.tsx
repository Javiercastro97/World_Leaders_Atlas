// SUBTÍTULOS: tira de papel recortada y pegada, letra grande de palo seco.
// Nada de karaoke palabra a palabra salvo que el gag lo pida (fx por palabra).
//
// Estilos:
//   thought  → pensamiento del protagonista (papel blanco)
//   shout    → alguien grita fuera de campo (papel amarillo, torcido, tiembla)
//   whisper  → pensamiento pequeñito (sin papel, gris)

import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT_SUB, INK, scribble, useWobble } from "./look";
import { FPS, hash, rs, SAFE, W } from "./motion";
import type { SubtitleSpec, WordFx } from "./types";
import { RED } from "./doodles";

const PAPER_STRIP = "#fffdf6";
const SHOUT_PAPER = "#ffe14d";

const Word: React.FC<{ word: string; fx: WordFx[]; local: number; seed: number; size: number }> = ({ word, fx, local, seed, size }) => {
  const frame = useCurrentFrame();
  const style: React.CSSProperties = { display: "inline-block", position: "relative", whiteSpace: "pre" };
  const tf: string[] = [];
  if (fx.includes("grow")) tf.push(`scale(${local < 0.12 ? 1.0 : local < 0.24 ? 1.25 : 1.45})`);
  if (fx.includes("tiny")) tf.push("scale(0.55)");
  if (fx.includes("tilt")) tf.push(`rotate(${-9 + rs(seed, "tilt") * 3}deg)`);
  if (fx.includes("shake")) {
    const k = Math.floor(frame / 2);
    tf.push(`translate(${rs(seed, k, "x") * size * 0.06}px, ${rs(seed, k, "y") * size * 0.06}px)`);
  }
  if (fx.includes("vanish") && local > 0.6) style.opacity = local > 0.8 ? 0 : 0.35;
  if (tf.length) {
    style.transform = tf.join(" ");
    style.transformOrigin = "50% 60%";
    style.margin = fx.includes("grow") ? `0 ${size * 0.22}px` : undefined;
  }
  if (fx.includes("grow")) style.color = RED;
  return (
    <span style={style}>
      {word}
      {fx.includes("strike") && local > 0.35 && (
        <svg style={{ position: "absolute", left: -8, top: "10%", overflow: "visible" }} width="110%" height="80%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={scribble([[0, 70], [50, 45], [100, 30]], seed, 4)} stroke={RED} strokeWidth={9} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {fx.includes("arrow") && (
        <svg style={{ position: "absolute", left: "30%", top: -size * 1.35, overflow: "visible" }} width={size} height={size * 1.2}>
          <path d={`M${size * 0.7},0 Q${size * 0.1},${size * 0.4} ${size * 0.35},${size * 1.05} M${size * 0.1},${size * 0.78} L${size * 0.35},${size * 1.05} L${size * 0.62},${size * 0.8}`} stroke={RED} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
};

export const Subtitle: React.FC<{ spec: SubtitleSpec; t: number; defaultY: number }> = ({ spec, t, defaultY }) => {
  const filter = useWobble(false, 4);
  const frame = useCurrentFrame();
  if (t < spec.at || t >= spec.until) return null;
  const local = t - spec.at;
  const style = spec.style ?? "thought";
  const seed = hash(spec.text, spec.at);
  const size = spec.size ?? (style === "shout" ? 84 : style === "whisper" ? 54 : 78);
  const words = spec.text.split(" ");
  const fxFor = (w: string): WordFx[] => {
    const clean = w.replace(/[¿?¡!.,…:;"]/g, "");
    const f = spec.words?.[clean] ?? spec.words?.[w];
    return f ? (Array.isArray(f) ? f : [f]) : [];
  };

  // el papel entra de golpe, torcido, y se asienta con un único salto
  const rot = spec.rot ?? rs(seed, "rot") * (style === "shout" ? 5 : 2.2);
  const settle = local < 1 / FPS * 2 ? 1.08 : 1;
  const shoutJit = style === "shout" ? [rs(seed, Math.floor(frame / 2), "sx") * 7, rs(seed, Math.floor(frame / 2), "sy") * 7] : [0, 0];
  const cx = spec.x ?? (SAFE.left + SAFE.right) / 2;
  const cy = spec.y ?? defaultY;
  const maxW = SAFE.right - SAFE.left - 20;

  const paper = style === "whisper" ? "transparent" : style === "shout" ? SHOUT_PAPER : PAPER_STRIP;
  // bordes de tijera: clip-path con vértices ligeramente irregulares
  const clip = `polygon(${[
    [rs(seed, 1) * 1.5 + 1, rs(seed, 2) * 4 + 5],
    [99 - rs(seed, 3) * 1.5, rs(seed, 4) * 4 + 3],
    [99 + rs(seed, 5) * 0.8, 96 - rs(seed, 6) * 4],
    [1 - rs(seed, 7) * 0.8, 97 + rs(seed, 8) * 2],
  ]
    .map(([x, y]) => `${x}% ${y}%`)
    .join(",")})`;

  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        width: maxW,
        transform: `translate(-50%, -50%) translate(${shoutJit[0]}px, ${shoutJit[1]}px) rotate(${rot}deg) scale(${settle})`,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ position: "relative", filter, maxWidth: maxW }}>
        {style !== "whisper" && (
          <>
            <div style={{ position: "absolute", inset: 0, transform: "translate(9px, 11px)", background: "rgba(0,0,0,0.3)", clipPath: clip }} />
            <div style={{ position: "absolute", inset: 0, background: paper, clipPath: clip }} />
            {/* celo */}
            <div
              style={{
                position: "absolute",
                top: -16,
                left: `${40 + rs(seed, "tape") * 12}%`,
                width: 130,
                height: 38,
                background: "rgba(236, 228, 196, 0.72)",
                transform: `rotate(${rs(seed, "tr") * 8 - 3}deg)`,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.06)",
              }}
            />
          </>
        )}
        <div
          style={{
            position: "relative",
            padding: style === "whisper" ? 0 : `${size * 0.26}px ${size * 0.42}px ${size * 0.3}px`,
            fontFamily: FONT_SUB,
            fontSize: size,
            lineHeight: 1.12,
            color: style === "whisper" ? "#fff" : INK,
            textAlign: "center",
            letterSpacing: "-0.01em",
            textShadow: style === "whisper" ? "0 0 3px #000, 3px 3px 0 #000" : undefined,
            maxWidth: W,
          }}
        >
          {words.map((w, i) => (
            <React.Fragment key={i}>
              <Word word={w} fx={fxFor(w)} local={local} seed={seed + i} size={size} />
              {i < words.length - 1 ? " " : ""}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
