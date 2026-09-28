import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Aviso recibido", robots: { index: false } };

export default function Gracias() {
  return (
    <div className="mx-auto max-w-[720px] px-4 md:px-6 py-12">
      <p className="kicker text-signal">Recibido</p>
      <h1 className="headline text-4xl mt-1">Gracias. Tu aviso está en la cola de revisión.</h1>
      <p className="prose-editorial mt-4">
        No es público todavía. Moderación comprobará la publicación original y, si procede, lo publicará indicando su fuente y
        su estado de verificación. Si la convocatoria cambia o se cancela, avísanos de nuevo o usa <Link href="/reportar">reportar información</Link>.
      </p>
      <div className="flex gap-3 mt-6">
        <Link href="/agenda" className="btn btn-ink">Ver la agenda</Link>
        <Link href="/avisa" className="btn">Enviar otro aviso</Link>
      </div>
    </div>
  );
}
