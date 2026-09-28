// REGISTRO DE ASSETS. Lo que episode.json puede nombrar.
// Para un episodio nuevo: añade aquí su decorado/props si hacen falta,
// o usa "image:images/loquesea.png" (recorte fotográfico) sin tocar código.

import React from "react";
import { staticFile } from "remotion";
import { CeremonyHall, Falling, RedButton } from "./ceremony";
import { BlackSet, PaperSet, SeriesLogo } from "./logo";
import { Person } from "./people";

export interface AssetCtx {
  t: number;
  pose?: string;
  props?: Record<string, unknown>;
  dir: string;
}

type SvgAsset = React.FC<AssetCtx>;

export const SETS: Record<string, SvgAsset> = {
  ceremony_hall: ({ t, props }) => <CeremonyHall t={t} props={props} />,
  paper: () => <PaperSet />,
  black: () => <BlackSet />,
};

export const PROPS: Record<string, SvgAsset> = {
  red_button: ({ pose, props }) => <RedButton pose={pose} props={props} />,
  falling: ({ props }) => <Falling props={props} />,
};

/** Props que se pintan como HTML (tipografía compleja), por encima del SVG del mundo. */
export const HTML_PROPS: Record<string, React.FC<AssetCtx>> = {
  series_logo: ({ props }) => <SeriesLogo props={props} />,
};

export const CHARACTERS: Record<string, SvgAsset> = {
  person: ({ pose, props }) => <Person pose={pose} variant={(props?.variant as never) ?? "a"} />,
};

/**
 * Recorte fotográfico: PNG con transparencia → borde blanco de tijera + sombra dura.
 * Uso: { "asset": "image:images/foto.png", "props": { "w": 400, "h": 500 } }
 */
export const CutoutImage: React.FC<{ src: string; w: number; h: number; dir: string }> = ({ src, w, h, dir }) => (
  <g>
    <defs>
      <filter id="cutout-img" x="-20%" y="-20%" width="140%" height="140%">
        <feMorphology in="SourceAlpha" operator="dilate" radius={9} result="grow" />
        <feFlood floodColor="#fbf8ef" />
        <feComposite in2="grow" operator="in" result="border" />
        <feOffset in="grow" dx={10} dy={12} result="sh" />
        <feFlood floodColor="#000" floodOpacity={0.3} />
        <feComposite in2="sh" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="border" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <image href={staticFile(`${dir}/${src}`)} x={-w / 2} y={-h / 2} width={w} height={h} filter="url(#cutout-img)" />
  </g>
);

export function renderAsset(
  registry: Record<string, SvgAsset>,
  asset: string,
  ctx: AssetCtx,
): React.ReactNode {
  if (asset.startsWith("image:")) {
    const w = (ctx.props?.w as number) ?? 400;
    const h = (ctx.props?.h as number) ?? 400;
    return <CutoutImage src={asset.slice(6)} w={w} h={h} dir={ctx.dir} />;
  }
  const C = registry[asset];
  if (!C) {
    console.warn(`[pensamientos] asset desconocido: ${asset}`);
    return null;
  }
  return <C {...ctx} />;
}

