import type { Metadata } from "next";
import Link from "next/link";
import { issueFormToken } from "@/lib/antispam";
import { EVENT_TYPES, EVENT_TYPE_LABEL } from "@/lib/vocab";
import { PROVINCES } from "@/lib/territories";
import { getRepo } from "@/server/repo";
import { SubmitForm } from "@/components/SubmitForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Avisa de una convocatoria",
  description: "Envía una convocatoria pública por la vivienda difundida por una organización. Se revisa antes de publicarse.",
  alternates: { canonical: "/avisa" },
};

export default async function AvisaPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const repo = await getRepo();
  const token = issueFormToken();
  return (
    <div className="mx-auto max-w-[1100px] px-4 md:px-6 py-6 md:py-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <p className="kicker text-signal">Participa</p>
        <h1 className="headline text-4xl md:text-5xl mt-1">Avisa de una convocatoria</h1>
        <p className="text-ink-2 mt-2 max-w-[62ch]">
          Solo convocatorias <strong>difundidas públicamente por una organización</strong> (web, perfil público, cartel). Nada se
          publica automáticamente: el equipo de moderación revisa cada aviso y lo contrasta con la fuente.
        </p>
        {!repo.writable && (
          <p role="status" className="mt-4 border-2 border-ink p-3 text-sm">
            Los envíos están desactivados en este despliegue (sin base de datos). Puedes proponer la convocatoria por el repositorio público.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 border-l-4 border-signal bg-signal-wash p-3 text-sm font-bold">
            {error}
          </p>
        )}

        <div className="mt-6">
          <SubmitForm action="/api/submissions" success="/avisa/gracias" submitLabel="Enviar para revisión">
            <input type="hidden" name="form_token" value={token} />
            {/* Campo trampa: invisible para personas, los bots suelen rellenarlo */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
              <label>
                No rellenar
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <fieldset className="grid gap-4 md:grid-cols-2">
              <legend className="kicker mb-2 border-b-2 border-ink w-full pb-1">La convocatoria</legend>
              <div className="field">
                <label htmlFor="type">Tipo *</label>
                <select id="type" name="type" required className="input" defaultValue="">
                  <option value="" disabled>
                    Elige…
                  </option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EVENT_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label htmlFor="date">Fecha *</label>
                  <input id="date" name="date" type="date" required className="input" />
                </div>
                <div className="field">
                  <label htmlFor="time">Hora</label>
                  <input id="time" name="time" type="time" className="input" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="municipality">Municipio *</label>
                <input id="municipality" name="municipality" required minLength={2} maxLength={120} className="input" autoComplete="address-level2" />
              </div>
              <div className="field">
                <label htmlFor="province_id">Provincia *</label>
                <select id="province_id" name="province_id" required className="input" defaultValue="">
                  <option value="" disabled>
                    Elige…
                  </option>
                  {[...PROVINCES].sort((a, b) => a.shortName.localeCompare(b.shortName, "es")).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.shortName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field md:col-span-2">
                <label htmlFor="organization">Organización convocante *</label>
                <input id="organization" name="organization" required minLength={2} maxLength={200} className="input" />
              </div>
              <div className="field md:col-span-2">
                <label htmlFor="source_url">URL de la publicación original *</label>
                <input id="source_url" name="source_url" type="url" required placeholder="https://…" className="input" inputMode="url" />
                <p className="hint">Enlace público de la organización (web, publicación en redes abierta). Sin enlace no podemos verificar.</p>
              </div>
              <div className="field md:col-span-2">
                <label htmlFor="description">Descripción *</label>
                <textarea id="description" name="description" required minLength={10} maxLength={2000} rows={4} className="input" />
                <p className="hint">Qué se convoca. No incluyas nombres, teléfonos ni circunstancias de personas afectadas.</p>
              </div>
              <div className="field md:col-span-2">
                <label htmlFor="meeting_point">Punto público de concentración</label>
                <input id="meeting_point" name="meeting_point" maxLength={240} className="input" />
                <p className="hint">
                  Solo si la organización lo ha publicado como punto de encuentro. Nunca un domicilio que no haya difundido ella.
                </p>
              </div>
              <div className="field md:col-span-2">
                <label htmlFor="comments">Comentarios para moderación</label>
                <textarea id="comments" name="comments" maxLength={1000} rows={2} className="input" />
              </div>
            </fieldset>

            <label className="flex gap-3 items-start text-sm border-2 border-ink p-3">
              <input type="checkbox" name="confirm_public" required className="mt-1 w-5 h-5 accent-[#141414]" />
              <span>
                Confirmo que la convocatoria ha sido <strong>difundida públicamente por la organización convocante</strong> y que no
                incluyo datos personales de personas afectadas. *
              </span>
            </label>
          </SubmitForm>
        </div>
      </div>

      <aside className="space-y-6 text-sm">
        <section className="border-t-2 border-ink pt-3">
          <h2 className="kicker">Qué pasa después</h2>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>
              <strong>Recibido</strong>: queda en cola, no es visible.
            </li>
            <li>
              <strong>En revisión</strong>: comprobamos la publicación original.
            </li>
            <li>
              <strong>Verificado</strong>: contrastado con la organización o la fuente.
            </li>
            <li>
              <strong>Publicado</strong>: aparece en el mapa y la agenda con su fuente.
            </li>
          </ol>
        </section>
        <section className="border-t-2 border-ink pt-3">
          <h2 className="kicker">Privacidad</h2>
          <p className="mt-2">
            No guardamos tu IP: solo un código que cambia cada día para frenar abusos. Retiramos automáticamente teléfonos, DNI y
            correos del texto. <Link href="/privacidad">Política de privacidad</Link>.
          </p>
        </section>
      </aside>
    </div>
  );
}
