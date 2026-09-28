import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mapa por la Vivienda",
    short_name: "Vivienda",
    description: "Datos, convocatorias y organización por el derecho a la vivienda.",
    lang: "es",
    start_url: "/agenda?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#141414",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agenda de hoy", url: "/agenda?tab=hoy" },
      { name: "Avisa de una convocatoria", url: "/avisa" },
    ],
  };
}
