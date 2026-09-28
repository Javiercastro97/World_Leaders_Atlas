export const SITE = {
  name: "Mapa por la Vivienda",
  shortName: "Vivienda",
  tagline: "Datos, convocatorias y organización por el derecho a la vivienda.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  repo: "https://github.com/javiercastro97/world_leaders_atlas/tree/main/vivienda",
  locale: "es_ES",
};

export const NAV = [
  { href: "/", label: "Mapa" },
  { href: "/agenda", label: "Agenda" },
  { href: "/datos", label: "Datos" },
  { href: "/colectivos", label: "Colectivos" },
  { href: "/memoria", label: "Memoria" },
] as const;

export function absoluteUrl(path: string): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export const fmtInt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
export const fmt1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const s = fmt1.format(Math.abs(v));
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s} %`;
}
