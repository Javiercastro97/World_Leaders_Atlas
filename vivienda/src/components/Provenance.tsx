/**
 * Componentes de trazabilidad. Cada dato visible indica de dónde procede.
 * Los estados se distinguen por TEXTO y FORMA, nunca solo por color.
 */
import { timeAgo, formatDateTime } from "@/lib/dates";
import type { HousingEvent, SourceType } from "@/lib/schema";

const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  web_organizacion: "Web de la organización",
  red_social_publica: "Perfil público en redes",
  boletin_oficial: "Boletín oficial",
  prensa: "Prensa",
  dataset_oficial: "Dataset oficial",
  envio_ciudadano: "Aviso ciudadano",
  otro: "Otra fuente",
};

export function SourceBox({
  source,
  now,
  compact = false,
}: {
  source: { name: string; url: string; type: SourceType; published_at: string | null; retrieved_at: string } | null;
  now: Date;
  compact?: boolean;
}) {
  if (!source) {
    return (
      <div className="border-l-4 border-signal pl-3 py-1">
        <p className="kicker">Fuente</p>
        <p className="text-sm">Sin fuente registrada. Esta información no debería mostrarse: repórtalo.</p>
      </div>
    );
  }
  const when = source.published_at ?? source.retrieved_at;
  return (
    <div className="border-l-4 border-ink pl-3 py-1" data-testid="source-box">
      <p className="kicker">Fuente</p>
      <p className={`font-bold ${compact ? "text-sm" : ""}`}>{source.name}</p>
      <p className="text-sm text-ink-3">
        {SOURCE_TYPE_LABEL[source.type]} · {source.published_at ? "Publicado" : "Consultado"}{" "}
        <time dateTime={when} title={formatDateTime(when)}>
          {timeAgo(when, now)}
        </time>
      </p>
      <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm font-bold">
        Abrir publicación original ↗
      </a>
    </div>
  );
}

const VERIFICATION: Record<HousingEvent["verification_status"], { label: string; mark: string; cls: string; help: string }> = {
  verificada: {
    label: "Verificada",
    mark: "■",
    cls: "bg-ink text-paper",
    help: "Contrastada por el equipo con la organización convocante o con dos fuentes independientes.",
  },
  fuente_oficial: {
    label: "Fuente oficial del colectivo",
    mark: "▣",
    cls: "bg-card text-ink border-2 border-ink",
    help: "Publicada en un canal público y oficial de la propia organización convocante.",
  },
  pendiente: {
    label: "Pendiente de verificación",
    mark: "□",
    cls: "bg-paper text-ink border-2 border-dashed border-ink",
    help: "Aviso recibido y revisado para publicación, pero aún no contrastado con la organización.",
  },
};

export function VerificationBadge({ status, withHelp = false }: { status: HousingEvent["verification_status"]; withHelp?: boolean }) {
  const v = VERIFICATION[status];
  return (
    <span className="inline-flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.07em] ${v.cls}`}>
        <span aria-hidden>{v.mark}</span>
        {v.label}
      </span>
      {withHelp && <span className="text-xs text-ink-3 max-w-[40ch]">{v.help}</span>}
    </span>
  );
}

const STATUS: Record<HousingEvent["status"], { label: string; cls: string } | null> = {
  programada: null,
  cancelada: { label: "Cancelada", cls: "bg-signal text-white line-through decoration-2" },
  suspendida: { label: "Suspendida", cls: "bg-signal-wash text-signal-dark border-2 border-signal" },
  realizada: { label: "Realizada", cls: "bg-paper-3 text-ink-2" },
};

export function StatusBadge({ status }: { status: HousingEvent["status"] }) {
  const s = STATUS[status];
  if (!s) return null;
  return <span className={`inline-block px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.07em] ${s.cls}`}>{s.label}</span>;
}

/** Bloque de metadatos obligatorio junto a cada visualización estadística. */
export function DataMeta({
  source,
  period,
  updated,
  note,
  limitations = [],
  derived = false,
}: {
  source: { name: string; url: string };
  period: string;
  updated: string | null;
  note: string;
  limitations?: string[];
  derived?: boolean;
}) {
  return (
    <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm border-t border-rule pt-3 mt-3" data-testid="data-meta">
      <div>
        <dt className="kicker text-ink-3">Fuente</dt>
        <dd>
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.name}
          </a>
        </dd>
      </div>
      <div>
        <dt className="kicker text-ink-3">Periodo</dt>
        <dd>{period}</dd>
      </div>
      <div>
        <dt className="kicker text-ink-3">Última actualización</dt>
        <dd>{updated ? formatDateTime(updated) : "—"}</dd>
      </div>
      <div className="col-span-2 md:col-span-1">
        <dt className="kicker text-ink-3">Nota metodológica</dt>
        <dd>
          {note}
          {derived && " Algunos totales son sumas calculadas por nosotros a partir de los datos publicados."}
        </dd>
      </div>
      {limitations.length > 0 && (
        <div className="col-span-2 md:col-span-4">
          <dt className="kicker text-ink-3">Limitaciones</dt>
          <dd>
            <ul className="list-[square] pl-5">
              {limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}
