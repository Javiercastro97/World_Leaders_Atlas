"use client";
/**
 * Reproducción temporal del mapa. La escala de color es FIJA para toda la serie
 * (quintiles sobre todos los periodos): así un territorio que se oscurece es un
 * territorio que empeora, no un artefacto de reescalar cada año.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { periodLabel } from "@/lib/dates";
import type { SvgMap } from "@/server/svgmap";

const COLORS = ["#e2ddd3", "#bdb6aa", "#948c80", "#5f5a53", "#2a2825"];
const nf = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

export interface MemoryData {
  level: "province" | "ccaa";
  periods: string[];
  /** valores[periodo][territorio] */
  values: Record<string, Record<string, number>>;
  rates: Record<string, Record<string, number>> | null;
  national: Record<string, number>;
  names: Record<string, string>;
}

export function MemoryPlayer({ map, data }: { map: SvgMap; data: MemoryData }) {
  const [i, setI] = useState(data.periods.length - 1);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"abs" | "rate">("abs");
  const [hover, setHover] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const source = mode === "rate" && data.rates ? data.rates : data.values;

  const breaks = useMemo(() => {
    const all = Object.values(source)
      .flatMap((o) => Object.values(o))
      .sort((a, b) => a - b);
    if (!all.length) return [];
    return [1, 2, 3, 4, 5].map((k) => all[Math.min(all.length - 1, Math.ceil((k / 5) * all.length) - 1)]);
  }, [source]);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setI((x) => {
        if (x >= data.periods.length - 1) {
          setPlaying(false);
          return x;
        }
        return x + 1;
      });
    }, data.periods[0]?.includes("-Q") ? 450 : 900);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, data.periods]);

  const period = data.periods[i];
  const cur = source[period] ?? {};
  const cls = (v: number | undefined) => (v === undefined ? -1 : Math.max(0, breaks.findIndex((b) => v <= b)));
  const fmtV = (v: number) => (mode === "rate" ? nf1.format(v) : nf.format(v));
  const nat = Object.entries(data.national).sort();
  const natMax = Math.max(1, ...nat.map(([, v]) => v));

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 border-y-2 border-ink py-3">
        <button
          type="button"
          className="btn btn-ink min-w-[120px]"
          onClick={() => {
            if (!playing && i >= data.periods.length - 1) setI(0);
            setPlaying(!playing);
          }}
          aria-pressed={playing}
        >
          {playing ? "❚❚ Pausa" : "▶ Reproducir"}
        </button>
        <label className="flex-1 min-w-[220px]">
          <span className="label">Periodo: {periodLabel(period)}</span>
          <input
            type="range"
            min={0}
            max={data.periods.length - 1}
            value={i}
            onChange={(e) => {
              setPlaying(false);
              setI(Number(e.target.value));
            }}
            aria-valuetext={periodLabel(period)}
            className="w-full accent-[#141414]"
          />
          <span className="flex justify-between text-xs text-ink-3">
            <span>{periodLabel(data.periods[0])}</span>
            <span>{periodLabel(data.periods[data.periods.length - 1])}</span>
          </span>
        </label>
        {data.rates && (
          <div role="group" aria-label="Medida" className="flex gap-1">
            <button type="button" className={`btn btn-sm ${mode === "abs" ? "btn-ink" : ""}`} aria-pressed={mode === "abs"} onClick={() => setMode("abs")}>
              Absoluto
            </button>
            <button type="button" className={`btn btn-sm ${mode === "rate" ? "btn-ink" : ""}`} aria-pressed={mode === "rate"} onClick={() => setMode("rate")}>
              Por 100.000 hab.
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] mt-4">
        <figure className="relative">
          <p className="display text-6xl md:text-8xl absolute top-0 right-0 text-ink/15 select-none" aria-hidden>
            {period.replace("-Q", "·T")}
          </p>
          <svg viewBox={`0 0 ${map.width} ${map.height}`} className="w-full h-auto" role="img" aria-label={`Mapa de lanzamientos, ${periodLabel(period)}`}>
            <rect x={map.insetBox.x} y={map.insetBox.y} width={map.insetBox.w} height={map.insetBox.h} fill="none" stroke="#a8a092" strokeDasharray="3 3" />
            {map.paths.map((p) => {
              const v = cur[p.id];
              const c = cls(v);
              return (
                <path
                  key={p.id}
                  d={p.d}
                  fill={c < 0 ? "url(#memhatch)" : COLORS[c]}
                  stroke={hover === p.id ? "#141414" : "#f4f1ea"}
                  strokeWidth={hover === p.id ? 2 : 0.8}
                  onMouseEnter={() => setHover(p.id)}
                  onMouseLeave={() => setHover(null)}
                  style={{ transition: "fill 300ms ease-out" }}
                >
                  <title>{`${data.names[p.id]}: ${v === undefined ? "sin datos" : fmtV(v)}`}</title>
                </path>
              );
            })}
            <defs>
              <pattern id="memhatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#f4f1ea" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#a8a092" strokeWidth="1.5" />
              </pattern>
            </defs>
          </svg>
          <figcaption className="text-sm mt-2">
            {hover ? (
              <strong>
                {data.names[hover]}: {cur[hover] === undefined ? "sin datos" : `${fmtV(cur[hover])} ${mode === "rate" ? "por 100.000 hab." : "lanzamientos"}`}
              </strong>
            ) : (
              <span className="text-ink-3">Pasa el cursor por un territorio. Canarias, en el recuadro.</span>
            )}
          </figcaption>
          <ol className="flex gap-0.5 mt-3 max-w-md" aria-label="Leyenda (escala fija para toda la serie)">
            {breaks.map((b, k) => (
              <li key={k} className="flex-1">
                <span className="block h-3" style={{ background: COLORS[k] }} aria-hidden />
                <span className="text-[11px]">≤ {fmtV(b)}</span>
              </li>
            ))}
            <li className="ml-2">
              <span className="block h-3 w-10 hatch" aria-hidden />
              <span className="text-[11px]">Sin datos</span>
            </li>
          </ol>
        </figure>

        <aside>
          <p className="kicker">España · evolución</p>
          <svg viewBox={`0 0 300 120`} className="w-full h-auto mt-2" role="img" aria-label="Evolución nacional con el periodo actual marcado">
            {nat.map(([p, v], k) => {
              const w = 300 / nat.length;
              const h = (v / natMax) * 110;
              return <rect key={p} x={k * w + 0.5} y={120 - h} width={Math.max(1, w - 1)} height={h} fill={p === period ? "#141414" : "#bdb6aa"} />;
            })}
          </svg>
          <p className="text-3xl font-black mt-2" style={{ fontStretch: "78%" }}>
            {data.national[period] !== undefined ? nf.format(data.national[period]) : "—"}
          </p>
          <p className="text-sm text-ink-3">lanzamientos en España · {periodLabel(period)}</p>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-bold">Tabla de {periodLabel(period)}</summary>
            <table className="w-full mt-2">
              <tbody>
                {Object.entries(cur)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, v]) => (
                    <tr key={id} className="border-b border-rule">
                      <th scope="row" className="text-left font-normal py-0.5">
                        {data.names[id]}
                      </th>
                      <td className="text-right tabular-nums">{fmtV(v)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
        </aside>
      </div>
    </div>
  );
}
