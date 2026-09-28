"use client";
/**
 * Gráficos SVG sobrios, sin dependencias. Reglas (skill dataviz):
 *  - un solo eje Y, rejilla recesiva, marcas finas con extremo redondeado anclado a la base;
 *  - tooltip al pasar/enfocar cada marca; etiquetas directas solo selectivas;
 *  - cada gráfico ofrece su tabla equivalente (<details>), accesible sin interacción visual;
 *  - el texto usa tinta, nunca el color de la serie.
 */
import { useId, useMemo, useState } from "react";
import { periodLabel } from "@/lib/dates";

const SHORT_LABEL = { arrendamientos_urbanos: "Alquiler (LAU)", ejecucion_hipotecaria: "Hipoteca", otros: "Otras" } as const;

export const SERIES_COLORS = {
  arrendamientos_urbanos: "#2f63a8",
  ejecucion_hipotecaria: "#b7791f",
  otros: "#7b5ea7",
} as const;

const nf = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const fmt = (v: number, dec = 0) => (dec ? nf1.format(v) : nf.format(v));

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

function ticks(max: number, n = 4): number[] {
  return Array.from({ length: n + 1 }, (_, i) => (max / n) * i);
}

/** Posición en % del SVG (escala con el viewBox). */
interface Tip {
  x: string;
  y: string;
  lines: string[];
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="pointer-events-none absolute z-10 bg-ink text-paper text-xs px-2 py-1.5 whitespace-nowrap" style={{ left: tip.x, top: tip.y, transform: "translate(-50%, calc(-100% - 8px))" }} role="tooltip">
      {tip.lines.map((l, i) => (
        <div key={i} className={i === 0 ? "font-bold" : ""}>
          {l}
        </div>
      ))}
    </div>
  );
}

export interface BarDatum {
  period: string;
  value: number;
  yoy?: number | null;
  derived?: boolean;
}

/** Barras verticales para una serie temporal (una sola serie: sin leyenda, el título la nombra). */
export function ColumnChart({ data, unit = "lanzamientos", height = 260, highlightLast = true, decimals = 0 }: { data: BarDatum[]; unit?: string; height?: number; highlightLast?: boolean; decimals?: number }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const W = 720;
  const H = height;
  const m = { t: 16, r: 8, b: 28, l: 52 };
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const step = iw / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(40, step - 2));
  const y = (v: number) => m.t + ih - (v / max) * ih;
  const labelEvery = Math.ceil(data.length / (W / 56));
  const maxI = data.reduce((bi, d, i) => (d.value > data[bi].value ? i : bi), 0);

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Gráfico de columnas: ${data.length} periodos`}>
        {ticks(max).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#d9d2c4" strokeWidth={t === 0 ? 1.5 : 0.75} />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#5f5a53">
              {fmt(t, decimals && max < 10 ? 1 : 0)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = m.l + i * step + (step - bw) / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const last = highlightLast && i === data.length - 1;
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={d.period}>
              <path
                d={`M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + bw - r} Q${x + bw},${y(d.value)} ${x + bw},${y(d.value) + r} V${y(0)} Z`}
                fill={last ? "#141414" : "#8f877b"}
              />
              {((i % labelEvery === 0 && data.length - 1 - i >= labelEvery) || i === data.length - 1) && (
                <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#3b3935">
                  {d.period.includes("-Q") ? d.period.replace("-Q", " T") : d.period}
                </text>
              )}
              {(i === data.length - 1 || i === maxI) && (
                <text x={x + bw / 2} y={y(d.value) - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#141414">
                  {fmt(d.value, decimals)}
                </text>
              )}
              <rect
                x={m.l + i * step}
                y={m.t}
                width={step}
                height={ih}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${periodLabel(d.period)}: ${fmt(d.value, decimals)} ${unit}`}
                onMouseEnter={() => setTip({ x: pct(x + bw / 2, W), y: pct(y(d.value), H), lines: tipLines(d, unit, decimals) })}
                onFocus={() => setTip({ x: pct(x + bw / 2, W), y: pct(y(d.value), H), lines: tipLines(d, unit, decimals) })}
                onMouseLeave={() => setTip(null)}
                onBlur={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
      <DataTable
        headers={["Periodo", unit, "Var. interanual"]}
        rows={data.map((d) => [periodLabel(d.period), fmt(d.value, decimals) + (d.derived ? " *" : ""), d.yoy == null ? "—" : `${d.yoy > 0 ? "+" : ""}${nf1.format(d.yoy)} %`])}
        note={data.some((d) => d.derived) ? "* Total calculado sumando datos publicados (trimestres o provincias)." : undefined}
      />
    </figure>
  );
}

function tipLines(d: BarDatum, unit: string, decimals: number) {
  const l = [periodLabel(d.period), `${fmt(d.value, decimals)} ${unit}`];
  if (d.yoy != null) l.push(`${d.yoy > 0 ? "+" : ""}${nf1.format(d.yoy)} % interanual`);
  if (d.derived) l.push("Total calculado por suma");
  return l;
}

export interface StackDatum {
  period: string;
  parts: { key: keyof typeof SERIES_COLORS; label: string; value: number | null }[];
}

