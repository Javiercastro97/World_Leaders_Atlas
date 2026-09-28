import type { Metadata } from "next";
import Link from "next/link";
import { primarySeries, timeSeries, periodsOf, latestPeriod, valueAt, choropleth } from "@/server/stats";
import { getRepo } from "@/server/repo";
import { CCAA, PROVINCES, getTerritory } from "@/lib/territories";
import { PROCEDURE_LABEL } from "@/lib/vocab";
import { periodLabel } from "@/lib/dates";
import { fmtInt, fmtPct, fmt1 } from "@/lib/site";
import { ColumnChart, StackedColumns, RankBars, DataTable } from "@/components/charts/Charts";
import { DataMeta } from "@/components/Provenance";
import { EmptyState } from "@/components/EventCard";
import type { Dataset, Statistic } from "@/lib/schema";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Observatorio de desahucios: datos y tendencias",
  description:
    "Lanzamientos practicados en España por año, trimestre, comunidad autónoma, provincia y tipo de procedimiento, según la estadística judicial del CGPJ. Con fuente, periodo y limitaciones.",
  alternates: { canonical: "/datos" },
};

type SP = { medida?: string; a?: string; b?: string; c?: string };

export default async function DatosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const series = await primarySeries("lanzamientos_practicados");
  const repo = await getRepo();
  const datasets = await repo.listDatasets();

  if (!series) {
    return (
      <Shell>
        <EmptyState title="Todavía no hay estadística cargada.">
          <p>
            El observatorio se alimenta de la estadística judicial del CGPJ mediante un proceso de ingestión reproducible. Hasta
            que se ejecute y se revise, esta página no muestra cifras: preferimos un vacío honesto a un dato sin fuente.
          </p>
          <p>
            Estado de las fuentes: <Link href="/fuentes">/fuentes</Link>. Metodología: <Link href="/metodologia">/metodologia</Link>.
          </p>
        </EmptyState>
        <OtherDatasets datasets={datasets} primary={null} />
      </Shell>
    );
  }

  const { rows, dataset } = series;
  const lastYear = latestPeriod(rows, "year");
  const annual = timeSeries(rows, { territory: "ES", periodType: "year" });
  const quarterly = timeSeries(rows, { territory: "ES", periodType: "quarter" }).slice(-24);
  const lastQ = quarterly[quarterly.length - 1];
  const lastA = annual[annual.length - 1];
  const years = periodsOf(rows, "year");
  const hasBreakdown = rows.some((r) => r.procedure_type !== "total");
  const mode = sp.medida === "tasa" ? "rate" : "abs";

  const [ccaaChoro, provChoro] = await Promise.all([
    choropleth({ level: "ccaa", period: lastYear ?? undefined }),
    choropleth({ level: "province", period: lastYear ?? undefined }),
  ]);
  const hasRate = Boolean(provChoro?.data.some((d) => d.rate != null));
  const effMode = hasRate ? mode : "abs";
  const rank = (c: typeof ccaaChoro, level: "ccaa" | "province") =>
    (c?.data ?? []).map((d) => {
      const t = getTerritory(d.id)!;
      return {
        id: d.id,
        label: t.shortName,
        value: effMode === "rate" ? d.rate : d.value,
        note: d.note,
        href: level === "province" ? `/desahucios/${t.slug}` : undefined,
      };
    });

  const meta = (period: string, extraNote?: string) => (
    <DataMeta
      source={{ name: dataset.title, url: dataset.url }}
      period={period}
      updated={dataset.source_updated_at ?? dataset.retrieved_at}
      note={extraNote ?? dataset.methodology}
      limitations={dataset.limitations}
      derived={rows.some((r) => r.derivation === "derived")}
    />
  );

  // Comparador
  const compareIds = [sp.a, sp.b, sp.c].map((x) => (x && getTerritory(x) ? x : null)).filter((x): x is string => Boolean(x));
  const cmp = compareIds.length ? compareIds : ["ES", "PR-28", "PR-08"].filter((id) => rows.some((r) => r.territory_code === id));
  const pop = await primarySeries("poblacion");
  const rateOf = (id: string, period: string) => {
    const v = valueAt(rows, { territory: id, period });
    const p = pop?.rows.find((r) => r.territory_code === id && r.period === period.slice(0, 4));
    return v && p ? (v.value / p.value) * 100_000 : null;
  };

  return (
    <Shell demo={dataset.demo}>
      <section className="grid gap-6 md:grid-cols-3 border-t-2 border-ink pt-4">
        <Stat label={`Lanzamientos practicados · ${lastA ? periodLabel(lastA.period) : "—"}`} value={lastA ? fmtInt.format(lastA.value) : "—"} sub={lastA?.yoy != null ? `${fmtPct(lastA.yoy)} respecto al año anterior` : "Sin año anterior comparable"} />
        <Stat label={`Último trimestre · ${lastQ ? periodLabel(lastQ.period) : "—"}`} value={lastQ ? fmtInt.format(lastQ.value) : "—"} sub={lastQ?.yoy != null ? `${fmtPct(lastQ.yoy)} vs. mismo trimestre del año anterior` : "—"} />
        <Stat label="Serie disponible" value={`${years[0] ?? "—"}–${years[years.length - 1] ?? "—"}`} sub={`${dataset.title}`} />
      </section>

      <Block id="anual" title="Evolución anual" subtitle="España · lanzamientos practicados por año">
        <ColumnChart data={annual.map((p) => ({ period: p.period, value: p.value, yoy: p.yoy, derived: p.derivation === "derived" }))} />
        {meta(`${annual[0]?.period ?? "—"}–${lastA?.period ?? "—"}`)}
      </Block>

      {quarterly.length > 0 && (
        <Block id="trimestral" title="Por trimestre" subtitle="España · últimos 24 trimestres disponibles">
          <ColumnChart data={quarterly.map((p) => ({ period: p.period, value: p.value, yoy: p.yoy, derived: p.derivation === "derived" }))} />
          {meta(`${periodLabel(quarterly[0].period)} – ${periodLabel(lastQ.period)}`, "La serie trimestral tiene estacionalidad (agosto es inhábil): compara cada trimestre con el mismo del año anterior, no con el previo.")}
        </Block>
      )}

      {hasBreakdown && (
        <Block id="procedimiento" title="Por tipo de procedimiento" subtitle="España · lanzamientos practicados por origen">
          <StackedColumns
            data={years.map((y) => ({
              period: y,
              parts: (["arrendamientos_urbanos", "ejecucion_hipotecaria", "otros"] as const).map((k) => ({
                key: k,
                label: PROCEDURE_LABEL[k],
                value: valueAt(rows, { territory: "ES", period: y, procedure: k })?.value ?? null,
              })),
            }))}
          />
          {meta(`${years[0]}–${lastYear}`, "Clasificación según el procedimiento que origina el lanzamiento: Ley de Arrendamientos Urbanos (impago de alquiler, fin de contrato), ejecución hipotecaria u otras causas (p. ej. ocupaciones, precario).")}
        </Block>
      )}

      <Block id="territorios" title="Por territorio" subtitle={`${lastYear ? periodLabel(lastYear) : ""} · ${effMode === "rate" ? "lanzamientos por 100.000 habitantes" : "número de lanzamientos"}`}>
        <div className="flex gap-2 mb-4" role="group" aria-label="Medida">
          <Link href="/datos?medida=abs#territorios" aria-current={effMode === "abs" ? "true" : undefined} className={`btn btn-sm ${effMode === "abs" ? "btn-ink" : ""}`}>
            Absoluto
          </Link>
          {hasRate ? (
            <Link href="/datos?medida=tasa#territorios" aria-current={effMode === "rate" ? "true" : undefined} className={`btn btn-sm ${effMode === "rate" ? "btn-ink" : ""}`}>
              Por 100.000 hab.
            </Link>
          ) : (
            <span className="text-sm text-ink-3 self-center">Sin datos de población cargados: no se calculan tasas.</span>
          )}
        </div>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="kicker mb-2">Comunidades autónomas</h3>
            <RankBars data={rank(ccaaChoro, "ccaa")} unit={effMode === "rate" ? "tasa" : "lanzamientos"} decimals={effMode === "rate" ? 1 : 0} />
            {ccaaChoro?.notes.map((n) => (
              <p key={n} className="text-xs text-ink-3 mt-2">
                * {n}
              </p>
            ))}
          </div>
          <div>
            <h3 className="kicker mb-2">Provincias</h3>
            <RankBars data={rank(provChoro, "province")} unit={effMode === "rate" ? "tasa" : "lanzamientos"} decimals={effMode === "rate" ? 1 : 0} />
          </div>
        </div>
        {meta(lastYear ? periodLabel(lastYear) : "—", effMode === "rate" ? `Tasa = lanzamientos / población a 1 de enero del mismo año (INE) × 100.000. ${dataset.methodology}` : undefined)}
      </Block>

      <Block id="comparador" title="Comparador territorial" subtitle="Hasta tres territorios, año a año">
        <form method="get" action="/datos#comparador" className="flex flex-wrap gap-3 items-end mb-4">
          {(["a", "b", "c"] as const).map((k, i) => (
            <label key={k} className="block">
              <span className="label">Territorio {i + 1}</span>
              <select name={k} className="input" defaultValue={cmp[i] ?? ""}>
                <option value="">—</option>
                <option value="ES">España</option>
                <optgroup label="Comunidades autónomas">
                  {CCAA.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shortName}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Provincias">
                  {[...PROVINCES].sort((x, y) => x.shortName.localeCompare(y.shortName, "es")).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.shortName}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          ))}
          <button type="submit" className="btn btn-ink">
            Comparar
          </button>
        </form>
        <div className="grid gap-6 md:grid-cols-3">
          {cmp.map((id) => (
            <div key={id}>
              <h3 className="headline text-lg">{id === "ES" ? "España" : getTerritory(id)?.shortName}</h3>
              <ColumnChart data={timeSeries(rows, { territory: id, periodType: "year" }).map((p) => ({ period: p.period, value: p.value, yoy: p.yoy, derived: p.derivation === "derived" }))} height={200} />
            </div>
          ))}
        </div>
        <p className="text-sm text-ink-3 mt-2">Cada gráfico tiene su propia escala: compara la forma de la evolución, no la altura de las barras. Para comparar magnitudes usa la tabla o la tasa.</p>
        <DataTable
          headers={["Año", ...cmp.flatMap((id) => [`${id === "ES" ? "España" : getTerritory(id)?.shortName}`, "por 100.000"])]}
          rows={years.map((y) => [y, ...cmp.flatMap((id) => [fmtOrDash(valueAt(rows, { territory: id, period: y })), rateStr(rateOf(id, y))])])}
        />
        {meta(`${years[0]}–${lastYear}`)}
      </Block>

      <OtherDatasets datasets={datasets} primary={dataset} />
    </Shell>
  );
}

