// EP01 · Decorado "acto institucional" y props reutilizables (botón, objetos que caen…).
// Coordenadas de mundo: 1080x1920. El decorado desborda el cuadro para permitir
// miradas POV a los lados/abajo sin ver el "borde del mundo".

import React from "react";
import { useCurrentFrame } from "remotion";
import { Cutout, ellipse, FONT_MARKER, HalftoneDefs, INK, rrect, scribble, snip, useWobble } from "../engine/look";
import { MarkerText } from "../engine/doodles";
import { boilIndex, rs } from "../engine/motion";
import { Person } from "./people";

const CURTAIN_A = "#7a1a1f";
const CURTAIN_B = "#5e1217";

export const CeremonyHall: React.FC<{ t: number; props?: Record<string, unknown> }> = ({ props }) => {
  const soft = useWobble(false, 4);
  const banner = (props?.banner as string) ?? "ACTO SOLEMNE DE ALGO MUY IMPORTANTE";
  const folds = Array.from({ length: 16 }, (_, i) => i);
  return (
    <g>
      <defs>
        <HalftoneDefs id="ht-curtain" color="#000" size={10} opacity={0.22} />
        <HalftoneDefs id="ht-wood" color="#3b2412" size={8} opacity={0.2} />
      </defs>
      {/* telón: bandas verticales con pliegues a rotulador */}
      <g filter={soft}>
        <rect x={-700} y={-700} width={2480} height={1880} fill={CURTAIN_A} />
        {folds.map((i) => (
          <path
            key={i}
            d={`M${-640 + i * 150},-700 Q${-600 + i * 150 + rs("fold", i) * 20},300 ${-620 + i * 150},1180 L${-560 + i * 150},1180 Q${-570 + i * 150},300 ${-580 + i * 150},-700 Z`}
            fill={CURTAIN_B}
          />
        ))}
        <rect x={-700} y={-700} width={2480} height={1880} fill="url(#ht-curtain)" />
        {folds.map((i) => (
          <path key={`l${i}`} d={scribble([[-600 + i * 150, -700], [-590 + i * 150, 200], [-600 + i * 150, 1170]], `c${i}`, 6)} stroke="#2a0709" strokeWidth={5} fill="none" />
        ))}
        {/* bambalina festoneada */}
        <path
          d={`M-700,-700 H1780 V40 ${Array.from({ length: 14 }, (_, i) => `Q${1720 - i * 180 - 90},${150} ${1720 - (i + 1) * 180},40`).join(" ")} L-700,40 Z`}
          fill="#8c1d23"
          stroke={INK}
          strokeWidth={6}
        />
        <path d="M-700,20 H1780" stroke="#d9b44a" strokeWidth={10} strokeDasharray="30 14" />
      </g>

      {/* pancarta impresa en casa con WordArt */}
      <g transform="translate(560,372) rotate(-1.6)">
        <Cutout shapes={[{ d: snip([[-440, -52], [440, -58], [446, 48], [-438, 54]], "banner", 4), fill: "#fdfbf2" }]} outline={3} border={0} shadow={[6, 8]}>
          <text x={0} y={16} textAnchor="middle" fontFamily="'DejaVu Serif', Georgia, serif" fontWeight={700} fontSize={31} fill="#1d2f7a" stroke="none" letterSpacing={1}>
            {banner}
          </text>
        </Cutout>
      </g>

      {/* banderas: franjas roja-amarilla-roja, sin escudos (es un dibujo) */}
      {[150, 930].map((x, i) => (
        <g key={x} transform={`translate(${x},470) rotate(${i ? 3 : -3})`}>
          <Cutout
            shapes={[
              { d: rrect(-8, -40, 16, 680, 6), fill: "#caa24a" },
              { d: `M8,0 Q70,${-14 + i * 6} 150,4 L148,${170} Q70,${160 + i * 8} 8,176 Z`, fill: "#c8201e", tf: i ? "scale(-1,1)" : undefined },
              { d: `M8,44 Q70,${34 + i * 6} 149,48 L148,${128} Q70,${118 + i * 8} 8,132 Z`, fill: "#f2c318", tf: i ? "scale(-1,1)" : undefined },
            ]}
            outline={4}
            border={6}
            shadow={[6, 8]}
          />
        </g>
      ))}

      {/* mesa de presidencia al fondo, con dos señores muy serios */}
      <g transform="translate(265,760) scale(0.62)">
        <Person variant="a" pose={(props?.leftPose as string) ?? "idle"} />
      </g>
      <g transform="translate(815,770) scale(0.6)">
        <Person variant="c" pose={(props?.rightPose as string) ?? "idle"} />
      </g>
      <Cutout shapes={[{ d: snip([[40, 900], [1040, 896], [1050, 1060], [30, 1064]], "stagetable", 4), fill: "#1f3a2a" }]} outline={4} border={7}>
        <path d="M60,930 H1020" stroke="#d9b44a" strokeWidth={6} strokeDasharray="4 12" />
      </Cutout>

      {/* atril con el orador */}
      <g transform={`translate(540,700) scale(0.72)`}>
        <Person variant="speaker" pose={(props?.speakerPose as string) ?? "talk"} />
      </g>
      <Cutout
        shapes={[
          { d: snip([[410, 860], [670, 860], [640, 1120], [440, 1120]], "lectern", 3), fill: "#6d4424" },
          { d: rrect(598, 790, 14, 80, 6), fill: "#333", tf: "rotate(-12 605 870)" },
          { d: ellipse(590, 790, 18, 24), fill: "#555" },
        ]}
        outline={4}
        border={7}
      >
        <path d="M470,920 H610 M480,960 H600" stroke="#3b2412" strokeWidth={4} />
        <circle cx={540} cy={1010} r={30} fill="#d9b44a" strokeWidth={4} />
      </Cutout>

      {/* borde del escenario */}
      <rect x={-700} y={1120} width={2480} height={80} fill="#2b1a10" />
      <path d={scribble([[-700, 1122], [540, 1118], [1780, 1124]], "stage", 3)} stroke={INK} strokeWidth={7} fill="none" />

      {/* NUESTRA mesa (primer plano): madera con vetas a rotulador */}
      <g filter={soft}>
        <path d="M-700,1230 L1780,1210 L1780,2700 L-700,2700 Z" fill="#a8733f" />
        <path d="M-700,1230 L1780,1210 L1780,2700 L-700,2700 Z" fill="url(#ht-wood)" />
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={i}
            d={scribble([[-700, 1300 + i * 120], [0, 1290 + i * 125 + rs("veta", i) * 30], [700, 1310 + i * 118], [1780, 1290 + i * 122]], `v${i}`, 10)}
            stroke="#6d4424"
            strokeWidth={4}
            fill="none"
          />
        ))}
        <path d={scribble([[-700, 1230], [540, 1222], [1780, 1210]], "tableedge", 3)} stroke={INK} strokeWidth={8} fill="none" />
      </g>

      {/* vaso de agua y el discurso que nadie lee */}
      <g transform="translate(118,1420) rotate(-8)">
        <Cutout shapes={[{ d: snip([[-120, -150], [120, -160], [135, 150], [-110, 160]], "papers", 3), fill: "#fbfaf4" }]} outline={3} border={6}>
          {[-100, -60, -20, 20, 60].map((y, i) => (
            <path key={y} d={`M-80,${y} H${60 - (i % 2) * 40}`} strokeWidth={3} stroke="#555" />
          ))}
          <path d="M-80,110 q30,-24 60,0 t60,0" strokeWidth={3} />
        </Cutout>
      </g>
      <g transform="translate(930,1380)">
        <Cutout shapes={[{ d: "M-50,-90 L50,-90 L40,70 L-40,70 Z", fill: "#dfeff2" }]} outline={3.5} border={6}>
          <path d="M-44,-30 L44,-30" stroke="#7fb5c4" strokeWidth={4} />
          <path d="M-30,-70 L-26,50" stroke="#fff" strokeWidth={6} />
        </Cutout>
      </g>
    </g>
  );
};

