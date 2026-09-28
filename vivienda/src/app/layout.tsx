import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SITE } from "@/lib/site";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DemoBanner } from "@/components/DemoBanner";
import { ServiceWorker } from "@/components/ServiceWorker";
import { demoEnabled } from "@/server/demo";

const archivo = localFont({
  src: "../fonts/archivo-var.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const serif = localFont({
  src: "../fonts/source-serif-4-var.woff2",
  variable: "--font-serif4",
  weight: "200 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} · Desahucios, convocatorias y colectivos`, template: `%s · ${SITE.name}` },
  description:
    "Herramienta cívica de código abierto: estadística oficial de lanzamientos (CGPJ), agenda de convocatorias públicas por la vivienda y directorio de colectivos, con la procedencia de cada dato.",
  applicationName: SITE.name,
  openGraph: { type: "website", locale: SITE.locale, siteName: SITE.name },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#141414",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = demoEnabled();
  return (
    <html lang="es" className={`${archivo.variable} ${serif.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        {demo && <DemoBanner />}
        <Header />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer />
        <ServiceWorker />
      </body>
    </html>
  );
}
