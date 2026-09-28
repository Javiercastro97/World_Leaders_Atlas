"use client";
import { useState } from "react";

interface Props {
  e: { slug: string; title: string; date: string; time: string | null; source: { url: string } | null; effective_status: string };
}

/** CTA principal (original), compartir y calendario. Botones grandes pensados para el móvil en la calle. */
export function EventActions({ e }: Props) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/convocatorias/${e.slug}` : `/convocatorias/${e.slug}`;

  async function share() {
    const text = `${e.title} · ${e.date}${e.time ? ` ${e.time}` : ""}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: e.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* el usuario canceló */
    }
  }

  return (
    <div className="grid gap-2 mt-4" data-testid="event-actions">
      {e.source && (
        <a href={e.source.url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary w-full">
          Ver convocatoria original ↗
        </a>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn w-full" onClick={share}>
          {copied ? "Enlace copiado" : "Compartir"}
        </button>
        {e.effective_status === "programada" || e.effective_status === "suspendida" ? (
          <a href={`/api/events/${e.slug}/ics`} className="btn w-full" download>
            Añadir al calendario
          </a>
        ) : (
          <span className="btn w-full opacity-50" aria-disabled="true">
            Finalizada
          </span>
        )}
      </div>
      <p className="text-xs text-ink-3" aria-live="polite">
        Comprueba siempre la convocatoria original antes de acudir: la organización puede cambiar hora o lugar.{" "}
        <a href={`/reportar?tipo=event&id=${encodeURIComponent(e.slug)}`}>Reportar un error</a>
      </p>
    </div>
  );
}
