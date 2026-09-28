# Arquitectura

```
                 ┌────────────── GitHub Actions (semanal) ──────────────┐
 CGPJ PxWeb ─┐   │ scripts/ingest.ts                                    │
 INE Tempus ─┼──▶│   adaptador.fetchSnapshot → data/snapshots/<fuente>/  │──▶ PR de revisión
 CSV manual ─┘   │   adaptador.normalize     → data/normalized/*.json    │
                 └──────────────────────────────────────────────────────┘
                                         │ npm run db:sync
 data/curated (PR de colectivos) ────────┤
                                         ▼
                                   PostgreSQL ◀── envíos / reportes / moderación
                                         │
                          src/server/repo (PgRepo | FileRepo)
                                         │
                src/server/{events,stats,submissions}.ts  ← privacidad, series, flujo de moderación
                                         │
               ┌─────────────────────────┴─────────────────────────┐
               ▼                                                   ▼
        API REST (/api/*)                               Páginas Next.js (RSC)
                                                       + MapLibre / SVG en el cliente
```

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** estricto.
- **Tailwind CSS v4**: tokens en `src/app/globals.css`. Los estilos propios van en `@layer base/components` para que las utilidades puedan sobrescribirlos.
- **MapLibre GL JS 6**: el worker se sirve desde nuestro propio origen (`scripts/copy-vendor.mjs`). La cartografía propia (IGN vía `es-atlas`) está en `public/geo`. Las teselas de calles de OpenFreeMap son opcionales; si fallan, el mapa sigue funcionando.
- **PostgreSQL** con el cliente `postgres`. Es compatible con Supabase (`prepare: false` para su pooler). No se usan extensiones.
- **Zod**: una sola fuente de verdad para tipos y validación (`src/lib/schema.ts`). El vocabulario que usa el navegador está en `src/lib/vocab.ts`, sin Zod, para no inflar el bundle.
- Gráficos: SVG propio, sin librerías (`src/components/charts`).
- Tests: Vitest para unitarios e integración con Postgres, Playwright para e2e en escritorio y móvil.

Dependencias de ejecución: `next`, `react`, `react-dom`, `maplibre-gl`, `zod` y `postgres`. Nada más.

## Carpetas

| Ruta | Contenido |
|---|---|
| `src/lib/` | Dominio puro, sin E/S: territorios, fechas con zona horaria, privacidad, geo, iCal, moderación, anti-spam |
| `src/data-sources/` | Adaptadores de ingestión (`cgpj`, `ine`, `manual`, `collectives`) y parsers (JSON-stat, PC-Axis) |
| `src/server/` | Repositorios, servicios, helpers HTTP y cartografía SVG |
| `src/app/` | Páginas y rutas API |
| `src/components/` | UI. `map/` contiene el mapa MapLibre, la vista previa SVG y el panel |
| `migrations/` | SQL versionado |
| `scripts/` | ETL, migración, sincronización, degradación de privacidad y cartografía |
| `data/` | `curated/` (vía PR), `manual/` (CSV), `snapshots/` (brutos), `normalized/` (ETL), `config/series.json` |
| `tests/` | `unit/` y `e2e/` (los fixtures e2e se generan con fechas relativas) |

## Decisiones clave

- **Dos repositorios, una interfaz.** `PgRepo` en producción y `FileRepo` sin base de datos (desarrollo y despliegues de solo lectura). Los filtros son funciones puras compartidas (`repo/filters.ts`).
- **La privacidad se aplica en la capa de servicio** (`server/events.ts → toPublic`): ninguna ruta devuelve la ubicación sin pasar por `publicLocation()`. Además, `privacy:degrade` elimina de la BD los puntos exactos del histórico.
- **Fechas.** Cada convocatoria guarda fecha y hora locales más su zona (`Europe/Madrid` o `Atlantic/Canary`). «Hoy» y «mañana» se calculan en la zona del evento.
- **El TSJ no es la CCAA.** Ceuta y Melilla pertenecen al TSJ de Andalucía. Los datos por TSJ tienen su propio `territory_type`.
- **Totales derivados.** Solo se calculan cuando están todas las piezas, se marcan `derivation: "derived"` y se contrastan con los totales publicados.
- **Mapa accesible.** Convocatorias y colectivos son `<button>` DOM, alcanzables con teclado. Todo lo que muestra el mapa está también en el listado del panel. En móvil se muestra primero una vista previa SVG ligera y MapLibre se carga al pulsar.
- **Mejora progresiva.** Filtros y formularios funcionan sin JavaScript (GET/POST clásicos). Con JavaScript se añaden los errores en línea.
- **PWA.** `public/sw.js`: red primero para la agenda y las fichas, *stale-while-revalidate* para `/api/events` y el directorio. Nunca se cachean formularios, moderación ni peticiones con ubicación.

## API

| Método y ruta | Descripción |
|---|---|
| `GET /api/events` | `province`, `territory`, `municipality`, `from`, `to`, `type`, `organization`, `lat`, `lon`, `radius`, `include_past` |
| `GET /api/events/[slug]` · `/ics` | Ficha y su iCalendar |
| `GET /api/statistics` | `view=raw\|choropleth\|series`, `metric`, `territory`, `level`, `period`, `period_type`, `procedure`, `dataset` |
| `GET /api/organizations` | `territory`, `type`, `q` |
| `GET /api/map` | GeoJSON de convocatorias y colectivos, más el choropleth |
| `GET /api/territories` | Modelo territorial |
| `POST /api/submissions` | Aviso de convocatoria (JSON o formulario) |
| `POST /api/reports` | Solicitud de corrección o retirada |
| `/api/moderation/*` | Requiere `Authorization: Bearer $MODERATION_TOKEN` o la sesión de `/moderacion` |

Las respuestas públicas se cachean (`s-maxage`) y permiten CORS. Las que dependen de la ubicación, nunca.
