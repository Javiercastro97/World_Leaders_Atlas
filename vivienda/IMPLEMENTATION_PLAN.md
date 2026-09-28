# Plan de implementación

Documento breve con lo que se investigó antes de programar, las decisiones que salieron de ahí y el estado de cada fase.

## 1. Repositorio de partida

El repositorio (`world_leaders_atlas`) contiene el **Atlas Político Mundial**: una app Vite + React que ya está en producción (Vercel publica automáticamente cada push a `main`). No tiene nada en común con esta herramienta.

**Decisión:** construir la herramienta como una aplicación independiente en `vivienda/`. No cambia nada del Atlas, salvo una línea en su `eslint.config.js` para que su lint no recorra el subproyecto. Si más adelante se quiere un repositorio propio, se puede separar conservando el historial: `git subtree split -P vivienda`.

## 2. Fuentes: qué hay, qué es accesible y qué se puede automatizar

| Fuente | Acceso | ¿Automatizable? | Estado |
|---|---|---|---|
| CGPJ · Estadística Judicial, base **PxWeb** (`www6.poderjudicial.es/PxWeb-*/pxweb/es`) | API PxWeb v1 (JSON-stat) si está habilitada; si no, fichero PC-Axis | **Sí** | Adaptador `cgpj.ts` hecho. Tablas identificadas: `OUJII021.px` (lanzamientos practicados, Juzgados de 1.ª Instancia e Instrucción) y `OUSCPG020.px` (lanzamientos suspendidos, servicio común procesal general) |
| CGPJ · informe trimestral «Efecto de la crisis en los órganos judiciales» (datos por TSJ y provincia desde 2007/2013, con desglose LAU / hipotecaria / otros) | Informe y hojas de cálculo en poderjudicial.es | Semiautomático | Adaptador `manual.ts` (CSV revisado en PR con su procedencia) |
| INE · Padrón (población por provincia, tabla 2852) | API JSON Tempus3 | **Sí** | Adaptador `ine.ts` hecho |
| IGN · límites administrativos | Paquete npm `es-atlas` (CC BY 4.0) | Sí (en build) | `scripts/build-geo.ts` |
| Convocatorias de colectivos | Webs y perfiles públicos, heterogéneos | **No** (no se hace scraping de redes) | Formulario + moderación + ficheros curados vía PR |
| Directorio de colectivos | Webs públicas de cada organización | No | Ficheros curados vía PR |

**Comprobación técnica del acceso al CGPJ.** Desde el contenedor de desarrollo, la política de red del entorno bloquea `poderjudicial.es`, `datos.justicia.es` y `servicios.ine.es` (HTTP 403 del proxy de salida). Por eso la estructura de las tablas (nombres de dimensiones y valores) **no se ha podido verificar en vivo**. Consecuencias:

- El ETL no presupone nombres de dimensiones: detecta el papel de cada dimensión (periodo, territorio, procedimiento, concepto) con reglas que se pueden auditar. `npm run ingest:cgpj:discover` recorre el catálogo PxWeb, localiza todas las tablas de lanzamientos y genera un informe de mapeo para que una persona lo revise y, si hace falta, fije los roles a mano (`roles` en `CGPJ_TABLES`).
- La ruta base de PxWeb cambia con cada publicación (`PxWeb2020v2`, `PxWeb2023v1`, `PXWeb-2025-v1`, `PxWeb-20252-v1`…). Se prueban varias candidatas y se puede fijar con `CGPJ_PXWEB_BASE`.
- La ingestión automática corre en GitHub Actions (`.github/workflows/vivienda-ingest.yml`), donde el acceso a la red es normal. Guarda un snapshot bruto con SHA-256 y abre un pull request para revisarlo.
- **No hay ni una cifra escrita a mano en el código.** Hasta la primera ingestión, en producción el observatorio muestra un estado vacío honesto.

**Riesgo metodológico detectado.** Las tablas PxWeb están organizadas por *tipo de órgano judicial*. En las ciudades grandes los lanzamientos los practican órganos distintos de los de los partidos pequeños, así que una tabla sola **no es el total de un territorio**. Por eso:

- cada tabla es un dataset independiente, con su cobertura explicada;
- la serie principal (mapa y contadores) se configura en `data/config/series.json`, y nunca se suman datasets distintos;
- por defecto la serie principal es la del informe consolidado del CGPJ (`cgpj-efecto-crisis`, vía `manual`), hasta que alguien compruebe que la combinación de tablas PxWeb reproduce ese total.

## 3. Qué necesita la aportación y verificación de los colectivos

- Convocatorias (fecha, hora, punto público de encuentro, organización): formulario ciudadano y moderación, o ficheros curados vía PR.
- Cambios de estado (cancelada, suspendida, realizada): lo gestiona moderación o se reporta desde la ficha.
- Fichas de organizaciones: PR de la propia organización o petición en «Reportar».

## 4. Modelo de datos

Está en `migrations/001_init.sql` y en `src/lib/schema.ts` (Zod, una única fuente de verdad):

`sources`, `territories`, `organizations`, `locations`, `events`, `datasets`, `statistics`, `submissions`, `reports` y `moderation_log` (solo inserción, protegido con un trigger).

Hay dos estados independientes que no hay que confundir:

- `events.status`: programada, cancelada, suspendida o realizada.
- `events.verification_status`: verificada, fuente oficial del colectivo o pendiente.

La precisión de cada ubicación se guarda en `locations.precision` (exacta, vía, barrio o municipio).

## 5. Fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Arquitectura, BD, mapa de España (MapLibre), modelo territorial, adaptador CGPJ | ✅ |
| 2 | Convocatorias, agenda, panel del mapa, filtros, «Cerca de ti» | ✅ |
| 3 | Organizaciones, envío ciudadano, moderación, reportes | ✅ |
| 4 | Observatorio, series históricas, comparador, memoria | ✅ |
| 5 | SEO (metadata, OG, sitemap, JSON-LD), PWA, rendimiento y accesibilidad | ✅ Lighthouse (perfil móvil): rendimiento 90–96, accesibilidad 100, SEO 100 |
| 6 | Tests unitarios y e2e, auditoría visual y de privacidad, CI | ✅ Despliegue: pendiente de decidir hosting (ver README) |

## 6. Siguientes pasos

1. Ejecutar `ingest:cgpj:discover` desde un entorno con red, revisar el informe y fijar los `roles` si hace falta.
2. Transcribir la serie consolidada del informe «Efecto de la crisis» a `data/manual/` (con doble revisión).
3. Ejecutar la ingestión del INE.
4. Incorporar las primeras organizaciones reales mediante PR, con su consentimiento.
5. Elegir hosting con Postgres (Supabase u otro) y configurar los secretos (ver README).