/** Columnas apiladas por tipo de procedimiento (≤ 4 series: leyenda + etiquetas directas en la última columna). */
export function StackedColumns({ data, height = 280 }: { data: StackDatum[]; height?: number }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const W = 720;
  const H = height;
  const m = { t: 12, r: 150, b: 28, l: 52 };
  const totals = data.map((d) => d.parts.reduce((a, p) => a + (p.value ?? 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const step = iw / Math.max(1, data.length);
  const bw = Math.max(3, Math.min(36, step - 3));
  const y = (v: number) => m.t + ih - (v / max) * ih;
  const labelEvery = Math.ceil(data.length / (iw / 56));
  const keys = data[0]?.parts ?? [];

  return (
    <figure className="relative">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-2" aria-label="Leyenda">
        {keys.map((k) => (
          <li key={k.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3" style={{ background: SERIES_COLORS[k.key] }} aria-hidden />
            {k.label}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Columnas apiladas por tipo de procedimiento">
        {ticks(max).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#d9d2c4" strokeWidth={t === 0 ? 1.5 : 0.75} />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#5f5a53">
              {fmt(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = m.l + i * step + (step - bw) / 2;
          let acc = 0;
          const isLast = i === data.length - 1;
          return (
            <g key={d.period}>
              {d.parts.map((p) => {
                const v = p.value ?? 0;
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                // 2px de separación entre segmentos (color de superficie)
                const h = Math.max(0, y0 - y1 - 2);
                return (
                  <g key={p.key}>
                    <rect x={x} y={y1} width={bw} height={h} fill={SERIES_COLORS[p.key]} />
                    {isLast && h > 12 && (
                      <text x={x + bw + 6} y={y1 + h / 2} dy="0.32em" fontSize="11" fill="#141414">
                        {SHORT_LABEL[p.key]} · {fmt(v)}
                      </text>
                    )}
                  </g>
                );
              })}
              {((i % labelEvery === 0 && data.length - 1 - i >= labelEvery) || isLast) && (
                <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#3b3935">
                  {d.period}
                </text>
              )}
              <rect
                x={m.l + i * step}
                y={m.t}
                width={step}
                height={ih}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${periodLabel(d.period)}: ${d.parts.map((p) => `${p.label} ${p.value == null ? "sin dato" : fmt(p.value)}`).join(", ")}`}
                onMouseEnter={() => setTip({ x: pct(x + bw / 2, W), y: pct(y(totals[i]), H), lines: [periodLabel(d.period), ...d.parts.map((p) => `${p.label}: ${p.value == null ? "—" : fmt(p.value)}`)] })}
                onMouseLeave={() => setTip(null)}
                onFocus={() => setTip({ x: pct(x + bw / 2, W), y: pct(y(totals[i]), H), lines: [periodLabel(d.period), ...d.parts.map((p) => `${p.label}: ${p.value == null ? "—" : fmt(p.value)}`)] })}
                onBlur={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
      <DataTable headers={["Periodo", ...keys.map((k) => k.label)]} rows={data.map((d) => [periodLabel(d.period), ...d.parts.map((p) => (p.value == null ? "—" : fmt(p.value)))])} />
    </figure>
  );
}

export interface RankDatum {
  id: string;
  label: string;
  value: number | null;
  highlight?: boolean;
  href?: string;
  note?: string | null;
}

/** Barras horizontales ordenadas (comparador territorial). Valores rotulados: la lectura exacta importa. */
export function RankBars({ data, decimals = 0, unit }: { data: RankDatum[]; decimals?: number; unit: string }) {
  const sorted = useMemo(() => [...data].sort((a, b) => (b.value ?? -1) - (a.value ?? -1)), [data]);
  const max = Math.max(1, ...sorted.map((d) => d.value ?? 0));
  const id = useId();
  return (
    <figure>
      <span id={id} className="sr-only">
        Clasificación por {unit}
      </span>
      <ol className="space-y-1" aria-labelledby={id}>
        {sorted.map((d, i) => (
          <li key={d.id} className="grid grid-cols-[minmax(92px,160px)_1fr_auto] items-center gap-2 text-sm">
            <span className={`truncate ${d.highlight ? "font-black" : ""}`}>
              <span className="text-ink-3 tabular-nums mr-1">{i + 1}.</span>
              {d.href ? <a href={d.href}>{d.label}</a> : d.label}
            </span>
            <span className="h-3 relative" aria-hidden>
              {d.value != null ? (
                <span className="absolute inset-y-0 left-0" style={{ width: `${(d.value / max) * 100}%`, background: d.highlight ? "#141414" : "#8f877b", borderRadius: "0 3px 3px 0" }} />
              ) : (
                <span className="absolute inset-0 hatch" />
              )}
            </span>
            <span className={`tabular-nums text-right min-w-[64px] ${d.highlight ? "font-black" : ""}`} title={d.note ?? undefined}>
              {d.value == null ? "s/d" : fmt(d.value, decimals)}
              {d.note ? " *" : ""}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function DataTable({ headers, rows, note }: { headers: string[]; rows: string[][]; note?: string }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer font-bold">Ver tabla de datos</summary>
      <div className="overflow-x-auto mt-2">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-ink text-left">
              {headers.map((h, i) => (
                <th key={i} scope="col" className="py-1 pr-4 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-rule">
                {r.map((c, j) => (j === 0 ? <th key={j} scope="row" className="py-1 pr-4 font-normal text-left">{c}</th> : <td key={j} className="py-1 pr-4 tabular-nums">{c}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="text-xs text-ink-3 mt-1">{note}</p>}
    </details>
  );
}
