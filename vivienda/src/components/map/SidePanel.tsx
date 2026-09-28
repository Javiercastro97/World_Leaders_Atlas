"use client";
import Link from "next/link";
import { EVENT_TYPE_LABEL, ORG_TYPE_LABEL, PROCEDURE_LABEL } from "@/lib/vocab";
import { humanDay, periodLabel } from "@/lib/dates";
import { getTerritory } from "@/lib/territories";
import { fmtInt, fmt1 } from "@/lib/site";
import type { Choropleth, MapOrg, PublicEvent, Selection } from "./types";
import { EventActions } from "../EventActions";
import { VerificationBadge, StatusBadge } from "../Provenance";

interface Props {
  selection: Selection;
  onSelect: (s: Selection) => void;
  events: PublicEvent[];
  orgs: MapOrg[];
  choropleth: Choropleth | null;
  now: Date;
}

export function SidePanel(p: Props) {
  const back = (
    <button type="button" className="btn btn-sm mb-3" onClick={() => p.onSelect(null)}>
      ← Próximas convocatorias
    </button>
  );
  if (p.selection?.kind === "event") {
    const e = p.events.find((x) => x.id === p.selection!.id);
    if (e)
      return (
        <div className="p-4">
          {back}
          <EventSummary e={e} now={p.now} />
        </div>
      );
  }
  if (p.selection?.kind === "org") {
    const o = p.orgs.find((x) => x.id === p.selection!.id);
    if (o)
      return (
        <div className="p-4">
          {back}
          <p className="kicker text-ink-3">{ORG_TYPE_LABEL[o.type]}</p>
          <h2 className="headline text-2xl mt-1">{o.name}</h2>
          <p className="text-sm mt-1">{[o.municipality_name, getTerritory(o.territory_id)?.shortName].filter(Boolean).join(" · ")}</p>
          <p className="text-sm mt-2">{o.verified ? "Ficha verificada por el equipo." : "Ficha pendiente de verificación."}</p>
          <Link href={`/colectivos/${o.slug}`} className="btn btn-ink mt-4">
            Ver ficha del colectivo
          </Link>
          <UpcomingList events={p.events.filter((x) => x.organization?.slug === o.slug)} onSelect={p.onSelect} now={p.now} title="Sus próximas convocatorias" />
        </div>
      );
  }
  if (p.selection?.kind === "territory") {
    const t = getTerritory(p.selection.id);
    const d = p.choropleth?.data.find((x) => x.id === p.selection!.id);
    const inTerritory = p.events.filter((e) => (t?.type === "province" ? e.location.province_id === t.id : getTerritory(e.location.province_id)?.parent === t?.id));
    if (t)
      return (
        <div className="p-4">
          {back}
          <p className="kicker text-ink-3">{t.type === "province" ? "Provincia" : "Comunidad autónoma"}</p>
          <h2 className="headline text-3xl mt-1">{t.shortName}</h2>
          {p.choropleth && (
            <div className="mt-4 border-t-2 border-ink pt-3">
              <p className="kicker">
                Lanzamientos practicados · {periodLabel(p.choropleth.period)} · {PROCEDURE_LABEL[p.choropleth.procedure]}
              </p>
              <p className="text-4xl font-black mt-1" style={{ fontStretch: "80%" }}>
                {d?.value != null ? fmtInt.format(d.value) : "Sin datos"}
              </p>
              {d?.rate != null && <p className="text-sm">{fmt1.format(d.rate)} por 100.000 habitantes</p>}
              {d?.note && <p className="text-sm text-ink-3">{d.note}</p>}
              <p className="text-xs text-ink-3 mt-2">
                Fuente: {p.choropleth.dataset.title}. {d?.derivation === "derived" && "Total calculado sumando los datos publicados."}
              </p>
              {t.type === "province" && (
                <Link href={`/desahucios/${t.slug}`} className="btn btn-sm mt-3">
                  Serie histórica de {t.shortName}
                </Link>
              )}
            </div>
          )}
          <UpcomingList events={inTerritory} onSelect={p.onSelect} now={p.now} title={`Convocatorias en ${t.shortName}`} />
          {t.type === "province" && (
            <Link href={`/agenda/${t.slug}`} className="text-sm font-bold">
              Agenda de {t.shortName} →
            </Link>
          )}
        </div>
      );
  }
  return (
    <div className="p-4">
      <UpcomingList events={p.events} onSelect={p.onSelect} now={p.now} title="Próximas convocatorias" big />
      <div className="flex flex-wrap gap-2 mt-4">
        <Link href="/agenda" className="btn btn-sm btn-ink">
          Agenda completa
        </Link>
        <Link href="/agenda#cerca" className="btn btn-sm">
          Cerca de ti
        </Link>
      </div>
    </div>
  );
}

