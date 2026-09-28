import Link from "next/link";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t-2 border-ink mt-16 bg-paper">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-8 grid gap-8 md:grid-cols-4 text-sm">
        <div className="md:col-span-2">
          <p className="headline text-xl mb-2">Datos + territorio + memoria + movilización.</p>
          <p className="text-ink-2 max-w-prose">
            Herramienta cívica de código abierto. Distinguimos siempre entre <strong>estadística oficial agregada</strong>,{" "}
            <strong>información publicada por organizaciones</strong> y <strong>avisos pendientes de verificar</strong>.
            No publicamos datos de personas afectadas.
          </p>
        </div>
        <nav aria-label="Transparencia">
          <p className="kicker mb-2">Transparencia</p>
          <ul className="space-y-1">
            <li><Link href="/metodologia">Metodología</Link></li>
            <li><Link href="/fuentes">Fuentes y datasets</Link></li>
            <li><Link href="/privacidad">Privacidad</Link></li>
            <li><Link href="/reportar">Reportar información</Link></li>
          </ul>
        </nav>
        <nav aria-label="Participa">
          <p className="kicker mb-2">Participa</p>
          <ul className="space-y-1">
            <li><Link href="/avisa">Avisa de una convocatoria</Link></li>
            <li><Link href="/colectivos#proponer">Añadir un colectivo</Link></li>
            <li><a href={SITE.repo} rel="noopener">Código fuente (AGPL-3.0)</a></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-rule">
        <p className="mx-auto max-w-[1600px] px-4 md:px-6 py-3 text-xs text-ink-3">
          Cartografía: IGN (CC BY 4.0) vía es-atlas · Natural Earth · Estadística judicial: CGPJ · Población: INE.
        </p>
      </div>
    </footer>
  );
}
