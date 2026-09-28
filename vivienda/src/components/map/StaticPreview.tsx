"use client";
/** Vista previa ligera (SVG) mientras no se carga MapLibre: choropleth + convocatorias. Sin WebGL ni JS pesado. */
import type { SvgMap } from "@/server/svgmap";
import { CLASS_COLORS, type Classified } from "./types";

export interface PreviewPoint {
  id: string;
  x: number;
  y: number;
  pending: boolean;
}

export function StaticPreview({ map, classified, points, showStats, showEvents, onActivate }: { map: SvgMap; classified: Classified; points: PreviewPoint[]; showStats: boolean; showEvents: boolean; onActivate: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-sea">
      <svg viewBox={`0 0 ${map.width} ${map.height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <rect x={map.insetBox.x} y={map.insetBox.y} width={map.insetBox.w} height={map.insetBox.h} fill="none" stroke="#a8a092" strokeDasharray="3 3" />
        {map.paths.map((p) => {
          const c = classified.byId.get(p.id)?.cls ?? -1;
          return <path key={p.id} d={p.d} fill={showStats && c >= 0 ? CLASS_COLORS[c] : "#f7f5ef"} stroke="#a8a092" strokeWidth={0.8} />;
        })}
        {showEvents &&
          points.map((pt) => (
            <circle key={pt.id} cx={pt.x} cy={pt.y} r={7} fill={pt.pending ? "#fff" : "#c8241c"} stroke={pt.pending ? "#c8241c" : "#fff"} strokeWidth={pt.pending ? 3 : 2} />
          ))}
      </svg>
      <button type="button" onClick={onActivate} className="btn btn-ink absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap">
        Activar mapa interactivo
      </button>
    </div>
  );
}
