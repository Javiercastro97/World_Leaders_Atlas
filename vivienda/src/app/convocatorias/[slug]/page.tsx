import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicEvent } from "@/server/events";
import { EVENT_TYPE_LABEL } from "@/lib/vocab";
import { eventEnd, eventStart, formatDateLong, formatDateTime, humanDay } from "@/lib/dates";
import { getTerritory } from "@/lib/territories";
import { absoluteUrl, SITE } from "@/lib/site";
import { SourceBox, StatusBadge, VerificationBadge } from "@/components/Provenance";
import { EventActions } from "@/components/EventActions";
import { placeLine } from "@/components/EventCard";
import { DemoTag } from "@/components/DemoBanner";
import { JsonLd } from "@/components/JsonLd";

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const r = await getPublicEvent(slug);
  if (!r) return { title: "Convocatoria no encontrada" };
  const e = r.event;
  const place = [e.location.municipality_name, getTerritory(e.location.province_id)?.shortName].filter(Boolean).join(", ");
  const description = `${EVENT_TYPE_LABEL[e.type]} · ${formatDateLong(e.date)}${e.time ? ` · ${e.time}` : ""} · ${place}. Convoca: ${e.organizer_name}.`;
  return {
    title: e.title,
    description,
    alternates: { canonical: `/convocatorias/${slug}` },
    openGraph: { title: e.title, description, type: "article", url: absoluteUrl(`/convocatorias/${slug}`) },
    twitter: { card: "summary_large_image", title: e.title, description },
    robots: e.demo ? { index: false } : undefined,
  };
}

const STATUS_SCHEMA: Record<string, string> = {
  programada: "https://schema.org/EventScheduled",
  cancelada: "https://schema.org/EventCancelled",
  suspendida: "https://schema.org/EventPostponed",
  realizada: "https://schema.org/EventScheduled",
};

export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  const now = new Date();
  const r = await getPublicEvent(slug, now);
  if (!r) notFound();
  const e = r.event;
  const prov = getTerritory(e.location.province_id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    description: e.description || undefined,
    startDate: e.time ? eventStart(r.raw).toISOString() : e.date,
    endDate: e.time ? eventEnd(r.raw).toISOString() : undefined,
    eventStatus: STATUS_SCHEMA[e.effective_status],
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: e.location.meeting_point ?? e.location.neighborhood ?? e.location.municipality_name ?? prov?.shortName,
      address: { "@type": "PostalAddress", addressLocality: e.location.municipality_name ?? undefined, addressRegion: prov?.name, addressCountry: "ES" },
      geo: { "@type": "GeoCoordinates", latitude: e.location.latitude, longitude: e.location.longitude },
    },
    organizer: { "@type": "Organization", name: e.organizer_name, url: e.organization ? absoluteUrl(`/colectivos/${e.organization.slug}`) : undefined },
    isAccessibleForFree: true,
    url: absoluteUrl(`/convocatorias/${slug}`),
    sameAs: e.source?.url,
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 md:px-6 py-6 md:py-10">
      {!e.demo && <JsonLd data={jsonLd} />}
      <nav aria-label="Migas" className="text-sm mb-4">
        <Link href="/agenda">Agenda</Link>
        {prov && (
          <>
            {" / "}
            <Link href={`/agenda/${prov.slug}`}>{prov.shortName}</Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
        <article>
          <p className="kicker text-signal">
            {EVENT_TYPE_LABEL[e.type]} {e.demo && <DemoTag />}
          </p>
          <h1 className="headline text-3xl md:text-5xl mt-2">{e.title}</h1>
          <div className="flex flex-wrap gap-2 mt-4">
            <StatusBadge status={e.effective_status} />
            <VerificationBadge status={e.verification_status} withHelp />
          </div>

          <dl className="mt-6 border-t-2 border-ink divide-y divide-rule">
            <Row label="Fecha">
              <span className="text-2xl font-black" style={{ fontStretch: "82%" }}>
                {humanDay(e.date, now, e.timezone)}
              </span>
              <span className="block text-ink-2">{formatDateLong(e.date)}</span>
            </Row>
            <Row label="Hora">
              <span className="text-2xl font-black" style={{ fontStretch: "82%" }}>
                {e.time ?? "Sin hora publicada"}
                {e.end_time && `–${e.end_time}`}
              </span>
              {e.timezone === "Atlantic/Canary" && <span className="block text-ink-2">Hora canaria</span>}
            </Row>
            <Row label="Lugar">
              {e.location.meeting_point && <span className="block text-lg font-bold">{e.location.meeting_point}</span>}
              <span className="block">{placeLine(e)}</span>
              {e.location.precision_note && <span className="block text-sm text-ink-3 mt-1">{e.location.precision_note}</span>}
            </Row>
            <Row label="Convoca">
              {e.organization ? (
                <Link href={`/colectivos/${e.organization.slug}`} className="font-bold">
                  {e.organizer_name}
                </Link>
              ) : (
                <span className="font-bold">{e.organizer_name}</span>
              )}
            </Row>
          </dl>

          {/* En móvil, las acciones justo tras fecha, hora y lugar */}
          <div className="md:hidden">
            <EventActions e={e} />
          </div>

          {e.description && (
            <div className="mt-6">
              <h2 className="kicker mb-2">Descripción</h2>
              <p className="prose-editorial whitespace-pre-line">{e.description}</p>
            </div>
          )}

          <dl className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm border-t border-rule pt-4">
            {e.submitted_at && <Meta label="Aviso recibido" value={formatDateTime(e.submitted_at)} />}
            <Meta label="Fecha de verificación" value={e.verified_at ? formatDateTime(e.verified_at) : "Sin verificar"} />
            <Meta label="Última comprobación" value={formatDateTime(e.last_checked_at)} />
            <Meta label="Última actualización" value={formatDateTime(e.updated_at)} />
          </dl>
        </article>

        <aside className="md:sticky md:top-4 self-start space-y-5">
          <SourceBox source={e.source} now={now} />
          <div className="hidden md:block">
            <EventActions e={e} />
          </div>
          <p className="text-xs text-ink-3">
            {SITE.name} no organiza esta convocatoria: recoge lo que difunde públicamente la organización convocante. Solo mostramos
            ubicaciones publicadas por ella como punto de encuentro.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 py-3">
      <dt className="kicker text-ink-3 pt-1.5">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="kicker text-ink-3">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
