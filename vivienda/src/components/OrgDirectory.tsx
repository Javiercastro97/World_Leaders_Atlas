import Link from "next/link";
import type { Organization } from "@/lib/schema";
import { ORG_TYPES, ORG_TYPE_LABEL, type OrgType } from "@/lib/vocab";
import { PROVINCES, getTerritory } from "@/lib/territories";
import { OrgMap } from "./map/OrgMap";
import { EmptyState } from "./EventCard";
import { DemoTag } from "./DemoBanner";

export function OrgDirectory({ orgs, base, type, q, fixedTerritory }: { orgs: Organization[]; base: string; type?: OrgType; q?: string; fixedTerritory?: string }) {
  const mapOrgs = orgs
    .filter((o) => o.latitude != null && o.longitude != null)
    .map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      type: o.type,
      latitude: o.latitude!,
      longitude: o.longitude!,
      territory_id: o.territory_id,
      municipality_name: o.municipality_name,
      verified: o.verified,
      demo: o.demo,
    }));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-4 self-start">
        <OrgMap orgs={mapOrgs} />
        <p className="text-xs text-ink-3 mt-1">■ Cada cuadrado es la sede o ámbito declarado por la organización. {mapOrgs.length < orgs.length && `${orgs.length - mapOrgs.length} sin ubicación en el mapa (ver listado).`}</p>
      </div>
      <div>
        <form method="get" action={base} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end border-t-2 border-ink pt-3">
          <div className="field">
            <label htmlFor="o-q">Buscar</label>
            <input id="o-q" name="q" className="input" defaultValue={q ?? ""} placeholder="Nombre o municipio" />
          </div>
          <div className="field">
            <label htmlFor="o-t">Tipo</label>
            <select id="o-t" name="tipo" className="input" defaultValue={type ?? ""}>
              <option value="">Todos</option>
              {ORG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ORG_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-ink" type="submit">
            Filtrar
          </button>
          {!fixedTerritory && (
            <p className="md:col-span-3 text-sm">
              Por provincia:{" "}
              {PROVINCES.filter((p) => orgs.some((o) => o.territory_id === p.id))
                .map((p) => (
                  <Link key={p.id} href={`/colectivos/${p.slug}`} className="mr-2">
                    {p.shortName}
                  </Link>
                ))}
            </p>
          )}
        </form>

        {orgs.length === 0 ? (
          <EmptyState title="Todavía no hay colectivos en el directorio con estos criterios.">
            <p>
              El directorio se construye con fichas revisadas. <a href="#proponer">Propón una organización</a>.
            </p>
          </EmptyState>
        ) : (
          <ul className="mt-2">
            {orgs.map((o) => (
              <li key={o.id} className="border-t border-rule py-3">
                <p className="kicker text-ink-3">
                  {ORG_TYPE_LABEL[o.type]} {o.demo && <DemoTag />}
                </p>
                <h2 className="headline text-xl">
                  <Link href={`/colectivos/${o.slug}`} className="no-underline hover:underline">
                    {o.name}
                  </Link>
                </h2>
                <p className="text-sm text-ink-2">
                  {orgPlace(o.municipality_name, o.territory_id)} · ámbito {o.scope}
                  {o.verified ? " · ■ ficha verificada" : " · □ sin verificar"}
                </p>
              </li>
            ))}
          </ul>
        )}

        <section id="proponer" className="mt-10 border-t-2 border-ink pt-3">
          <h2 className="kicker">Añadir o corregir un colectivo</h2>
          <p className="text-sm mt-2">
            Las fichas se publican solo con información pública de la propia organización (web, redes, contacto de sede). Dos vías:
          </p>
          <ul className="list-[square] pl-5 text-sm mt-2 space-y-1">
            <li>
              Abre un <em>pull request</em> con un fichero en <code>data/curated/organizations/</code> (ver CONTRIBUTING.md).
            </li>
            <li>
              Usa el formulario de <Link href="/reportar?tipo=organization">reportar información</Link> indicando la web oficial.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

/** "Elche · Alicante", pero "Madrid" (no "Madrid · Madrid"). */
export function orgPlace(municipality: string | null, territoryId: string): string {
  const prov = getTerritory(territoryId)?.shortName ?? "";
  if (!municipality) return prov;
  const m = municipality.split("/").map((x) => x.trim());
  return m.some((x) => x.toLowerCase() === prov.toLowerCase()) ? m.join(" / ") : `${m.join(" / ")} · ${prov}`;
}
