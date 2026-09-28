import type { MetadataRoute } from "next";
import { CCAA, PROVINCES } from "@/lib/territories";
import { absoluteUrl } from "@/lib/site";
import { getRepo } from "@/server/repo";
import { addDays, localDate } from "@/lib/dates";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repo = await getRepo();
  const now = new Date();
  const [events, orgs] = await Promise.all([repo.listEvents({ from: addDays(localDate(now), -30) }), repo.listOrganizations()]);
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly") => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency,
    priority,
  });
  return [
    page("/", 1, "daily"),
    page("/agenda", 0.9, "daily"),
    page("/datos", 0.8),
    page("/colectivos", 0.7),
    page("/memoria", 0.6),
    page("/metodologia", 0.4, "monthly"),
    page("/fuentes", 0.4, "monthly"),
    page("/privacidad", 0.2, "monthly"),
    ...PROVINCES.flatMap((p) => [page(`/desahucios/${p.slug}`, 0.7), page(`/agenda/${p.slug}`, 0.6, "daily"), page(`/colectivos/${p.slug}`, 0.5)]),
    ...CCAA.map((c) => page(`/desahucios/${c.slug}`, 0.6)),
    ...events.filter((e) => !e.demo).map((e) => ({ url: absoluteUrl(`/convocatorias/${e.slug}`), lastModified: new Date(e.updated_at), priority: 0.5 })),
    ...orgs.filter((o) => !o.demo).map((o) => ({ url: absoluteUrl(`/colectivos/${o.slug}`), lastModified: new Date(o.updated_at), priority: 0.5 })),
  ];
}