const fmtOrDash = (s: Statistic | null) => (s ? fmtInt.format(s.value) : "—");
const rateStr = (r: number | null) => (r == null ? "—" : fmt1.format(r));

function Shell({ children, demo }: { children: React.ReactNode; demo?: boolean }) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6 md:py-10">
      <header className="mb-6">
        <p className="kicker text-signal">Observatorio</p>
        <h1 className="headline text-4xl md:text-5xl mt-1">Lanzamientos en España</h1>
        <p className="text-ink-2 mt-2 max-w-[72ch]">
          Estadística judicial agregada: cuántos lanzamientos (desalojos ordenados judicialmente) se practicaron, dónde y por qué
          tipo de procedimiento. No son casos individuales ni previsiones. <Link href="/metodologia#lanzamientos">Cómo leer estos datos</Link>.
        </p>
        {demo && <p className="mt-3 inline-block bg-ink text-paper px-2 py-1 text-sm font-bold">DATOS DEMO / FICTICIOS · solo desarrollo</p>}
      </header>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="kicker">{label}</p>
      <p className="text-4xl md:text-5xl font-black leading-tight" style={{ fontStretch: "78%" }}>
        {value}
      </p>
      <p className="text-sm text-ink-3">{sub}</p>
    </div>
  );
}

function Block({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 border-t-2 border-ink pt-4" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="headline text-2xl md:text-3xl">
        {title}
      </h2>
      <p className="text-sm text-ink-3 mb-4">{subtitle}</p>
      {children}
    </section>
  );
}

function OtherDatasets({ datasets, primary }: { datasets: Dataset[]; primary: Dataset | null }) {
  const others = datasets.filter((d) => d.id !== primary?.id && !d.id.includes("poblacion"));
  if (!others.length) return null;
  return (
    <section className="mt-12 border-t-2 border-ink pt-4">
      <h2 className="headline text-2xl">Otras series disponibles</h2>
      <p className="text-sm text-ink-3 mb-3">Series con cobertura parcial: se publican por separado y nunca se suman a la principal.</p>
      <ul className="space-y-4">
        {others.map((d) => (
          <li key={d.id} className="border-t border-rule pt-3">
            <p className="font-bold">{d.title}</p>
            <p className="text-sm">{d.methodology}</p>
            {d.limitations.length > 0 && (
              <ul className="list-[square] pl-5 text-sm text-ink-2">
                {d.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            <p className="text-sm">
              {d.first_period && `${d.first_period}–${d.last_period} · `}
              <a href={`/api/statistics?dataset=${d.id}`}>Datos (JSON)</a> ·{" "}
              <a href={d.url} target="_blank" rel="noopener noreferrer">
                Fuente
              </a>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
