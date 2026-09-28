import React from "react";
import { Composition } from "remotion";
import { EpisodeComp } from "./engine/Episode";
import { FPS, H, W } from "./engine/motion";
import type { EpisodeProps } from "./engine/types";
import ep01 from "../episodes/ep01_felipe_vi/episode.json";

// Una única composición genérica. `npm run render <episodio>` le inyecta el
// episode.json del disco como inputProps; en Studio se abre EP01 por defecto.
export const Root: React.FC = () => (
  <Composition
    id="Episode"
    component={EpisodeComp}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={{ episode: ep01, dir: "ep01_felipe_vi" } as unknown as EpisodeProps}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.round(props.episode.duration * FPS) })}
  />
);
