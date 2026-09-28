"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { getTerritory } from "@/lib/territories";
import { METRIC_LABEL, PROCEDURE_LABEL } from "@/lib/vocab";
import { periodLabel } from "@/lib/dates";
import { fmtInt, fmt1 } from "@/lib/site";
import { classify, CLASS_COLORS, type Choropleth, type Layers, type MapOrg, type PublicEvent, type Selection, type StatsOptions } from "./types";
import { SidePanel } from "./SidePanel";
import { StaticPreview, type PreviewPoint } from "./StaticPreview";
import type { SvgMap } from "@/server/svgmap";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-sea">
      <p className="kicker text-ink-3">Cargando cartografía…</p>
    </div>
  ),
});

export interface MapExplorerProps {
  events: PublicEvent[];
  orgs: MapOrg[];
  initialChoropleth: Choropleth | null;
  years: string[];
  quarters: string[];
  nowIso: string;
  preview: SvgMap;
  previewPoints: PreviewPoint[];
}

export function MapExplorer(props: MapExplorerProps) {
  const now = useMemo(() => new Date(props.nowIso), [props.nowIso]);
  const [layers, setLayers] = useState<Layers>({ events: true, stats: true, orgs: false });
  const [opts, setOpts] = useState<StatsOptions>({
    level: "province",
    mode: "abs",
    period: props.initialChoropleth?.period ?? props.years[props.years.length - 1] ?? "",
    procedure: "total",
  });
  const [choro, setChoro] = useState<Choropleth | null>(props.initialChoropleth);
  const optsKey = `${opts.level}|${opts.period}|${opts.procedure}`;
  const [loadedKey, setLoadedKey] = useState(optsKey);
  const loadingStats = loadedKey !== optsKey;
  const [selection, setSelection] = useState<Selection>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [view, setView] = useState<"peninsula" | "canarias">("peninsula");
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; zoom?: number; key: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // En móvil se muestra primero un mapa estático ligero; MapLibre se carga al pulsar (datos y batería).
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    // Depende del viewport: solo se conoce en el cliente, tras hidratar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.matchMedia("(min-width: 1024px)").matches) setInteractive(true);
  }, []);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!opts.period) return;
    const ctrl = new AbortController();
    const key = `${opts.level}|${opts.period}|${opts.procedure}`;
    const q = new URLSearchParams({ view: "choropleth", level: opts.level, period: opts.period, procedure: opts.procedure });
    fetch(`/api/statistics?${q}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setChoro(d?.choropleth ?? null);
        setLoadedKey(key);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [opts.level, opts.period, opts.procedure]);

  const classified = useMemo(() => classify(choro, opts.mode), [choro, opts.mode]);
  const hasRates = choro?.data.some((d) => d.rate !== null) ?? false;

  const select = (s: Selection) => {
    setSelection(s);
    if (s && s.kind !== "territory") setInteractive(true);
    if (s?.kind === "event") {
      const e = props.events.find((x) => x.id === s.id);
      if (e) setFlyTo({ lat: e.location.latitude, lon: e.location.longitude, zoom: 11, key: Date.now() });
    }
    if (s?.kind === "org") {
      const o = props.orgs.find((x) => x.id === s.id);
      if (o) setFlyTo({ lat: o.latitude, lon: o.longitude, zoom: 11, key: Date.now() });
    }
    // En móvil, el panel está debajo del mapa: llevar la vista a la ficha
    if (s && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const toggle = (k: keyof Layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const hoverDatum = hover ? classified.byId.get(hover.id) : null;
  const periods = opts.period.includes("-Q") ? props.quarters : props.years;

  return (
    <div className="grid lg:grid-cols-[minmax(0,68fr)_minmax(340px,32fr)] border-y-2 border-ink">
      {/* MAPA */}
      <section aria-label="Mapa" className="relative">
        <div className="absolute z-10 top-3 left-3 right-14 flex flex-wrap gap-2" role="group" aria-label="Capas del mapa">
          <button type="button" className="toggle" aria-pressed={layers.events} onClick={() => toggle("events")}>
            <span className="swatch inline-block w-3 h-3 rounded-full bg-signal" aria-hidden />
            Convocatorias
          </button>
          <button type="button" className="toggle" aria-pressed={layers.stats} onClick={() => toggle("stats")}>
            <span className="swatch inline-block w-3 h-3" style={{ background: CLASS_COLORS[3] }} aria-hidden />
            Desahucios
          </button>
          <button type="button" className="toggle" aria-pressed={layers.orgs} onClick={() => toggle("orgs")}>
            <span className="swatch inline-block w-2.5 h-2.5 bg-ink" aria-hidden />
            Colectivos
          </button>
        </div>

        <div className="relative h-[58svh] min-h-[380px] lg:h-[calc(100svh-120px)] lg:min-h-[520px] bg-sea">
          {!interactive ? (
            <StaticPreview
              map={props.preview}
              classified={classified}
              points={props.previewPoints}
              showStats={layers.stats}
              showEvents={layers.events}
              onActivate={() => setInteractive(true)}
            />
          ) : (
          <MapCanvas
            events={props.events}
            orgs={props.orgs}
            layers={layers}
            level={opts.level}
            classified={classified}
            selection={selection}
            view={view}
            onSelect={select}
            onHoverTerritory={setHover}
            flyTo={flyTo}
          />
          )}
          {hover && layers.stats && choro && (
            <div
              className="pointer-events-none absolute z-20 bg-ink text-paper px-3 py-2 text-sm max-w-[240px]"
              style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}
              role="tooltip"
            >
              <p className="font-bold">{getTerritory(hover.id)?.shortName}</p>
              <p>
                {hoverDatum?.value != null ? `${fmtInt.format(hoverDatum.value)} lanzamientos` : "Sin datos"}
                {hoverDatum?.rate != null && ` · ${fmt1.format(hoverDatum.rate)} /100.000 hab.`}
              </p>
              <p className="text-xs opacity-80">
                {periodLabel(choro.period)} · {PROCEDURE_LABEL[choro.procedure]}
              </p>
              {hoverDatum?.note && <p className="text-xs opacity-80">{hoverDatum.note}</p>}
            </div>
          )}
          {interactive && (
          <div className="absolute z-10 bottom-8 left-3 flex gap-2">
            <button type="button" className="btn btn-sm" onClick={() => setView(view === "canarias" ? "peninsula" : "canarias")}>
              {view === "canarias" ? "Península y Baleares" : "Canarias"}
            </button>
          </div>
          )}
        </div>

        {/* CONTROLES Y LEYENDA DE LA CAPA ESTADÍSTICA */}
        {layers.stats && (
          <div className="border-t-2 border-ink bg-card px-3 py-3 md:px-4" aria-label="Capa estadística">
            {choro ? (
              <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                <div className="min-w-[220px]">
                  <p className="kicker">
                    {METRIC_LABEL[choro.metric]} · {periodLabel(choro.period)}
                    {loadingStats && <span className="text-ink-3"> · actualizando…</span>}
                  </p>
                  <Legend breaks={classified.breaks} mode={opts.mode} />
                </div>
                <Select label="Nivel" value={opts.level} onChange={(v) => setOpts({ ...opts, level: v as StatsOptions["level"] })} options={[["province", "Provincia"], ["ccaa", "Comunidad autónoma"]]} />
                <Select label="Periodo" value={opts.period} onChange={(v) => setOpts({ ...opts, period: v })} options={[...periods].reverse().map((p) => [p, periodLabel(p)])} />
                <Select
                  label="Procedimiento"
                  value={opts.procedure}
                  onChange={(v) => setOpts({ ...opts, procedure: v as StatsOptions["procedure"] })}
                  options={Object.entries(PROCEDURE_LABEL)}
                />
                <Select
                  label="Medida"
                  value={opts.mode}
                  onChange={(v) => setOpts({ ...opts, mode: v as StatsOptions["mode"] })}
                  options={[["abs", "Número absoluto"], ...(hasRates ? [["rate", "Por 100.000 hab."] as [string, string]] : [])]}
                />
                <p className="text-xs text-ink-2 basis-full">
                  Fuente: <a href={choro.dataset.url} target="_blank" rel="noopener noreferrer">{choro.dataset.title}</a>. Datos agregados: cada
                  territorio muestra un total estadístico, no casos individuales. {choro.notes.join(" ")}{" "}
                  <a href="/metodologia#lanzamientos">Qué es un lanzamiento</a>.
                </p>
              </div>
            ) : (
              <p className="text-sm">
                <strong>Todavía no hay estadística cargada.</strong> La capa se activará cuando el ETL del CGPJ publique datos. Ver{" "}
                <a href="/fuentes">fuentes</a>.
              </p>
            )}
          </div>
        )}
      </section>

      {/* PANEL CONTEXTUAL */}
      <aside ref={panelRef} className="border-t-2 lg:border-t-0 lg:border-l-2 border-ink bg-paper lg:max-h-[calc(100svh-120px+var(--stats-h,0px))] lg:overflow-y-auto" aria-label="Panel de información">
        <SidePanel
          selection={selection}
          onSelect={select}
          events={props.events}
          orgs={props.orgs}
          choropleth={choro}
          now={now}
        />
      </aside>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input min-h-[40px] py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Legend({ breaks, mode }: { breaks: number[]; mode: StatsOptions["mode"] }) {
  const f = (v: number) => (mode === "rate" ? fmt1.format(v) : fmtInt.format(v));
  return (
    <div className="mt-1">
      <ol className="flex items-stretch gap-0.5" aria-label="Leyenda por quintiles">
        {breaks.map((b, i) => (
          <li key={i} className="flex-1 min-w-[44px]">
            <span className="block h-3 border border-ink/20" style={{ background: CLASS_COLORS[i] }} aria-hidden />
            <span className="block text-[11px] leading-tight mt-0.5">≤ {f(b)}</span>
          </li>
        ))}
        <li className="min-w-[56px] ml-2">
          <span className="block h-3 hatch border border-ink/20" aria-hidden />
          <span className="block text-[11px] leading-tight mt-0.5">Sin datos</span>
        </li>
      </ol>
      <p className="text-[11px] text-ink-3 mt-0.5">{mode === "rate" ? "Lanzamientos por 100.000 habitantes" : "Número de lanzamientos"} · clases por quintiles</p>
    </div>
  );
}
