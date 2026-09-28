import Link from "next/link";
import { NAV } from "@/lib/site";
import { NavLinks } from "./NavLinks";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 no-underline shrink-0" aria-label="Mapa por la Vivienda — inicio">
      <span aria-hidden className="block w-4 h-4 bg-signal" />
      <span className="leading-none font-black uppercase tracking-tight" style={{ fontStretch: "75%", fontSize: 19 }}>
        Mapa por la <span className="text-signal">Vivienda</span>
      </span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="border-b-2 border-ink bg-paper">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6 flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
        <Logo />
        <nav aria-label="Principal" className="order-3 md:order-2 w-full md:w-auto -mx-1 overflow-x-auto">
          <NavLinks items={NAV.map((n) => ({ href: n.href, label: n.label }))} />
        </nav>
        <div className="order-2 md:order-3 ml-auto">
          <Link href="/avisa" className="btn btn-primary btn-cta">
            Avisa de una convocatoria
          </Link>
        </div>
      </div>
    </header>
  );
}
