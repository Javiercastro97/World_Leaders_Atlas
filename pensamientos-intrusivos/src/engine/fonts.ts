// Tipografías empaquetadas (sin depender de Google Fonts en tiempo de render).
import "@fontsource/archivo-black/400.css";
import "@fontsource/permanent-marker/400.css";
import { useState } from "react";
import { continueRender, delayRender } from "remotion";

let loaded: Promise<unknown> | null = null;

export function useFonts() {
  const [handle] = useState(() => delayRender("Cargando tipografías"));
  useState(() => {
    loaded ??= Promise.all([
      document.fonts.load("78px 'Archivo Black'", "ÁÉÍÓÚÑ¿?"),
      document.fonts.load("60px 'Permanent Marker'", "PÚLSAME"),
    ]);
    loaded.then(() => continueRender(handle)).catch(() => continueRender(handle));
    return null;
  });
}
