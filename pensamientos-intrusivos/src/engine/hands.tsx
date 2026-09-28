// MANOS del protagonista (vista POV desde arriba, dorso de la mano).
// Dibujadas como recortes de cartulina con rotulador. Nada de 3D.
//
// Assets reutilizables (= poses):
//   HAND_LEFT / HAND_RIGHT → side + pose "rest"
//   HAND_POINT   → pose "point"     HAND_PRESS  → pose "press"
//   HAND_GRAB    → pose "grab"      HAND_NERVOUS → pose "nervous"
//   HAND_HIDE    → pose "hide"
// Para sustituir por un recorte específico del episodio: `asset: "image:images/mano.png"`.

import React from "react";
import { useCurrentFrame } from "remotion";
import { capsule, Cutout, INK, rrect, type Shape } from "./look";
import type { HandPose } from "./types";
import { boilIndex } from "./motion";

export const HAND_ASSETS = {
  HAND_LEFT: { side: "left", pose: "rest" },
  HAND_RIGHT: { side: "right", pose: "rest" },
  HAND_POINT: { pose: "point" },
  HAND_PRESS: { pose: "press" },
  HAND_GRAB: { pose: "grab" },
  HAND_NERVOUS: { pose: "nervous" },
  HAND_HIDE: { pose: "hide" },
} as const;

const SKIN = "#e8b893";
const SUIT = "#232a45";
const SHIRT = "#f3f1ea";

// dedos: [x del nudillo, y del nudillo] de índice → meñique (mano derecha)
const KNUCKLES: [number, number][] = [
  [-80, -250],
  [-27, -262],
  [26, -258],
  [78, -236],
];
const FULL = [175, 192, 176, 132];

interface FingerSet {
  len: number[]; // largo visible de cada dedo (corto = doblado, escorzo)
  ang: number[]; // grados
  thumb: { len: number; ang: number };
  squash?: [number, number];
}

function fingersFor(pose: HandPose, frame: number): FingerSet {
  switch (pose) {
    case "point":
      return { len: [215, 62, 58, 50], ang: [-4, 4, 6, 10], thumb: { len: 105, ang: -18 } };
    case "press":
      // el índice se "dobla" hacia el botón: escorzo = dedo cortito y gordo
      return { len: [150, 60, 56, 48], ang: [2, 4, 6, 10], thumb: { len: 100, ang: -14 }, squash: [1.06, 0.9] };
    case "grab":
    case "hide":
      return { len: [66, 70, 64, 52], ang: [-4, 0, 5, 12], thumb: { len: 110, ang: 8 } };
    case "nervous": {
      // tamborileo: dos poses que se alternan
      const a = boilIndex(frame, 4) % 2 === 0;
      return {
        len: a ? [175, 110, 180, 95] : [115, 190, 112, 132],
        ang: [-6, -1, 4, 12],
        thumb: { len: 140, ang: -38 },
      };
    }
    default:
      return { len: FULL, ang: [-7, -2, 4, 13], thumb: { len: 150, ang: -40 } };
  }
}

const HandDrawing: React.FC<{ pose: HandPose }> = ({ pose }) => {
  const frame = useCurrentFrame();
  const f = fingersFor(pose, frame);
  const fw = 52;

  const shapes: Shape[] = [
    { d: rrect(-150, 30, 300, 900, 36), fill: SUIT }, // manga (sale de cuadro por abajo)
    { d: rrect(-126, -18, 252, 78, 16), fill: SHIRT }, // puño de camisa
    { d: "M-112,4 Q-134,-140 -116,-252 Q-2,-292 116,-262 Q132,-150 108,4 Z", fill: SKIN }, // dorso
    // pulgar
    { d: capsule(-27, -f.thumb.len, 54, f.thumb.len + 20), tf: `translate(-100,-70) rotate(${f.thumb.ang})`, fill: SKIN },
    ...KNUCKLES.map(([x, y], i) => ({
      d: capsule(-fw / 2, -f.len[i], fw, f.len[i] + 34),
      tf: `translate(${x},${y + 26}) rotate(${f.ang[i]})`,
      fill: SKIN,
    })),
  ];

  const sq = f.squash ?? [1, 1];
  return (
    <g transform={`scale(${sq[0]},${sq[1]})`}>
      <Cutout shapes={shapes} outline={5} border={10}>
        {/* uñas en los dedos estirados, arrugas de nudillo en todos */}
        {KNUCKLES.map(([x, y], i) => (
          <g key={i} transform={`translate(${x},${y + 26}) rotate(${f.ang[i]})`}>
            {f.len[i] > 120 && <path d={rrect(-14, -f.len[i] + 6, 28, 30, 10)} strokeWidth={3} />}
            <path d={`M-12,${-f.len[i] * 0.45} q12,-6 24,0`} strokeWidth={3} />
            {f.len[i] < 80 && <path d={`M-16,-6 q16,10 32,0`} strokeWidth={3} />}
          </g>
        ))}
        <path d="M-70,-120 q30,14 60,4" strokeWidth={2.5} opacity={0.6} />
        <path d="M20,-150 q30,8 55,-6" strokeWidth={2.5} opacity={0.6} />
        {/* manga: rayas de rotulador y botón de gemelo */}
        <path d="M-120,120 l40,-30 M-110,190 l60,-45 M60,160 l50,-40" strokeWidth={3} stroke="#0d1020" />
        <circle cx={95} cy={20} r={9} fill="#d9b44a" strokeWidth={3} />
        <path d="M-126,60 H126" strokeWidth={4} />
      </Cutout>
    </g>
  );
};

export const Hand: React.FC<{ side: "left" | "right"; pose: HandPose }> = ({ side, pose }) => (
  <g transform={side === "left" ? "scale(-1,1)" : undefined}>
    <HandDrawing pose={pose} />
  </g>
);

export const HAND_INK = INK;
