/** Datos estructurados schema.org. Se escapa "<" para evitar cierres de <script> inyectados. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