/** EL BOTÓN. pose: idle | pressed. props.label: texto de la cinta. */
export const RedButton: React.FC<{ pose?: string; props?: Record<string, unknown> }> = ({ pose, props }) => {
  const pressed = pose === "pressed";
  const label = (props?.label as string) ?? "NO TOCAR";
  const dome = pressed ? "M-62,-58 Q0,-78 62,-58 L62,-50 Q0,-36 -62,-50 Z" : "M-66,-58 Q-60,-150 0,-152 Q60,-150 66,-58 Q0,-40 -66,-58 Z";
  return (
    <g>
      <Cutout
        shapes={[
          // caja en perspectiva incorrecta (a propósito)
          { d: "M-120,-60 L118,-66 L140,-10 L-138,-2 Z", fill: "#b9bcbe" },
          { d: "M-138,-2 L140,-10 L132,96 L-130,104 Z", fill: "#7f8386" },
          { d: ellipse(0, -60, 70, 16), fill: "#444" },
          { d: dome, fill: "#d81f1a" },
        ]}
        outline={5}
        border={10}
      >
        {!pressed && <path d="M-34,-116 q12,-18 30,-20" stroke="#fff" strokeWidth={9} />}
        <circle cx={-110} cy={80} r={5} fill={INK} />
        <circle cx={110} cy={76} r={5} fill={INK} />
      </Cutout>
      {/* cinta de carrocero con aviso a rotulador */}
      <g transform="translate(0,48) rotate(-3)">
        <path d="M-96,-22 L96,-26 L98,20 L-94,24 Z" fill="#efe3b8" stroke="rgba(0,0,0,0.25)" strokeWidth={2} />
        <MarkerText text={label} size={34} color={INK} seed={77} />
      </g>
    </g>
  );
};