function UpcomingList({ events, onSelect, now, title, big }: { events: PublicEvent[]; onSelect: Props["onSelect"]; now: Date; title: string; big?: boolean }) {
  const active = events.filter((e) => e.effective_status === "programada" || e.effective_status === "suspendida");
  const groups = new Map<string, PublicEvent[]>();
  for (const e of active) (groups.get(e.date) ?? groups.set(e.date, []).get(e.date)!).push(e);
  return (
    <section className="mt-2">
      <h2 className={big ? "headline text-2xl border-b-2 border-ink pb-2" : "kicker border-b-2 border-ink pb-1 mt-6"}>{title}</h2>
      {active.length === 0 ? (
        <p className="text-sm py-4 text-ink-2">
          No hay convocatorias públicas registradas para estas fechas. Si conoces alguna difundida por una organización,{" "}
          <Link href="/avisa">avísanos</Link>.
        </p>
      ) : (
        [...groups].map(([date, list]) => (
          <div key={date}>
            <h3 className="kicker text-signal mt-4 mb-1">{humanDay(date, now, list[0].timezone)}</h3>
            <ul>
              {list.map((e) => (
                <li key={e.id} className="border-t border-rule">
                  <button type="button" className="w-full text-left py-2.5 grid grid-cols-[52px_1fr] gap-2 hover:bg-paper-2 focus-visible:bg-paper-2" onClick={() => onSelect({ kind: "event", id: e.id })}>
                    <span className="font-black text-lg leading-tight" style={{ fontStretch: "80%" }}>
                      {e.time ?? "—"}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold leading-snug">
                        {e.location.municipality_name?.split("/").pop()} <span className="font-normal text-ink-3">· {EVENT_TYPE_LABEL[e.type]}</span>
                      </span>
                      <span className="block text-sm text-ink-2 truncate">{e.organizer_name}</span>
                      {e.effective_status === "suspendida" && <StatusBadge status="suspendida" />}
                      {e.verification_status === "pendiente" && <span className="block text-xs text-ink-3">□ Pendiente de verificación</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function EventSummary({ e, now }: { e: PublicEvent; now: Date }) {
  const t = getTerritory(e.location.province_id);
  return (
    <article>
      <p className="kicker text-signal">{EVENT_TYPE_LABEL[e.type]}</p>
      <h2 className="headline text-2xl mt-1">{e.title}</h2>
      <div className="flex flex-wrap gap-2 mt-2">
        <StatusBadge status={e.effective_status} />
        <VerificationBadge status={e.verification_status} />
      </div>
      <dl className="mt-3 grid grid-cols-[92px_1fr] gap-y-1 text-sm">
        <dt className="kicker text-ink-3 pt-0.5">Cuándo</dt>
        <dd className="font-bold text-base">
          {humanDay(e.date, now, e.timezone)} {e.time && `· ${e.time}`}
          {e.timezone === "Atlantic/Canary" && " (hora canaria)"}
        </dd>
        <dt className="kicker text-ink-3 pt-0.5">Dónde</dt>
        <dd>
          {[e.location.neighborhood, e.location.municipality_name, t?.shortName].filter(Boolean).join(" · ")}
          {e.location.meeting_point && <span className="block font-semibold">{e.location.meeting_point}</span>}
          {e.location.precision_note && <span className="block text-xs text-ink-3">{e.location.precision_note}</span>}
        </dd>
        <dt className="kicker text-ink-3 pt-0.5">Convoca</dt>
        <dd>{e.organization ? <Link href={`/colectivos/${e.organization.slug}`}>{e.organizer_name}</Link> : e.organizer_name}</dd>
      </dl>
      {e.description && <p className="mt-3 text-[15px]">{e.description}</p>}
      {e.source && (
        <div className="border-l-4 border-ink pl-3 py-1 mt-4">
          <p className="kicker">Fuente</p>
          <p className="font-bold text-sm">{e.source.name}</p>
        </div>
      )}
      <EventActions e={e} />
      <Link href={`/convocatorias/${e.slug}`} className="text-sm font-bold inline-block mt-3">
        Ficha completa →
      </Link>
    </article>
  );
}
