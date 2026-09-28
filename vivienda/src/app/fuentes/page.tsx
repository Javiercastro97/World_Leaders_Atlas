import type { Metadata } from "next";
import Link from "next/link";
import { getRepo } from "@/server/repo";
import { formatDateTime } from "@/lib/dates";
import { CGPJ_TABLES } from "@/data-sources/cgpj";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Fuentes y datasets",
  description: "Listado público de datasets, organismos y organizaciones cuyos datos usa el Mapa por la Vivienda, con fecha de consulta y estado.",
  alternates: { canonical: "/fuentes" },
};

export default async function Fuentes() {
  const repo = await getRepo();
  const [datasets, sources, orgs] = await Promise.all([repo.listDatasets(), repo.listSources(), repo.listOrganizations()]);
  const loaded = new Set(datasets.map((d) => d.id));
  const official = sources.filter((s) => s.type === "dataset_oficial");

  return (
    <div className="mx-auto max-w-[1100px] px-4 md:px-6 py-6 md:py-10">
      <p className="kicker text-signal">Transparencia</p>
      <h1 className="headline text-4xl md:text-5xl mt-1">Fuentes y datasets</h1>
      <p className="text-ink-2 mt-2 max-w-[70ch]">
        Todo lo que se muestra procede de alguna de estas fuentes. Los datos normalizados se pueden descargar en{" "}
        <a href="/api/statistics">/api/statistics</a> y el código de ingestión está en el repositorio. <Link href="/metodologia">Metodología</Link>.
      </p>

      <section className="mt-10 border-t-2 border-ink pt-3">
        <h2 className="headline text-2xl">Datasets cargados</h2>
        {datasets.length === 0 ? (
          <p className="py-3">Ningún dataset cargado todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="text-left border-b-2 border-ink">
                  <th className="py-1 pr-3">Dataset</th>
                  <th className="pr-3">Periodo</th>
                  <th className="pr-3">Ámbito</th>
                  <th className="pr-3">Consultado</th>
                  <th>Actualizado en origen</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.id} className="border-b border-rule align-top">
                    <td className="py-2 pr-3">
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-bold">
                        {d.title}
                      </a>
                      <span className="block text-xs text-ink-3">{d.id}</span>
                      {d.limitations.length > 0 && <span className="block text-xs text-ink-2 mt-1">{d.limitations.join(" ")}</span>}
                    </td>
                    <td className="pr-3 whitespace-nowrap">
                      {d.first_period ?? "—"}–{d.last_period ?? "—"}
                    </td>
                    <td className="pr-3">{d.territorial_levels.join(", ")}</td>
                    <td className="pr-3 whitespace-nowrap">{d.retrieved_at ? formatDateTime(d.retrieved_at) : "—"}</td>
                    <td className="whitespace-nowrap">{d.source_updated_at ? formatDateTime(d.source_updated_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 border-t-2 border-ink pt-3">
        <h2 className="headline text-2xl">Proveedores oficiales</h2>
        <ul className="mt-3 space-y-4">
          <li>
            <p className="font-bold">Consejo General del Poder Judicial · Estadística Judicial (PxWeb)</p>
            <p className="text-sm">Ingestión automática vía API PxWeb (JSON-stat) con alternativa de fichero PC-Axis. Tablas configuradas:</p>
            <ul className="list-[square] pl-5 text-sm">
              {CGPJ_TABLES.map((t) => (
                <li key={t.datasetId}>
                  {t.title} <code className="text-xs">{t.table}</code> — {loaded.has(t.datasetId) ? "cargada" : "pendiente de primera ingestión"}
                </li>
              ))}
            </ul>
          </li>
          <li>
            <p className="font-bold">CGPJ · informe «Efecto de la crisis en los órganos judiciales»</p>
            <p className="text-sm">
              Tablas por TSJ y provincia publicadas como informe; se incorporan por transcripción revisada (<code>data/manual</code>). Serie
              principal del mapa: {loaded.has("cgpj-efecto-crisis") ? "cargada" : "pendiente"}.
            </p>
          </li>
          <li>
            <p className="font-bold">INE · Cifras oficiales de población (Padrón municipal)</p>
            <p className="text-sm">API JSON Tempus3. Denominador para tasas. {loaded.has("ine-poblacion") ? "Cargada." : "Pendiente de primera ingestión."}</p>
          </li>
          <li>
            <p className="font-bold">Cartografía</p>
            <p className="text-sm">
              Instituto Geográfico Nacional (CC BY 4.0) vía es-atlas; Natural Earth para el contexto; teselas OpenStreetMap
              (OpenMapTiles/OpenFreeMap) para calles al acercar.
            </p>
          </li>
          {official
            .filter((s) => !s.id.startsWith("cgpj") && !s.id.startsWith("ine"))
            .map((s) => (
              <li key={s.id}>
                <a href={s.url} className="font-bold" target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>
                <span className="block text-sm text-ink-3">Consultado {formatDateTime(s.retrieved_at)}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="mt-10 border-t-2 border-ink pt-3">
        <h2 className="headline text-2xl">Organizaciones ({orgs.length})</h2>
        <p className="text-sm text-ink-3">Organizaciones del directorio cuyas publicaciones públicas usamos como fuente de convocatorias.</p>
        <ul className="grid md:grid-cols-2 gap-x-8 mt-2">
          {orgs.map((o) => {
            const s = sources.find((x) => x.id === o.source_id);
            return (
              <li key={o.id} className="border-t border-rule py-2 text-sm">
                <Link href={`/colectivos/${o.slug}`} className="font-bold">
                  {o.name}
                </Link>
                {s && (
                  <span className="block text-ink-3">
                    Ficha basada en:{" "}
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.name}
                    </a>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
