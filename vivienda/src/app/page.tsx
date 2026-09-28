import Link from "next/link";
import { MapExplorer } from "@/components/map/MapExplorer";
import type { MapOrg } from "@/components/map/types";
import { listPublicEvents, upcoming } from "@/server/events";
import { choropleth, latestPeriod, periodsOf, primarySeries, valueAt } from "@/server/stats";
import { getRepo } from "@/server/repo";
import { addDays, localDate, inAgendaTab, periodLabel } from "@/lib/dates";
import { fmtInt } from "@/lib/site";
import { svgMap, projectPoint } from "@/server/svgmap";

export const revalidate = 300;

export default async function Home() {
  const now = new Date();
  const today = localDate(now);
  const repo = await getRepo();
  const [events, orgs, series, initialChoropleth] = await Promise.all([
    listPublicEvents({ from: addDays(today, -1), to: addDays(today, 90) }, now),
    repo.listOrganizations(),
    primarySeries("lanzamientos_practicados"),
    choropleth({ level: "province" }),
  ]);
  const active = upcoming(events);
  const next7 = active.filter((e) => inAgendaTab(e, "semana", now) && e.effective_status === "programada");
  const provincesWithActivity = new Set(active.filter((e) => e.date <= addDays(today, 30)).map((e) => e.location.province_id));

  const lastYear = series ? latestPeriod(series.rows, "year") : null;
  const national = series && lastYear ? valueAt(series.rows, { territory: "ES", period: lastYear, level: "country" }) : null;

  const mapOrgs: MapOrg[] = orgs
    .filter((o) => o.latitude != null && o.longitude != null)
    .map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      type: o.type,
      latitude: o.latitude!,
      longitude: o.longitude!,
      territory_id: o.territory_id,
      municipality_name: o.municipality_name,
      verified: o.verified,
      demo: o.demo,
    }));


  const counters = (
    <dl aria-label="Indicadores" className="grid grid-cols-2 md:grid-cols-4 border-t-2 border-ink">
      <Counter
        label="Lanzamientos"
        value={national ? fmtInt.format(national.value) : "—"}
        context={
          national && lastYear && series
            ? `Practicados · ${periodLabel(lastYear)} · ${series.dataset.demo ? "DEMO" : "CGPJ"}`
            : "Estadística aún no cargada"
        }
        href="/datos"
      />
      <Counter label="Convocatorias" value={fmtInt.format(next7.length)} context="Próximos 7 días" href="/agenda?tab=semana" />
      <Counter label="Colectivos" value={fmtInt.format(orgs.length)} context="En el directorio" href="/colectivos" />
      <Counter
        label="Territorios"
        value={fmtInt.format(provincesWithActivity.size)}
        context="Provincias con convocatorias en 30 días"
        href="/agenda"
      />
    </dl>
  );

  return (
    <>
      <section className="mx-auto max-w-[1600px] px-4 md:px-6 pt-5 pb-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] xl:items-end">
        <div>
          <h1 className="display text-[34px] md:text-[54px] uppercase">
            La vivienda <br className="hidden md:block xl:hidden" />
            tiene <span className="text-signal">mapa.</span>
          </h1>
          <p className="text-base md:text-lg mt-1 md:mt-2 text-ink-2 max-w-[52ch]">Datos, convocatorias y organización por el derecho a la vivienda.</p>
        </div>
        {/* En escritorio los contadores acompañan al titular; en móvil van tras el mapa. */}
        <div className="hidden md:block">{counters}</div>
      </section>

      <div className="mt-1 md:mt-2">
        <MapExplorer
          events={events}
          orgs={mapOrgs}
          initialChoropleth={initialChoropleth}
          years={series ? periodsOf(series.rows, "year") : []}
          quarters={series ? periodsOf(series.rows, "quarter") : []}
          nowIso={now.toISOString()}
          preview={svgMap("province", "light")}
          previewPoints={active.map((e) => {
            const [x, y] = projectPoint(e.location.longitude, e.location.latitude);
            return { id: e.id, x: Math.round(x), y: Math.round(y), pending: e.verification_status === "pendiente" };
          })}
        />
      </div>

      <div className="md:hidden px-4 mt-6">{counters}</div>

      <section className="mx-auto max-w-[1600px] px-4 md:px-6 mt-10 grid gap-8 md:grid-cols-3">
        <Explainer title="Estadística ≠ casos" href="/metodologia#lanzamientos">
          La capa gris es estadística judicial agregada por territorio. Nunca se convierte en puntos: un número por provincia no
          dice dónde vive nadie.
        </Explainer>
        <Explainer title="Cada punto tiene fuente" href="/metodologia#verificacion">
          Los puntos rojos son convocatorias públicas difundidas por organizaciones. Cada una enlaza a su publicación original y
          muestra su estado de verificación.
        </Explainer>
        <Explainer title="Sin datos personales" href="/privacidad">
          No guardamos datos de personas afectadas. Tras cada convocatoria, la ubicación se reduce automáticamente a barrio o
          municipio.
        </Explainer>
      </section>
    </>
  );
}

function Counter({ label, value, context, href }: { label: string; value: string; context: string; href: string }) {
  return (
    <div className="border-b border-rule odd:border-r md:border-r md:last:border-r-0 py-2 px-3 first:pl-0 md:[&:nth-child(3)]:pl-3 [&:nth-child(3)]:pl-0">
      <dt className="kicker">
        <Link href={href} className="no-underline hover:underline">
          {label}
        </Link>
      </dt>
      <dd>
        <span className="block text-3xl font-black leading-tight" style={{ fontStretch: "78%" }}>
          {value}
        </span>
        <span className="block text-[12px] leading-snug text-ink-3">{context}</span>
      </dd>
    </div>
  );
}

function Explainer({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="rule-top pt-3">
      <h2 className="headline text-xl">{title}</h2>
      <p className="mt-1 text-ink-2">{children}</p>
      <Link href={href} className="text-sm font-bold">
        Saber más →
      </Link>
    </div>
  );
}
