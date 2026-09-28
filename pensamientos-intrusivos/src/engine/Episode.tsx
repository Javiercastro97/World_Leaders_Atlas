// El motor: recibe un episode.json y lo convierte en vídeo. Nada de este archivo
// sabe de Felipe VI ni de botones: todo viene de los datos.

import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { AudioLayer } from "./audio";
import { FilterDefs, gateWeave, PhotocopyGrain } from "./look";
import { secToFrame } from "./motion";
import { Scene } from "./Scene";
import type { EpisodeProps } from "./types";
import { ParodyTag } from "../assets/ceremony";
import { useFonts } from "./fonts";

export const EpisodeComp: React.FC<EpisodeProps> = ({ episode, dir }) => {
  useFonts();
  const frame = useCurrentFrame();
  const [gx, gy] = gateWeave(frame);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0a09" }}>
      <FilterDefs />
      <AbsoluteFill style={{ transform: `translate(${gx}px, ${gy}px) scale(1.006)` }}>
        {episode.scenes.map((sc, i) => (
          <Sequence key={i} from={secToFrame(sc.start)} durationInFrames={Math.max(1, secToFrame(sc.end) - secToFrame(sc.start))} name={sc.id ?? `escena ${i + 1}`}>
            <Scene scene={sc} dir={dir} subtitleY={episode.subtitleY ?? 1030} />
          </Sequence>
        ))}
      </AbsoluteFill>
      {episode.disclaimer && <ParodyTag text={episode.disclaimer} />}
      <PhotocopyGrain />
      <AudioLayer episode={episode} dir={dir} />
    </AbsoluteFill>
  );
};
