import type { Metadata } from "next";
import { AgendaView, type AgendaParams } from "@/components/AgendaView";

export const metadata: Metadata = {
  title: "Agenda de movilizaciones por la vivienda",
  description: "Convocatorias públicas por el derecho a la vivienda en España: paradas de desahucio, concentraciones, asambleas y asesorías. Con la fuente original de cada una.",
  alternates: { canonical: "/agenda" },
};

export default async function AgendaPage({ searchParams }: { searchParams: Promise<AgendaParams> }) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-6 md:py-10">
      <header className="mb-6">
        <p className="kicker text-signal">Agenda nacional</p>
        <h1 className="headline text-4xl md:text-5xl mt-1">Movilizaciones por la vivienda</h1>
        <p className="text-ink-2 mt-2 max-w-[70ch]">
          Convocatorias públicas difundidas por organizaciones. Cada tarjeta indica quién convoca, su estado de verificación y
          enlaza a la publicación original.
        </p>
      </header>
      <AgendaView params={params} />
    </div>
  );
}
