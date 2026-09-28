import type { Metadata } from "next";
import { getRepo } from "@/server/repo";
import { OrgDirectory } from "@/components/OrgDirectory";
import { ORG_TYPES, type OrgType } from "@/lib/vocab";

export const metadata: Metadata = {
  title: "Directorio de colectivos por la vivienda",
  description: "Sindicatos de vivienda, PAH, asociaciones vecinales, plataformas y asesorías en España, con su web y contacto públicos y la fuente de cada ficha.",
  alternates: { canonical: "/colectivos" },
};

export default async function ColectivosPage({ searchParams }: { searchParams: Promise<{ tipo?: string; q?: string }> }) {
  const sp = await searchParams;
  const type = ORG_TYPES.includes(sp.tipo as OrgType) ? (sp.tipo as OrgType) : undefined;
  const orgs = await (await getRepo()).listOrganizations({ type, q: sp.q || undefined });
  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-6 md:py-10">
      <header className="mb-6">
        <p className="kicker text-signal">Directorio</p>
        <h1 className="headline text-4xl md:text-5xl mt-1">Colectivos por la vivienda</h1>
        <p className="text-ink-2 mt-2 max-w-[70ch]">Organizaciones que trabajan por el derecho a la vivienda. Solo datos públicos de cada organización y la fuente de cada ficha.</p>
      </header>
      <OrgDirectory orgs={orgs} base="/colectivos" type={type} q={sp.q} />
    </div>
  );
}
