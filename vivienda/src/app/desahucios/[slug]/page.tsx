import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CCAA, PROVINCES, getCcaaBySlug, getProvinceBySlug, getTerritory, provincesOf, type Territory } from "@/lib/territories";
import { PROCEDURE_LABEL } from "@/lib/vocab";
import { periodLabel, localDate, addDays } from "@/lib/dates";
import { fmtInt, fmtPct, fmt1, absoluteUrl } from "@/lib/site";
import { primarySeries, timeSeries, latestPeriod, procedureBreakdown, choropleth } from "@/server/stats";
import { listPublicEvents, upcoming } from "@/server/events";
import { getRepo } from "@/server/repo";
import { ColumnChart, RankBars } from "@/components/charts/Charts";
import { DataMeta } from "@/components/Provenance";
import { EventCard, EmptyState } from "@/components/EventCard";
import { JsonLd } from "@/components/JsonLd";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

function resolve(slug: string): Territory | null {
  return getProvinceBySlug(slug) ?? getCcaaBySlug(slug);
}

export function generateStaticParams() {
  return [...PROVINCES, ...CCAA].map((t) => ({ slug: t.slug }));
}

async function summary(t: Territory) {
  const s = await primarySeries("lanzamientos_practicados");
  if (!s) return null;
  const annual = timeSeries(s.rows, { territory: t.id, periodType: "year" });
  if (!annual.length) return { s, annual, last: null };
  return { s, annual, last: annual[annual.length - 1] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = resolve((await params).slug);
  if (!t) return {};
  const sm = await summary(t);
  const figure = sm?.last && !sm.s.dataset.demo ? ` En ${periodLabel(sm.last.period)} se practicaron ${fmtInt.format(sm.last.value)} lanzamientos según el CGPJ.` : "";
  const title = `Desahucios en ${t.shortName}: datos oficiales y convocatorias`;
  const description = `Lanzamientos practicados en ${t.name} por año y tipo de procedimiento, convocatorias públicas y colectivos de vivienda.${figure}`;
  return {
    title,
    description,
    alternates: { canonical: `/desahucios/${t.slug}` },
    openGraph: { title, description, url: absoluteUrl(`/desahucios/${t.slug}`) },
  };
}

export default async function TerritoryPage({ params }: Props) {
  const t = resolve((await params).slug);
  if (!t) notFound();
  const now = new Date();
  const sm = await summary(t);
  const lastYear = sm ? latestPeriod(sm.s.rows, "year") : null;
  const breakdown = sm?.last ? procedureBreakdown(sm.s.rows, t.id, sm.last.period) : null;
  const level = t.type === "province" ? "province" : "ccaa";
  const choro = sm ? await choropleth({ level, period: sm.last?.period ?? lastYear ?? undefined }) : null;
  const mine = choro?.data.find((d) => d.id === t.id);
  const ranked = choro ? [...choro.data].filter((d) => d.value != null).sort((a, b) => b.value! - a.value!) : [];
  const position = ranked.findIndex((d) => d.id === t.id) + 1;

  const events = upcoming(await listPublicEvents({ territory: t.id, from: localDate(now), to: addDays(localDate(now), 60) }, now)).slice(0, 6);
  const orgs = await (await getRepo()).listOrganizations({ territory: t.id });
  const parent = getTerritory(t.parent);
  const children = t.type === "ccaa" ? provincesOf(t.id) : [];

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Datos", item: absoluteUrl("/datos") },
      ...(parent && parent.type === "ccaa" ? [{ "@type": "ListItem", position: 2, name: parent.shortName, item: absoluteUrl(`/desahucios/${parent.slug}`) }] : []),
      { "@type": "ListItem", position: parent?.type === "ccaa" ? 3 : 2, name: t.shortName, item: absoluteUrl(`/desahucios/${t.slug}`) },
    ],
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6 md:py-10">
      <JsonLd data={breadcrumbs} />
      <nav aria-label="Migas" className="text-sm mb-2">
        <Link href="/datos">Datos</Link>
        {parent?.type === "ccaa" && (
          <>
            {" / "}
            <Link href={`/desahucios/${parent.slug}`}>{parent.shortName}</Link>
          </>
        )}
      </nav>
      <p className="kicker text-signal">{t.type === "province" ? "Provincia" : "Comunidad autónoma"}</p>
      <h1 className="headline text-4xl md:text-6xl mt-1">Desahucios en {t.shortName}</h1>

      {!sm || !sm.last ? (
        <EmptyState title={`Aún no hay estadística cargada para ${t.shortName}.`}>
          <p>Cuando el proceso de ingestión del CGPJ publique datos para este territorio aparecerán aquí, con su fuente y periodo.</p>
        </EmptyState>
      ) : (
        <>
          {/* Resumen redactado exclusivamente a partir de los datos */}
          <p className="prose-editorial mt-4 text-xl">
            En {periodLabel(sm.last.period)} se practicaron <strong>{fmtInt.format(sm.last.value)} lanzamientos</strong> en {t.name}
            {sm.last.yoy != null && <>, un {fmtPct(sm.last.yoy)} respecto a {Number(sm.last.period) - 1}</>}
            {mine?.rate != null && <> ({fmt1.format(mine.rate)} por cada 100.000 habitantes)</>}.
            {position > 0 && (
              <>
                {" "}
                Es la {position}.ª {t.type === "province" ? "provincia" : "comunidad"} con más lanzamientos de {ranked.length} con datos.
              </>
            )}
            {breakdown && breakdown[0].value != null && sm.last.value > 0 && (
              <>
                {" "}
                El {fmt1.format((breakdown[0].value / sm.last.value) * 100)} % derivó de procedimientos de arrendamiento urbano.
              </>
            )}
          </p>
          {sm.s.dataset.demo && <p className="mt-2 inline-block bg-ink text-paper px-2 py-1 text-sm font-bold">DATOS DEMO / FICTICIOS · solo desarrollo</p>}

          <section className="mt-10 border-t-2 border-ink pt-4">
            <h2 className="headline text-2xl">Evolución anual</h2>
            <ColumnChart data={sm.annual.map((p) => ({ period: p.period, value: p.value, yoy: p.yoy, derived: p.derivation === "derived" }))} />
            {breakdown && (
              <div className="mt-6">
                <h3 className="kicker mb-2">Por tipo de procedimiento · {periodLabel(sm.last.period)}</h3>
                <RankBars data={breakdown.map((b) => ({ id: b.type, label: PROCEDURE_LABEL[b.type], value: b.value }))} unit="lanzamientos" />
              </div>
            )}
            <DataMeta
              source={{ name: sm.s.dataset.title, url: sm.s.dataset.url }}
              period={`${sm.annual[0].period}–${sm.last.period}`}
              updated={sm.s.dataset.source_updated_at ?? sm.s.dataset.retrieved_at}
              note={sm.s.dataset.methodology}
              limitations={sm.s.dataset.limitations}
              derived={sm.annual.some((p) => p.derivation === "derived")}
            />
          </section>
        </>
      )}

      {children.length > 0 && (
        <section className="mt-10 border-t-2 border-ink pt-4">
          <h2 className="kicker mb-2">Provincias de {t.shortName}</h2>
          <ul className="flex flex-wrap gap-2">
            {children.map((c) => (
              <li key={c.id}>
                <Link href={`/desahucios/${c.slug}`} className="btn btn-sm">
                  {c.shortName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 border-t-2 border-ink pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="headline text-2xl">Próximas convocatorias</h2>
          {t.type === "province" && <Link href={`/agenda/${t.slug}`}>Agenda de {t.shortName} →</Link>}
        </div>
        {events.length ? events.map((e) => <EventCard key={e.id} e={e} now={now} />) : <p className="text-ink-2 py-3">No hay convocatorias públicas registradas en los próximos 60 días.</p>}
      </section>

      <section className="mt-10 border-t-2 border-ink pt-4">
        <h2 className="headline text-2xl">Colectivos</h2>
        {orgs.length ? (
          <ul className="grid md:grid-cols-2 gap-x-8">
            {orgs.map((o) => (
              <li key={o.id} className="border-t border-rule py-2">
                <Link href={`/colectivos/${o.slug}`} className="font-bold">
                  {o.name}
                </Link>
                <span className="block text-sm text-ink-3">{o.municipality_name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-2 py-3">
            No hay colectivos registrados en {t.shortName}. <Link href="/colectivos#proponer">Propón uno</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
