import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[720px] px-4 md:px-6 py-16">
      <p className="kicker text-signal">404</p>
      <h1 className="headline text-4xl mt-1">No encontramos esta página</h1>
      <p className="mt-3 text-ink-2">Puede que la convocatoria se haya retirado o que el enlace esté mal escrito.</p>
      <div className="flex gap-3 mt-6">
        <Link href="/" className="btn btn-ink">Ir al mapa</Link>
        <Link href="/agenda" className="btn">Ver la agenda</Link>
      </div>
    </div>
  );
}
