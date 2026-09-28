import type { Metadata } from "next";
import Link from "next/link";
import { issueFormToken } from "@/lib/antispam";
import { SubmitForm } from "@/components/SubmitForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reportar información",
  description: "Solicita la corrección o retirada de información publicada: datos incorrectos, datos personales, convocatorias canceladas.",
  alternates: { canonical: "/reportar" },
};

const REASONS: [string, string][] = [
  ["datos_personales", "Aparecen datos personales o un domicilio que no debería verse"],
  ["retirada", "Solicito la retirada de esta información"],
  ["evento_cancelado", "La convocatoria se ha cancelado o cambiado"],
  ["dato_incorrecto", "Hay un dato incorrecto"],
  ["otro", "Otro motivo"],
];

type SP = { tipo?: string; id?: string; enviado?: string; error?: string };

export default async function ReportarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const target = ["event", "organization", "statistic", "other"].includes(sp.tipo ?? "") ? sp.tipo! : "other";
  if (sp.enviado) {
    return (
      <div className="mx-auto max-w-[720px] px-4 md:px-6 py-12">
        <h1 className="headline text-4xl">Reporte recibido</h1>
        <p className="prose-editorial mt-4">
          Lo revisaremos con prioridad. Las solicitudes sobre datos personales se atienden retirando primero la información y
          revisando después. <Link href="/">Volver al mapa</Link>.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[900px] px-4 md:px-6 py-6 md:py-10">
      <p className="kicker text-signal">Correcciones</p>
      <h1 className="headline text-4xl md:text-5xl mt-1">Reportar información</h1>
      <p className="text-ink-2 mt-2 max-w-[62ch]">
        Si algo es incorrecto, está desactualizado o expone a alguien, dínoslo. Las peticiones de retirada por datos personales
        se atienden primero. <Link href="/metodologia#correcciones">Política de correcciones</Link>.
      </p>
      {sp.error && (
        <p role="alert" className="mt-4 border-l-4 border-signal bg-signal-wash p-3 text-sm font-bold">
          {sp.error}
        </p>
      )}
      <div className="mt-6">
        <SubmitForm action="/api/reports" success="/reportar?enviado=1" submitLabel="Enviar reporte">
          <input type="hidden" name="form_token" value={issueFormToken()} />
          <input type="hidden" name="target_type" value={target} />
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="target_id">¿Sobre qué? (enlace o identificador)</label>
            <input id="target_id" name="target_id" className="input" defaultValue={sp.id ?? ""} maxLength={120} />
          </div>
          <fieldset>
            <legend className="label">Motivo *</legend>
            <div className="space-y-2 mt-1">
              {REASONS.map(([v, l], i) => (
                <label key={v} className="flex gap-2 items-start">
                  <input type="radio" name="reason" value={v} required defaultChecked={i === 0 && target === "event"} className="mt-1 w-5 h-5 accent-[#141414]" />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="message">Explícanos qué ocurre *</label>
            <textarea id="message" name="message" required minLength={5} maxLength={2000} rows={5} className="input" />
          </div>
          <div className="field">
            <label htmlFor="contact">Contacto (opcional)</label>
            <input id="contact" name="contact" maxLength={200} className="input" />
            <p className="hint">Solo si quieres respuesta. Se borra al cerrar el reporte.</p>
          </div>
        </SubmitForm>
      </div>
    </div>
  );
}