/** Objetos que caen (para la escalada). kind: chandelier | vase | portrait | chair */
export const Falling: React.FC<{ props?: Record<string, unknown> }> = ({ props }) => {
  const kind = (props?.kind as string) ?? "vase";
  if (kind === "chandelier")
    return (
      <Cutout
        shapes={[
          { d: rrect(-6, -300, 12, 220, 4), fill: "#b08b3a" },
          { d: "M-160,-80 Q0,40 160,-80 L140,-60 Q0,70 -140,-60 Z", fill: "#d9b44a" },
          ...[-150, -75, 0, 75, 150].map((x) => ({ d: rrect(x - 10, -130 + Math.abs(x) * 0.2, 20, 60, 6), fill: "#fdf7e6" })),
        ]}
        outline={4}
        border={7}
      >
        {[-150, -75, 0, 75, 150].map((x) => (
          <path key={x} d={`M${x},${-150 + Math.abs(x) * 0.2} q8,-14 0,-26`} stroke="#f0a020" strokeWidth={6} />
        ))}
      </Cutout>
    );
  if (kind === "portrait")
    return (
      <Cutout shapes={[{ d: rrect(-120, -150, 240, 300, 6), fill: "#caa24a" }, { d: rrect(-90, -120, 180, 240, 4), fill: "#6e6a5e" }]} outline={4} border={7}>
        <path d={ellipse(0, -30, 40, 50)} fill="#d9b095" strokeWidth={3} />
        <path d="M-60,120 Q0,20 60,120" fill="#2a2a3a" strokeWidth={3} />
      </Cutout>
    );
  if (kind === "chair")
    return (
      <Cutout shapes={[{ d: rrect(-80, -160, 160, 150, 10), fill: "#7a1a1f" }, { d: rrect(-90, -20, 180, 40, 8), fill: "#caa24a" }, { d: "M-80,20 L-90,160 L-70,160 L-60,20 Z M60,20 L70,160 L90,160 L80,20 Z", fill: "#caa24a" }]} outline={4} border={7} />
    );
  return (
    <Cutout shapes={[{ d: "M-50,-110 Q-90,0 -60,110 L60,110 Q90,0 50,-110 Z", fill: "#3f6fa8" }, { d: rrect(-40, -130, 80, 26, 8), fill: "#3f6fa8" }]} outline={4} border={7}>
      <path d="M-40,-20 q40,30 80,0 M-46,40 q46,30 92,0" stroke="#fff" strokeWidth={5} />
    </Cutout>
  );
};

/** Cartel de "PARODIA · FICCIÓN" que acompaña todo el episodio. */
export const ParodyTag: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const k = boilIndex(frame, 4) % 3;
  return (
    <div
      style={{
        position: "absolute",
        left: 74,
        top: 236,
        transform: `rotate(${-2.5 + k * 0.3}deg)`,
        background: "#fffdf6",
        color: INK,
        fontFamily: FONT_MARKER,
        fontSize: 30,
        padding: "6px 16px 4px",
        border: `3px solid ${INK}`,
        boxShadow: "5px 6px 0 rgba(0,0,0,0.35)",
        letterSpacing: 1,
      }}
    >
      {text}
    </div>
  );
};
