// SONIDO. Cinco buses: VOICE · AMBIENCE · FOLEY · COMEDY_SFX · MUSIC.
// El silencio no es ausencia de diseño: se consigue cortando pistas con `until`.

import React from "react";
import { Html5Audio, Sequence, staticFile } from "remotion";
import type { Bus, Episode, SoundSpec } from "./types";
import { secToFrame } from "./motion";

const DEFAULT_MIX: Record<Bus, number> = { VOICE: 1, AMBIENCE: 0.35, FOLEY: 0.8, COMEDY_SFX: 0.9, MUSIC: 0.6 };

export function soundSrc(sound: string, dir: string): string {
  return sound.includes("/") ? staticFile(`${dir}/${sound}`) : staticFile(`_shared/sfx/${sound}.wav`);
}

interface Cue extends SoundSpec {
  absAt: number;
  absUntil?: number;
}

export function collectCues(ep: Episode): Cue[] {
  const cues: Cue[] = [];
  for (const tr of ep.tracks ?? []) cues.push({ ...tr, absAt: tr.at ?? 0, absUntil: tr.until });
  for (const sc of ep.scenes) {
    for (const s of [...(sc.voice ?? []).map((v) => ({ bus: "VOICE" as Bus, ...v })), ...(sc.sfx ?? [])]) {
      cues.push({ ...s, absAt: sc.start + (s.at ?? 0), absUntil: s.until !== undefined ? sc.start + s.until : undefined });
    }
  }
  return cues;
}

export const AudioLayer: React.FC<{ episode: Episode; dir: string }> = ({ episode, dir }) => {
  const mix = { ...DEFAULT_MIX, ...(episode.mix ?? {}) };
  const total = secToFrame(episode.duration);
  return (
    <>
      {collectCues(episode).map((c, i) => {
        const from = secToFrame(c.absAt);
        const end = c.absUntil !== undefined ? secToFrame(c.absUntil) : total;
        const bus = c.bus ?? "COMEDY_SFX";
        if (end <= from) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={end - from} layout="none" name={`${bus}:${c.sound}`}>
            <Html5Audio
              src={soundSrc(c.sound, dir)}
              volume={(c.volume ?? 1) * mix[bus]}
              loop={c.loop}
              playbackRate={c.rate ?? 1}
              trimBefore={c.trimStart ? secToFrame(c.trimStart) : undefined}
            />
          </Sequence>
        );
      })}
    </>
  );
};
