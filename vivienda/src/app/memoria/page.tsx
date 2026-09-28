import type { Metadata } from "next";
import Link from "next/link";
import { primarySeries, periodsOf } from "@/server/stats";
import { svgMap } from "@/server/svgmap";
import { ALL_TERRITORIES } from "@/lib/territories";
import { periodLabel } from "@/lib/dates";
import { MemoryPlayer, type MemoryData } from "@/components/MemoryPlayer";
import { DataMeta } from "@/components/Provenance";
import { EmptyState } from "@/components/EventCard";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Memoria: la evolución de los desahucios en el territorio",
  description: "Reproduce año a año o trimestre a trimestre cómo cambian los lanzamientos practicados por provincia y comunidad autónoma en España.",
  alternates: { canonical: "/memoria" },
};

type SP = { nivel?: string; granularidad?: string };

export default async function MemoriaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await primarySeries("lanzamientos_practicados");
  const level = sp.nivel === "ccaa" ? "ccaa" : "province";
  const hasQuarters = s ? periodsOf(s.rows.filter((r) => r.territory_type === level), "quarter").length > 0 : false;
  const gran = sp.granularidad === "trimestre" && hasQuarters ? "quarter" : "year";

  let data: MemoryData | null = null;
  if (s) {
    const rows = s.rows.filter((r) => r.procedure_type === "total" && r.period_type === gran);
    const periods = periodsOf(rows.filter((r) => r.territory_type === level), gran);
    const values: MemoryData["values"] = {};
    const national: MemoryData["national"] = {};
    for (const r of rows) {
      if (r.territory_type === level) (values[r.period] ??= {})[r.territory_code] = r.value;
      if (r.territory_type === "country") national[r.period] = r.value;
    }
    const pop = await primarySeries("poblacion");
    let rates: MemoryData["rates"] = null;
    if (pop) {
      rates = {};
      for (const [p, byId] of Object.entries(values)) {
        for (const [id, v] of Object.entries(byId)) {
          const pp = pop.rows.find((x) => x.territory_code === id && x.period === p.slice(0, 4));
          if (pp && pp.value > 0) (rates[p] ??= {})[id] = (v / pp.value) * 100_000;
        }
      }
      if (!Object.keys(rates).length) rates = null;
    }
    const names = Object.fromEntries(ALL_TERRITORIES.map((t) => [t.id, t.shortName]));
    if (periods.length) data = { level, periods, values, rates, national, names };
  }

  return (
    <div className="mx-auto max-w-[1300px] px-4 md:px-6 py-6 md:py-10">
      <header className="mb-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="kicker text-signal">Memoria</p>
          <h1 className="headline text-4xl md:text-6xl mt-1">El mapa que cambia</h1>
          <p className="text-ink-2 mt-2 max-w-[70ch]">
            Cómo se han repartido los lanzamientos en el territorio a lo largo del tiempo.{" "}
            {data ? (
              <>
                La serie disponible va de <strong>{periodLabel(data.periods[0])}</strong> a <strong>{periodLabel(data.periods[data.periods.length - 1])}</strong>: no
                mostramos años ni desgloses que la fuente no publica.
              </>
            ) : null}
          </p>
        </div>
        <nav aria-label="Opciones" className="flex flex-wrap gap-2">
          <Link href={`/memoria?nivel=province&granularidad=${gran === "quarter" ? "trimestre" : "anio"}`} className={`btn btn-sm ${level === "province" ? "btn-ink" : ""}`}>
            Provincias
          </Link>
          <Link href={`/memoria?nivel=ccaa&granularidad=${gran === "quarter" ? "trimestre" : "anio"}`} className={`btn btn-sm ${level === "ccaa" ? "btn-ink" : ""}`}>
            CCAA
          </Link>
          <Link href={`/memoria?nivel=${level}&granularidad=anio`} className={`btn btn-sm ${gran === "year" ? "btn-ink" : ""}`}>
            Años
          </Link>
          {hasQuarters && (
            <Link href={`/memoria?nivel=${level}&granularidad=trimestre`} className={`btn btn-sm ${gran === "quarter" ? "btn-ink" : ""}`}>
              Trimestres
            </Link>
          )}
        </nav>
      </header>

      {!s || !data ? (
        <EmptyState title="Todavía no hay serie histórica cargada.">
          <p>La memoria se construirá con la estadística del CGPJ en cuanto el proceso de ingestión la publique.</p>
        </EmptyState>
      ) : (
        <>
          {s.dataset.demo && <p className="mb-3 inline-block bg-ink text-paper px-2 py-1 text-sm font-bold">DATOS DEMO / FICTICIOS · solo desarrollo</p>}
          <MemoryPlayer map={svgMap(level)} data={data} />
          <DataMeta
            source={{ name: s.dataset.title, url: s.dataset.url }}
            period={`${periodLabel(data.periods[0])} – ${periodLabel(data.periods[data.periods.length - 1])}`}
            updated={s.dataset.source_updated_at ?? s.dataset.retrieved_at}
            note={`Escala de color fija (quintiles de toda la serie) para que los periodos sean comparables. ${s.dataset.methodology}`}
            limitations={s.dataset.limitations}
            derived={s.rows.some((r) => r.derivation === "derived")}
          />
        </>
      )}
    </div>
  );
}
