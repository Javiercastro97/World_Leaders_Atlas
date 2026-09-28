import { ImageResponse } from "next/og";

export const alt = "Mapa por la Vivienda — Datos, convocatorias y organización por el derecho a la vivienda";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4f1ea", padding: 64, borderTop: "24px solid #141414" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 800, letterSpacing: -1, textTransform: "uppercase" }}>
          <div style={{ width: 32, height: 32, background: "#c8241c" }} />
          Mapa por la Vivienda
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 120, fontWeight: 900, lineHeight: 0.95, letterSpacing: -4, textTransform: "uppercase" }}>
          <span>La vivienda</span>
          <span style={{ display: "flex" }}>
            tiene&nbsp;<span style={{ color: "#c8241c" }}>mapa.</span>
          </span>
        </div>
        <div style={{ fontSize: 30, color: "#3b3935" }}>Datos, convocatorias y organización por el derecho a la vivienda.</div>
      </div>
    ),
    size,
  );
}
