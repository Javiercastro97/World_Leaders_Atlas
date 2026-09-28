import Link from "next/link";
import { AGENDA_TABS, AGENDA_TAB_LABEL, inAgendaTab, localDate, type AgendaTab } from "@/lib/dates";
import { EVENT_TYPES, EVENT_TYPE_LABEL, type EventType } from "@/lib/vocab";
import { PROVINCES, getTerritory } from "@/lib/territories";
import { listPublicEvents, upcoming } from "@/server/events";
import { getRepo } from "@/server/repo";
import { EventCard, EmptyState } from "./EventCard";
import { NearMe } from "./NearMe";

export interface AgendaParams {
  tab?: string;
  provincia?: string;
  municipio?: string;
  desde?: string;
  hasta?: string;
  tipo?: string;
  org?: string;
}

const isDate = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

export async function AgendaView({ params, fixedProvince }: { params: AgendaParams; fixedProvince?: string }) {
  const now = new Date();
  const tab: AgendaTab = AGENDA_TABS.includes(params.tab as AgendaTab) ? (params.tab as AgendaTab) : "semana";
  const province = fixedProvince ?? (getTerritory(params.provincia)?.type === "province" ? params.provincia : undefined);
  const type = EVENT_TYPES.includes(params.tipo as EventType) ? (params.tipo as EventType) : undefined;
  const repo = await getRepo();
  const orgs = await repo.listOrganizations(province ? { territory: province } : {});
  const org = params.org ? orgs.find((o) => o.slug === params.org) : undefined;
  const from = isDate(params.desde) ?? localDate(now);
  const to = isDate(params.hasta);

  const all = upcoming(
    await listPublicEvents(
      { territory: province, municipality: params.municipio || undefined, from, to, types: type ? [type] : undefined, organizationId: org?.id },
      now,
    ),
  );
  const events = params.desde || params.hasta ? all : all.filter((e) => inAgendaTab(e, tab, now));
  const counts = Object.fromEntries(AGENDA_TABS.map((t) => [t, all.filter((e) => inAgendaTab(e, t, now)).length]));
  const base = fixedProvince ? `/agenda/${getTerritory(fixedProvince)!.slug}` : "/agenda";
  const keep = (t: AgendaTab) => {
    const q = new URLSearchParams();
    q.set("tab", t);
    for (const k of ["provincia", "municipio", "tipo", "org"] as const) if (params[k] && !(k === "provincia" && fixedProvince)) q.set(k, params[k]!);
    return `${base}?${q}`;
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <nav aria-label="Periodo" className="flex border-b-2 border-ink overflow-x-auto">
          {AGENDA_TABS.map((t) => (
            <Link
              key={t}
              href={keep(t)}
              aria-current={t === tab && !params.desde && !params.hasta ? "page" : undefined}
              className={`px-3 md:px-5 min-h-[48px] inline-flex items-center gap-2 no-underline font-extrabold uppercase text-[13px] tracking-[0.06em] whitespace-nowrap ${
                t === tab && !params.desde && !params.hasta ? "bg-ink text-paper" : "hover:bg-paper-2"
              }`}
            >
              {AGENDA_TAB_LABEL[t]}
              <span className="font-normal">{counts[t]}</span>
            </Link>
          ))}
        </nav>
        <p className="text-sm text-ink-3 mt-2">
          {tab === "semana" && !params.desde ? "Hoy y los 6 días siguientes. " : ""}
          Horas en la zona horaria de cada convocatoria. Ordenadas por fecha.
        </p>

        <section aria-live="polite" aria-label="Convocatorias">
          {events.length ? (
            events.map((e) => <EventCard key={e.id} e={e} now={now} headingLevel={2} />)
          ) : (
            <EmptyState title="No hay convocatorias públicas registradas con estos criterios.">
              <p>
                Solo publicamos convocatorias difundidas por organizaciones y revisadas por moderación. Si conoces alguna,{" "}
                <Link href="/avisa">avísanos con el enlace a la publicación original</Link>.
              </p>
            </EmptyState>
          )}
        </section>
      </div>

      <aside className="space-y-8">
        <form method="get" action={base} className="space-y-3 border-t-2 border-ink pt-3" aria-label="Filtros">
          <p className="kicker">Filtrar</p>
          <input type="hidden" name="tab" value={tab} />
          {!fixedProvince && (
            <div className="field">
              <label htmlFor="f-prov">Provincia</label>
              <select id="f-prov" name="provincia" className="input" defaultValue={province ?? ""}>
                <option value="">Todas</option>
                {[...PROVINCES].sort((a, b) => a.shortName.localeCompare(b.shortName, "es")).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="f-muni">Municipio</label>
            <input id="f-muni" name="municipio" className="input" defaultValue={params.municipio ?? ""} placeholder="p. ej. Elche" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="field">
              <label htmlFor="f-desde">Desde</label>
              <input id="f-desde" type="date" name="desde" className="input" defaultValue={isDate(params.desde) ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="f-hasta">Hasta</label>
              <input id="f-hasta" type="date" name="hasta" className="input" defaultValue={to ?? ""} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="f-tipo">Tipo</label>
            <select id="f-tipo" name="tipo" className="input" defaultValue={type ?? ""}>
              <option value="">Todos</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-org">Organización</label>
            <select id="f-org" name="org" className="input" defaultValue={org?.slug ?? ""}>
              <option value="">Todas</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ink flex-1" type="submit">
              Aplicar
            </button>
            <Link href={base} className="btn">
              Limpiar
            </Link>
          </div>
        </form>

        <NearMe />
      </aside>
    </div>
  );
}
