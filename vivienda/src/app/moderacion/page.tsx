import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRepo } from "@/server/repo";
import { isModeratorCookie, MOD_COOKIE } from "@/server/http";
import { EVENT_TYPE_LABEL, SOURCE_TYPES, VERIFICATION_STATUSES } from "@/lib/vocab";
import { getTerritory } from "@/lib/territories";
import { formatDateTime } from "@/lib/dates";
import type { Submission, SubmissionStatus } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Moderación", robots: { index: false, follow: false } };

const COLUMNS: { status: SubmissionStatus; title: string }[] = [
  { status: "submitted", title: "Recibidos" },
  { status: "pending_review", title: "En revisión" },
  { status: "verified", title: "Verificados (listos para publicar)" },
  { status: "published", title: "Publicados" },
  { status: "rejected", title: "Rechazados" },
];

const FLAG_LABEL: Record<string, string> = {
  dni_nie: "DNI/NIE retirado",
  iban: "IBAN retirado",
  telefono: "Teléfono retirado",
  email: "Email retirado",
  posible_domicilio: "Posible domicilio (piso/puerta)",
  posible_dato_personal: "Posible dato personal",
};

export default async function ModeracionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const jar = await cookies();
  if (!process.env.MODERATION_TOKEN) {
    return (
      <Wrap>
        <p className="border-2 border-ink p-4">Moderación desactivada: define la variable de entorno <code>MODERATION_TOKEN</code>.</p>
      </Wrap>
    );
  }
  if (!isModeratorCookie(jar.get(MOD_COOKIE)?.value)) {
    return (
      <Wrap>
        <form method="post" action="/api/moderation/login" className="max-w-sm space-y-3">
          <div className="field">
            <label htmlFor="token">Token de moderación</label>
            <input id="token" name="token" type="password" required className="input" autoComplete="current-password" />
          </div>
          {error && <p role="alert" className="text-signal font-bold">Token incorrecto.</p>}
          <button className="btn btn-ink" type="submit">
            Entrar
          </button>
        </form>
      </Wrap>
    );
  }

  const repo = await getRepo();
  const [subs, reports, log, orgs, events] = await Promise.all([repo.listSubmissions(), repo.listReports(), repo.listLog(), repo.listOrganizations(), repo.listEvents({ from: daysAgo(30) })]);

  return (
    <Wrap>
      {error && (
        <p role="alert" className="border-l-4 border-signal bg-signal-wash p-3 mb-4 font-bold">
          {error}
        </p>
      )}
      <p className="text-sm text-ink-3 mb-6">
        Almacenamiento: {repo.kind}. Recuerda: publica solo convocatorias difundidas por la organización; nunca domicilios no
        publicados por ella; ante la duda, precisión «municipio».
      </p>

      <section id="reportes" className="mb-10">
        <h2 className="headline text-2xl border-b-2 border-ink pb-1">Reportes abiertos ({reports.filter((r) => r.status === "open").length})</h2>
        {reports
          .filter((r) => r.status === "open")
          .map((r) => (
            <article key={r.id} className="border-b border-rule py-3 grid md:grid-cols-[1fr_auto] gap-3">
              <div>
                <p className="kicker text-signal">
                  {r.reason} · {r.target_type} {r.target_id}
                </p>
                <p className="whitespace-pre-line">{r.message}</p>
                {r.contact && <p className="text-sm text-ink-3">Contacto: {r.contact}</p>}
                <p className="text-xs text-ink-3">{formatDateTime(r.created_at)}</p>
              </div>
              <form method="post" action={`/api/moderation/reports/${r.id}`} className="flex gap-2 items-start">
                <input name="note" placeholder="Nota" className="input min-h-[36px] text-sm" />
                <button name="action" value="resolve" className="btn btn-sm btn-ink">
                  Resuelto
                </button>
                <button name="action" value="dismiss" className="btn btn-sm">
                  Descartar
                </button>
              </form>
            </article>
          ))}
      </section>

      {COLUMNS.map((col) => {
        const list = subs.filter((s) => s.status === col.status);
        return (
          <section key={col.status} className="mb-10">
            <h2 className="headline text-2xl border-b-2 border-ink pb-1">
              {col.title} ({list.length})
            </h2>
            {list.map((s) => (
              <SubmissionCard key={s.id} s={s} orgs={orgs.map((o) => ({ slug: o.slug, name: o.name }))} />
            ))}
          </section>
        );
      })}

      <section id="eventos" className="mb-10">
        <h2 className="headline text-2xl border-b-2 border-ink pb-1">Convocatorias publicadas ({events.length})</h2>
        <p className="text-xs text-ink-3 mt-1">Las convocatorias curadas vía repositorio se editan en data/curated.</p>
        {events.map((e) => (
          <article key={e.id} className="border-b border-rule py-3 grid md:grid-cols-[1fr_auto] gap-3">
            <div>
              <p className="font-bold">
                <Link href={`/convocatorias/${e.slug}`}>{e.title}</Link>
              </p>
              <p className="text-sm text-ink-3">
                {e.date} {e.time ?? ""} · {e.status} · {e.verification_status} · precisión {e.location.precision}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-start">
              <form method="post" action={`/api/moderation/events/${e.id}`} className="flex gap-1">
                <input type="hidden" name="action" value="status" />
                <select name="status" defaultValue={e.status} className="input min-h-[36px] text-sm">
                  {["programada", "cancelada", "suspendida", "realizada"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <button className="btn btn-sm">Guardar</button>
              </form>
              <form method="post" action={`/api/moderation/events/${e.id}`} className="flex gap-1">
                <input type="hidden" name="action" value="withdraw" />
                <input name="note" required placeholder="Motivo de retirada" className="input min-h-[36px] text-sm" />
                <button className="btn btn-sm">Retirar</button>
              </form>
            </div>
          </article>
        ))}
      </section>

      <section>
        <h2 className="headline text-2xl border-b-2 border-ink pb-1">Registro de moderación</h2>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left border-b-2 border-ink">
              <th className="py-1">Fecha</th>
              <th>Objeto</th>
              <th>Acción</th>
              <th>Estado</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {log.slice(0, 100).map((l, i) => (
              <tr key={l.id ?? i} className="border-b border-rule align-top">
                <td className="py-1 pr-2 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                <td className="pr-2">
                  {l.target_type}:{l.target_id.slice(0, 8)}
                </td>
                <td className="pr-2">{l.action}</td>
                <td className="pr-2">
                  {l.from_status ?? "—"} → {l.to_status ?? "—"}
                </td>
                <td>{l.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Wrap>
  );
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-6 md:py-10">
      <p className="kicker text-signal">Interno</p>
      <h1 className="headline text-4xl mb-6">Moderación</h1>
      {children}
    </div>
  );
}

function SubmissionCard({ s, orgs }: { s: Submission; orgs: { slug: string; name: string }[] }) {
  const p = s.payload;
  const action = `/api/moderation/submissions/${s.id}`;
  return (
    <article id={`s-${s.id}`} className="border-b border-rule py-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <p className="kicker text-signal">
          {EVENT_TYPE_LABEL[p.type]} · {p.date} {p.time ?? ""}
        </p>
        <p className="font-bold text-lg">
          {p.organization} · {p.municipality} ({getTerritory(p.province_id)?.shortName})
        </p>
        <p className="whitespace-pre-line mt-1">{p.description}</p>
        {p.meeting_point && <p className="text-sm mt-1">Punto de encuentro indicado: {p.meeting_point}</p>}
        {p.comments && <p className="text-sm text-ink-3 mt-1">Comentarios: {p.comments}</p>}
        <p className="text-sm mt-1">
          Fuente:{" "}
          <a href={p.source_url} target="_blank" rel="noopener noreferrer nofollow">
            {p.source_url}
          </a>
        </p>
        {s.privacy_flags.length > 0 && (
          <p className="mt-2 text-sm border-l-4 border-signal pl-2">⚠ {s.privacy_flags.map((f) => FLAG_LABEL[f] ?? f).join(" · ")}</p>
        )}
        <p className="text-xs text-ink-3 mt-1">
          Recibido {formatDateTime(s.created_at)} · id {s.id.slice(0, 8)}
          {s.event_id && (
            <>
              {" "}
              · <Link href={`/agenda`}>publicado</Link>
            </>
          )}
        </p>
      </div>
      <div className="space-y-2">
        {s.status === "submitted" && (
          <form method="post" action={action}>
            <button name="action" value="start_review" className="btn btn-sm btn-ink w-full">
              Empezar revisión
            </button>
          </form>
        )}
        {s.status === "pending_review" && (
          <form method="post" action={action} className="flex gap-2">
            <input name="note" placeholder="Cómo se verificó" className="input min-h-[36px] text-sm" />
            <button name="action" value="verify" className="btn btn-sm btn-ink">
              Marcar verificado
            </button>
          </form>
        )}
        {s.status === "verified" && (
          <form method="post" action={action} className="grid gap-2 border-2 border-ink p-2">
            <input type="hidden" name="action" value="publish" />
            <input name="title" placeholder="Título público (opcional)" className="input min-h-[36px] text-sm" />
            <select name="verification_status" required className="input min-h-[36px] text-sm" defaultValue="">
              <option value="" disabled>
                Estado de verificación…
              </option>
              {VERIFICATION_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select name="source_type" className="input min-h-[36px] text-sm" defaultValue="red_social_publica">
              {SOURCE_TYPES.map((v) => (
                <option key={v} value={v}>
                  fuente: {v}
                </option>
              ))}
            </select>
            <input name="source_name" placeholder="Nombre de la fuente (p. ej. perfil de X)" className="input min-h-[36px] text-sm" />
            <select name="organization_slug" className="input min-h-[36px] text-sm" defaultValue="">
              <option value="">Organización del directorio (opcional)</option>
              {orgs.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input name="latitude" placeholder="lat" inputMode="decimal" className="input min-h-[36px] text-sm" />
              <input name="longitude" placeholder="lon" inputMode="decimal" className="input min-h-[36px] text-sm" />
              <select name="precision" className="input min-h-[36px] text-sm" defaultValue="via">
                <option value="exacta">exacta</option>
                <option value="via">vía</option>
                <option value="barrio">barrio</option>
              </select>
            </div>
            <p className="text-xs text-ink-3">Sin coordenadas se publica en el centroide del municipio (precisión «municipio»).</p>
            <input name="note" placeholder="Nota" className="input min-h-[36px] text-sm" />
            <button className="btn btn-sm btn-primary">Publicar</button>
          </form>
        )}
        {["submitted", "pending_review", "verified"].includes(s.status) && (
          <form method="post" action={action} className="flex gap-2">
            <input name="note" required placeholder="Motivo del rechazo" className="input min-h-[36px] text-sm" />
            <button name="action" value="reject" className="btn btn-sm">
              Rechazar
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
