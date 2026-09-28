import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/server/repo";
import { listPublicEvents, upcoming } from "@/server/events";
import { getProvinceBySlug, getTerritory } from "@/lib/territories";
import { ORG_TYPES, ORG_TYPE_LABEL, type OrgType } from "@/lib/vocab";
import { addDays, localDate, formatDateTime } from "@/lib/dates";
import { absoluteUrl } from "@/lib/site";
import { OrgDirectory, orgPlace } from "@/components/OrgDirectory";
import { EventCard } from "@/components/EventCard";
import { SourceBox } from "@/components/Provenance";
import { DemoTag } from "@/components/DemoBanner";
import { JsonLd } from "@/components/JsonLd";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ tipo?: string; q?: string }> };

/** Un mismo segmento sirve a provincias (/colectivos/madrid) y organizaciones: los slugs de organización no pueden coincidir con un territorio. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = getProvinceBySlug(slug);
  if (p) {
    return {
      title: `Colectivos por la vivienda en ${p.shortName}`,
      description: `Sindicatos de vivienda, PAH, asociaciones vecinales y plataformas en la provincia de ${p.name}.`,
      alternates: { canonical: `/colectivos/${p.slug}` },
    };
  }
  const o = await (await getRepo()).getOrganization(slug);
  if (!o) return {};
  return {
    title: o.name,
    description: o.description.slice(0, 160) || `${ORG_TYPE_LABEL[o.type]} en ${o.municipality_name ?? getTerritory(o.territory_id)?.shortName}.`,
    alternates: { canonical: `/colectivos/${o.slug}` },
    robots: o.demo ? { index: false } : undefined,
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const repo = await getRepo();
  const province = getProvinceBySlug(slug);
  if (province) {
    const sp = await searchParams;
    const type = ORG_TYPES.includes(sp.tipo as OrgType) ? (sp.tipo as OrgType) : undefined;
    const orgs = await repo.listOrganizations({ territory: province.id, type, q: sp.q || undefined });
    return (
      <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-6 md:py-10">
        <nav aria-label="Migas" className="text-sm mb-2">
          <Link href="/colectivos">Colectivos</Link> / {province.shortName}
        </nav>
        <h1 className="headline text-4xl md:text-5xl mb-6">Colectivos en {province.shortName}</h1>
        <OrgDirectory orgs={orgs} base={`/colectivos/${province.slug}`} type={type} q={sp.q} fixedTerritory={province.id} />
      </div>
    );
  }

  const o = await repo.getOrganization(slug);
  if (!o) notFound();
  const now = new Date();
  const [source, events, past] = await Promise.all([
    repo.getSource(o.source_id),
    listPublicEvents({ organizationId: o.id, from: localDate(now) }, now),
    listPublicEvents({ organizationId: o.id, from: addDays(localDate(now), -180), to: addDays(localDate(now), -1) }, now),
  ]);
  const next = upcoming(events);
  const t = getTerritory(o.territory_id);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: o.name,
    description: o.description || undefined,
    url: o.website ?? absoluteUrl(`/colectivos/${o.slug}`),
    sameAs: o.social_links.map((s) => s.url),
    areaServed: t?.name,
    address: { "@type": "PostalAddress", addressLocality: o.municipality_name ?? undefined, addressRegion: t?.name, addressCountry: "ES" },
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 md:px-6 py-6 md:py-10">
      {!o.demo && <JsonLd data={jsonLd} />}
      <nav aria-label="Migas" className="text-sm mb-2">
        <Link href="/colectivos">Colectivos</Link>
        {t && t.type === "province" && (
          <>
            {" / "}
            <Link href={`/colectivos/${t.slug}`}>{t.shortName}</Link>
          </>
        )}
      </nav>
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <p className="kicker text-ink-3">
            {ORG_TYPE_LABEL[o.type]} {o.demo && <DemoTag />}
          </p>
          <h1 className="headline text-4xl md:text-5xl mt-1">{o.name}</h1>
          <p className="mt-2 text-ink-2">
            {orgPlace(o.municipality_name, o.territory_id)} · ámbito {o.scope}
          </p>
          <p className="mt-2 text-sm">{o.verified ? "■ Ficha verificada por el equipo" : "□ Ficha pendiente de verificación"}</p>
          {o.description && <p className="prose-editorial mt-6">{o.description}</p>}

          <section className="mt-10 border-t-2 border-ink pt-3">
            <h2 className="headline text-2xl">Próximas convocatorias públicas</h2>
            {next.length ? next.map((e) => <EventCard key={e.id} e={e} now={now} />) : <p className="py-3 text-ink-2">No hay convocatorias públicas registradas de esta organización.</p>}
          </section>
          {past.length > 0 && (
            <section className="mt-8">
              <h2 className="kicker">Actividad reciente (últimos 6 meses)</h2>
              <ul className="mt-2">
                {past.map((e) => (
                  <li key={e.id} className="border-t border-rule py-2 text-sm">
                    <Link href={`/convocatorias/${e.slug}`}>{e.title}</Link> <span className="text-ink-3">· {e.date}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="space-y-5">
          <dl className="space-y-3 text-sm border-t-2 border-ink pt-3">
            {o.website && (
              <div>
                <dt className="kicker text-ink-3">Web</dt>
                <dd>
                  <a href={o.website} target="_blank" rel="noopener noreferrer">
                    {o.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                </dd>
              </div>
            )}
            {o.social_links.length > 0 && (
              <div>
                <dt className="kicker text-ink-3">Redes</dt>
                <dd>
                  <ul>
                    {o.social_links.map((s) => (
                      <li key={s.url}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                          {s.network}
                        </a>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {o.public_contact && (
              <div>
                <dt className="kicker text-ink-3">Contacto público</dt>
                <dd>{o.public_contact}</dd>
              </div>
            )}
            <div>
              <dt className="kicker text-ink-3">Última actualización</dt>
              <dd>{formatDateTime(o.updated_at)}</dd>
            </div>
          </dl>
          <SourceBox source={source} now={now} />
          <p className="text-xs">
            ¿Eres de esta organización o hay un error? <Link href={`/reportar?tipo=organization&id=${o.slug}`}>Solicita una corrección</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}
