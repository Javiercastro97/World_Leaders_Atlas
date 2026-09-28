import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgendaView, type AgendaParams } from "@/components/AgendaView";
import { PROVINCES, getProvinceBySlug, getTerritory } from "@/lib/territories";

type Props = { params: Promise<{ provincia: string }>; searchParams: Promise<AgendaParams> };

export function generateStaticParams() {
  return PROVINCES.map((p) => ({ provincia: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProvinceBySlug((await params).provincia);
  if (!p) return {};
  return {
    title: `Agenda por la vivienda en ${p.shortName}`,
    description: `Convocatorias públicas por el derecho a la vivienda en la provincia de ${p.name}: paradas de desahucio, concentraciones, asambleas y asesorías.`,
    alternates: { canonical: `/agenda/${p.slug}` },
  };
}

export default async function ProvinceAgenda({ params, searchParams }: Props) {
  const p = getProvinceBySlug((await params).provincia);
  if (!p) notFound();
  const ccaa = getTerritory(p.parent);
  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-6 md:py-10">
      <header className="mb-6">
        <nav aria-label="Migas" className="text-sm mb-2">
          <Link href="/agenda">Agenda</Link> / {ccaa?.shortName}
        </nav>
        <h1 className="headline text-4xl md:text-5xl">Agenda · {p.shortName}</h1>
        <p className="text-ink-2 mt-2">
          <Link href={`/desahucios/${p.slug}`}>Datos de lanzamientos en {p.shortName}</Link> ·{" "}
          <Link href={`/colectivos/${p.slug}`}>Colectivos en {p.shortName}</Link>
        </p>
      </header>
      <AgendaView params={await searchParams} fixedProvince={p.id} />
    </div>
  );
}
