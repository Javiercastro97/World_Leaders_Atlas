import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Geolocalización solo desde nuestro propio origen y siempre bajo petición explícita.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // La app vive en un subdirectorio del repositorio: fija la raíz para Turbopack.
  turbopack: { root: import.meta.dirname },
  agentRules: false,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/geo/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
