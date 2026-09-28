# Mapa por la Vivienda — contexto para Claude Code

App Next.js 16 independiente dentro del repo del Atlas (no afecta a su despliegue). Herramienta cívica sobre vivienda en España: estadística CGPJ, agenda de convocatorias, directorio de colectivos y memoria. Lee primero README.md, ARCHITECTURE.md e IMPLEMENTATION_PLAN.md.

## Reglas que no se negocian
- Estadística agregada = choropleth, gráficos o indicadores. **Nunca puntos.** Un punto solo representa una convocatoria documentada.
- No hay cifras escritas a mano. Sin datos, estado vacío. Los fixtures van marcados como [DEMO] (`src/server/demo.ts`, nunca en producción) o [PRUEBA E2E] (`tests/`).
- Toda ubicación pública pasa por `publicLocation()` (vía `toPublic()`). Nada de datos de personas afectadas.
- No se suman datasets de órganos distintos. La serie principal se configura en `data/config/series.json`.
- Rojo = convocatorias y acción; grises = estadística. Sin degradados, glassmorphism ni sombras grandes.

## Estado (sept. 2026)
- Fases 1–6 implementadas. 76 tests unitarios (uno con Postgres, activado por `TEST_DATABASE_URL`) y 26 e2e (escritorio y móvil) en verde. Lighthouse: rendimiento ≥ 90, accesibilidad y SEO 100.
- **Pendiente:** primera ingestión real del CGPJ e INE. Desde el contenedor de desarrollo, la red bloqueaba poderjudicial.es e ine.es (403). Ejecutar `npm run ingest:cgpj:discover` en un entorno con red (o con el workflow `vivienda-ingest.yml`), revisar el mapeo de dimensiones y transcribir el informe «Efecto de la crisis» a `data/manual/`.
- **Pendiente:** hosting con Postgres y secretos (ver README).

## Trampas conocidas
- Next 16 genera AGENTS.md/CLAUDE.md en `next dev` salvo `agentRules: false` (ya configurado).
- MapLibre 6: el worker se sirve desde `public/vendor` (`scripts/copy-vendor.mjs`, en postinstall). Su CSS impone `position: relative` al contenedor: envolverlo.
- Tailwind v4: los estilos propios van en `@layer base/components`; si no, pisan a las utilidades.
- TypeScript fijado en 6.x: typescript-eslint no soporta la 7.
- Playwright 1.56 coincide con el Chromium preinstalado (`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).
