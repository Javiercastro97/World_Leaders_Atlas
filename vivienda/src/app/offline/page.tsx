import Link from "next/link";

export const metadata = { title: "Sin conexión", robots: { index: false } };

export default function Offline() {
  return (
    <div className="mx-auto max-w-[720px] px-4 md:px-6 py-16">
      <p className="kicker text-signal">Sin conexión</p>
      <h1 className="headline text-4xl mt-1">No hay cobertura ahora mismo</h1>
      <p className="mt-3 text-ink-2">
        Si ya abriste la agenda o una convocatoria antes, puedes consultarlas: se guardaron en este dispositivo. Comprueba la
        convocatoria original cuando recuperes la conexión.
      </p>
      <div className="flex gap-3 mt-6">
        <Link href="/agenda" className="btn btn-ink">Agenda guardada</Link>
        <Link href="/colectivos" className="btn">Directorio</Link>
      </div>
    </div>
  );
}
