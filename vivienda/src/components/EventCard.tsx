import Link from "next/link";
import { EVENT_TYPE_LABEL } from "@/lib/vocab";
import { humanDay } from "@/lib/dates";
import { getTerritory } from "@/lib/territories";
import type { PublicEvent } from "@/server/events";
import { StatusBadge, VerificationBadge } from "./Provenance";
import { DemoTag } from "./DemoBanner";

export function placeLine(e: Pick<PublicEvent, "location">): string {
  const prov = getTerritory(e.location.province_id)?.shortName;
  const muni = e.location.municipality_name?.split("/").map((s) => s.trim()).join(" / ");
  const provRedundant = !prov || (muni ?? "").toLowerCase().includes(prov.toLowerCase());
  return [e.location.neighborhood, muni, provRedundant ? null : prov].filter(Boolean).join(" · ");
}

/** Tarjeta de agenda: fecha/hora grandes, quién convoca y enlace al original siempre visibles. */
export function EventCard({ e, now, headingLevel = 3 }: { e: PublicEvent; now: Date; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const inactive = e.effective_status !== "programada";
  return (
    <article className={`grid grid-cols-[76px_1fr] gap-4 py-4 border-t border-rule ${inactive ? "opacity-80" : ""}`} data-testid="event-card">
      <div className="text-center border-2 border-ink self-start">
        <div className="bg-ink text-paper text-[11px] font-black uppercase tracking-wider py-0.5">{humanDay(e.date, now, e.timezone, "short").split(",")[0]}</div>
        <div className="py-1">
          <div className="text-2xl font-black leading-none" style={{ fontStretch: "80%" }}>
            {e.date.slice(8, 10)}/{e.date.slice(5, 7)}
          </div>
          <div className="text-lg font-bold leading-tight">{e.time ?? "—"}</div>
        </div>
      </div>
      <div className="min-w-0">
        <p className="kicker text-signal mb-1">
          {EVENT_TYPE_LABEL[e.type]} {e.demo && <DemoTag />}
        </p>
        <H className="headline text-lg md:text-xl">
          <Link href={`/convocatorias/${e.slug}`} className="no-underline hover:underline">
            {e.title}
          </Link>
        </H>
        <p className="text-sm mt-1">
          <span className="text-ink-3">Convoca:</span>{" "}
          {e.organization ? <Link href={`/colectivos/${e.organization.slug}`}>{e.organizer_name}</Link> : <strong>{e.organizer_name}</strong>}
        </p>
        <p className="text-sm text-ink-2">{placeLine(e)}</p>
        {e.location.meeting_point && <p className="text-sm font-semibold">Punto de encuentro: {e.location.meeting_point}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <StatusBadge status={e.effective_status} />
          <VerificationBadge status={e.verification_status} />
          {e.source && (
            <a href={e.source.url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm font-bold ml-auto">
              Convocatoria original ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="border-2 border-dashed border-ink-3 p-5 my-4" role="status">
      <p className="headline text-lg mb-1">{title}</p>
      {children && <div className="text-sm text-ink-2 space-y-2">{children}</div>}
    </div>
  );
}
