// Una escena = capas apiladas, todas dirigidas por los datos de episode.json.
//
//   MUNDO (sigue a la cámara POV)
//     decorado → personajes → props → manos → garabatos "world"
//   LUZ (apagón / alarma)
//   PENSAMIENTO (garabatos "screen" + subtítulos) — los pensamientos no se apagan
//
// POV_FREEZE congela el MUNDO; los pensamientos siguen vivos.

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { evalAnimations } from "./animations";
import { cameraTransform, evalCamera, freezeAt } from "./camera";
import { Doodle } from "./doodles";
import { Hand } from "./hands";
import { evalPlaced, FPS, H, jitter, W } from "./motion";
import { Subtitle } from "./subtitles";
import type { HandPose, Placed, SceneSpec } from "./types";
import { CHARACTERS, HTML_PROPS, PROPS, renderAsset, SETS } from "../assets/registry";

function Positioned({
  el,
  t,
  scene,
  children,
}: {
  el: Placed & { pose?: string };
  t: number;
  scene: SceneSpec;
  children: (pose: string | undefined) => React.ReactNode;
}) {
  const p = evalPlaced(el, t);
  const a = evalAnimations(scene.animations, el.id, t);
  if (!p.visible || a.hidden) return null;
  const sx = p.scale * p.sx * a.sx * (el.flip ? -1 : 1);
  const sy = p.scale * p.sy * a.sy;
  return (
    <g transform={`translate(${p.x + a.dx},${p.y + a.dy}) rotate(${p.rot + a.rot}) scale(${sx},${sy})`} opacity={p.opacity * a.opacity}>
      {children(p.pose)}
    </g>
  );
}

export const Scene: React.FC<{ scene: SceneSpec; dir: string; subtitleY: number }> = ({ scene, dir, subtitleY }) => {
  const frame = useCurrentFrame(); // relativo a la escena (dentro de <Sequence>)
  const t = frame / FPS;
  const frozen = freezeAt(scene.camera, t);
  const tw = frozen ?? t; // tiempo del mundo
  const cam = evalCamera(scene.camera, tw);
  const bg = scene.background;
  const Set = SETS[bg.set];
  const worldDoodles = (scene.doodles ?? []).filter((d) => d.space === "world");
  const screenDoodles = (scene.doodles ?? []).filter((d) => d.space !== "world");
  const props = [...(scene.props ?? [])].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  const svgProps = props.filter((p) => !HTML_PROPS[p.asset]);
  const htmlProps = props.filter((p) => HTML_PROPS[p.asset]);
  const worldStyle: React.CSSProperties = { transform: cameraTransform(cam), transformOrigin: "0 0" };

  // iluminación: nivel escalonado + alarma
  let level = 1;
  for (const k of bg.lighting ?? []) if (k.t <= tw) level = k.level;
  const alarm = bg.alarm;
  const alarmOn =
    alarm && t >= alarm.at && (alarm.until === undefined || t < alarm.until) && Math.floor((t - alarm.at) / (alarm.period ?? 0.5)) % 2 === 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#0b0a09" }}>
      <AbsoluteFill style={worldStyle}>
        <svg width={W} height={H} style={{ overflow: "visible" }}>
          {Set ? <Set t={tw} props={bg.props} dir={dir} /> : null}
          {(scene.characters ?? []).map((c, i) => (
            <Positioned key={`c${i}`} el={c} t={tw} scene={scene}>
              {(pose) => renderAsset(CHARACTERS, c.asset, { t: tw, pose, props: c.props, dir })}
            </Positioned>
          ))}
          {svgProps.map((p, i) => (
            <Positioned key={`p${i}`} el={p} t={tw} scene={scene}>
              {(pose) => renderAsset(PROPS, p.asset, { t: tw, pose, props: p.props, dir })}
            </Positioned>
          ))}
          {(scene.hands ?? []).map((h, i) => {
            const [jx, jy] = h.tremble ? jitter(Math.round(tw * FPS), h.tremble, `hand${i}`, 2) : [0, 0];
            return (
              <g key={`h${i}`} transform={`translate(${jx},${jy})`}>
                <Positioned el={{ id: h.id ?? `hand_${h.side}`, ...h }} t={tw} scene={scene}>
                  {(pose) =>
                    h.asset?.startsWith("image:") ? (
                      renderAsset(PROPS, h.asset, { t: tw, pose, props: { w: 420, h: 900 }, dir })
                    ) : (
                      <Hand side={h.side} pose={(pose as HandPose) ?? "rest"} />
                    )
                  }
                </Positioned>
              </g>
            );
          })}
          {worldDoodles.map((d, i) => (
            <Doodle key={`wd${i}`} spec={d} t={t} dir={dir} />
          ))}
        </svg>
        {htmlProps.map((p, i) => {
          const pl = evalPlaced(p, tw);
          if (!pl.visible) return null;
          const C = HTML_PROPS[p.asset];
          return (
            <div key={`hp${i}`} style={{ position: "absolute", left: pl.x - W / 2, top: pl.y - H / 2, width: W, height: H, transform: `rotate(${pl.rot}deg) scale(${pl.scale})` }}>
              <C t={tw} pose={pl.pose} props={p.props} dir={dir} />
            </div>
          );
        })}
      </AbsoluteFill>

      {level < 1 && <AbsoluteFill style={{ backgroundColor: "#050404", opacity: 1 - level }} />}
      {alarmOn && <AbsoluteFill style={{ backgroundColor: alarm?.color ?? "rgba(255, 24, 12, 0.34)" }} />}

      <AbsoluteFill>
        <svg width={W} height={H} style={{ overflow: "visible" }}>
          {screenDoodles.map((d, i) => (
            <Doodle key={`sd${i}`} spec={d} t={t} dir={dir} />
          ))}
        </svg>
      </AbsoluteFill>
      {(scene.subtitle ?? []).map((s, i) => (
        <Subtitle key={`s${i}`} spec={s} t={t} defaultY={subtitleY} />
      ))}
    </AbsoluteFill>
  );
};
