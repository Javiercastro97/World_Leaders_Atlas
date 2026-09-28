// Personajes secundarios: recortes de cartulina con cara a rotulador.
// Genéricos a propósito (no son retratos de nadie real).
// pose: idle | talk | shock | stare | look_left | look_right

import React from "react";
import { useCurrentFrame } from "remotion";
import { capsule, Cutout, ellipse, INK, snip } from "../engine/look";
import { boilIndex } from "../engine/motion";

const SKINS = ["#e9bd98", "#d9a47c", "#f1cbab", "#c98f68"];
const SUITS = ["#1f2233", "#2b2f2a", "#3a2d2a", "#20283a"];

export interface PersonProps {
  variant?: "speaker" | "a" | "b" | "c" | "d";
  pose?: string;
  sash?: boolean;
}

export const Person: React.FC<PersonProps> = ({ variant = "a", pose = "idle" }) => {
  const frame = useCurrentFrame();
  const vi = { speaker: 0, a: 1, b: 2, c: 3, d: 0 }[variant];
  const skin = SKINS[vi];
  const suit = SUITS[vi];
  const talkOpen = pose === "talk" && boilIndex(frame, 4) % 2 === 0;

  // cuerpo (sale de cuadro por abajo) + cabeza
  const body = snip([[-150, 120], [150, 120], [205, 520], [-205, 520]], `body${variant}`, 5);
  const shapes = [
    { d: body, fill: suit },
    { d: snip([[-45, 118], [45, 118], [0, 240]], `shirt${variant}`, 2), fill: "#f4f2ea" },
    { d: capsule(-38, 60, 76, 80), fill: skin }, // cuello
    { d: ellipse(0, 0, 92, 112), fill: skin },
    { d: ellipse(-92, 10, 16, 26), fill: skin },
    { d: ellipse(92, 10, 16, 26), fill: skin },
  ];

  // ojos: dónde miran
  const look =
    pose === "stare" ? [0, 8] : pose === "look_left" ? [-10, 0] : pose === "look_right" ? [10, 0] : pose === "shock" ? [0, 0] : [3, 2];
  const eyeR = pose === "shock" ? 17 : 10;

  return (
    <Cutout shapes={shapes} outline={4.5} border={8} shadow={[8, 10]}>
      {/* corbata */}
      <path d="M0,128 l-14,14 l14,90 l14,-90 Z" fill={variant === "b" ? "#6b1d1d" : "#243a78"} strokeWidth={3} />
      {/* pelo según variante */}
      {variant === "speaker" && <path d="M-88,-40 q10,-80 88,-74 q78,4 88,74 q-20,-40 -88,-44 q-60,0 -88,44 Z" fill="#cfcac0" strokeWidth={4} />}
      {variant === "a" && <path d="M-92,-20 q-4,-100 92,-94 q96,4 92,94 q-30,-50 -60,-50 q-50,20 -124,50 Z" fill="#2a2420" strokeWidth={4} />}
      {variant === "b" && <path d="M-60,-100 q60,-30 120,0" strokeWidth={5} />}
      {variant === "c" && (
        <>
          <path d="M-96,10 q-10,-120 96,-118 q106,2 96,118 q-20,-70 -96,-76 q-76,6 -96,76 Z" fill="#5a3a22" strokeWidth={4} />
          <circle cx={0} cy={-128} r={34} fill="#5a3a22" strokeWidth={4} />
        </>
      )}
      {/* cejas */}
      <path d={pose === "stare" ? "M-52,-30 l36,10 M52,-30 l-36,10" : pose === "shock" ? "M-52,-48 q18,-12 36,0 M52,-48 q-18,-12 -36,0" : "M-52,-32 h34 M52,-32 h-34"} strokeWidth={6} />
      {/* ojos */}
      {[-34, 34].map((x) => (
        <g key={x}>
          {pose === "shock" || pose === "stare" ? <circle cx={x} cy={-4} r={eyeR + 8} fill="#fff" strokeWidth={3} /> : null}
          <circle cx={x + look[0]} cy={-4 + look[1]} r={eyeR * 0.7} fill={INK} stroke="none" />
        </g>
      ))}
      {variant === "speaker" && (
        <>
          {/* gafas y bigote */}
          <path d="M-62,-20 h54 v30 h-54 Z M8,-20 h54 v30 h-54 Z M-8,-8 h16" strokeWidth={4} />
          <path d="M-40,40 q20,-14 40,0 q20,-14 40,0 q-40,18 -80,0 Z" fill="#8f8a80" strokeWidth={4} />
        </>
      )}
      {/* nariz */}
      <path d="M0,0 q-10,26 6,30" strokeWidth={4} />
      {/* boca */}
      {pose === "shock" ? (
        <path d={ellipse(0, 62, 18, 26)} fill="#5a1414" strokeWidth={4} />
      ) : talkOpen ? (
        <path d={ellipse(0, 64, 22, 12)} fill="#5a1414" strokeWidth={4} />
      ) : pose === "stare" ? (
        <path d="M-24,66 h48" strokeWidth={5} />
      ) : (
        <path d="M-22,62 q22,8 44,0" strokeWidth={4} />
      )}
      {/* condecoraciones de mercadillo */}
      {variant !== "c" && variant !== "speaker" && (
        <>
          <circle cx={-95} cy={260} r={13} fill="#d9b44a" strokeWidth={3} />
          <circle cx={-62} cy={272} r={11} fill="#b7b7b7" strokeWidth={3} />
        </>
      )}
    </Cutout>
  );
};
