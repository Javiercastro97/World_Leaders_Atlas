# Mapa por la Vivienda

Herramienta cívica de código abierto sobre el derecho a la vivienda en España:

- **Estadística oficial** de lanzamientos (desahucios) del CGPJ por provincia, CCAA, año, trimestre y tipo de procedimiento.
- **Agenda** de convocatorias públicas difundidas por organizaciones: paradas de desahucio, concentraciones, asambleas y asesorías.
- **Directorio** de colectivos y asociaciones.
- **Memoria**: cómo ha evolucionado el mapa a lo largo del tiempo.
- **Aportación ciudadana** con moderación, y separación estricta entre datos oficiales, información de organizaciones y avisos sin verificar.

> Datos + territorio + memoria + movilización.

## Principios

1. **Estadística ≠ casos.** Los datos agregados se muestran como choropleth, gráficos o indicadores, **nunca como puntos**. Solo hay un punto en el mapa cuando existe una convocatoria concreta y documentada.
2. **Trazabilidad.** Cada dato lleva su fuente, URL, fecha de consulta, periodo, ámbito, metodología y última actualización.
3. **Nada inventado.** No hay cifras escritas a mano en el código. Sin datos, la interfaz muestra un estado vacío.
4. **Privacidad por diseño.** No se guardan datos de personas afectadas ni IPs, y la precisión geográfica del histórico se reduce automáticamente. Ver [PRIVACY.md](PRIVACY.md).

## Puesta en marcha

Requisitos: Node ≥ 20. PostgreSQL ≥ 14 es opcional.

```bash
cd vivienda
npm install            # también copia el worker de MapLibre a public/vendor
npm run dev            # http://localhost:3000
```

Sin `DATABASE_URL`, la app lee los ficheros de `data/`: datos curados más los resultados del ETL. En desarrollo carga además **datos DEMO / FICTICIOS**, marcados con `[DEMO]` y con una banda visible, que **nunca** se cargan con `NODE_ENV=production`. Para trabajar sin ellos: `DEMO_DATA=0 npm run dev`.

### Con PostgreSQL (o Supabase)

```bash
cp .env.example .env.local        # rellena DATABASE_URL, MODERATION_TOKEN, SUBMISSION_SECRET
npm run db:migrate
npm run db:sync                   # territorios + data/normalized + data/curated
```

### Datos

```bash
npm run ingest:cgpj:discover   # catálogo PxWeb del CGPJ y cómo se mapearía cada tabla
npm run ingest:cgpj            # snapshot bruto + normalización → data/normalized
npm run ingest:ine             # población (denominador de tasas)
npm run ingest:manual          # CSV transcritos de informes oficiales (data/manual)
npm run geo:build              # regenera la cartografía de public/geo
```

## Scripts de calidad

```bash
npm run typecheck && npm run lint && npm test
TEST_DATABASE_URL=postgres://…/desechable npm test   # incluye la integración con Postgres
npm run test:e2e        # Playwright (escritorio + móvil) con fixtures ficticios; con DATABASE_URL prueba también envío y moderación
```

## Despliegue

Cualquier plataforma que ejecute Next.js (Node), más un PostgreSQL.

| Variable | Obligatoria | Uso |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | sí | URLs canónicas, sitemap y OpenGraph |
| `DATABASE_URL` | para aceptar envíos | Sin ella, la app funciona en solo lectura |
| `MODERATION_TOKEN` | para moderar | Acceso a `/moderacion` |
| `SUBMISSION_SECRET` | sí en producción | HMAC del sello anti-spam y del hash diario de IP |
| `NEXT_PUBLIC_VECTOR_TILES` | no | Teselas de calles (OpenMapTiles). Por defecto, OpenFreeMap |

Tareas programadas: `.github/workflows/vivienda-ingest.yml` (ingestión semanal con PR de revisión) y `npm run privacy:degrade` a diario, que borra de la BD los puntos exactos de convocatorias ya pasadas.

## Documentación

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): investigación inicial y fases
- [ARCHITECTURE.md](ARCHITECTURE.md): cómo está construido
- [DATA_SOURCES.md](DATA_SOURCES.md): fuentes y **cómo añadir un proveedor**
- [METHODOLOGY.md](METHODOLOGY.md): qué es un lanzamiento, qué es una convocatoria y cómo se verifica
- [MODERATION.md](MODERATION.md): guía de moderación
- [PRIVACY.md](PRIVACY.md): privacidad y RGPD
- [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [SECURITY.md](SECURITY.md)

Licencia: [AGPL-3.0-or-later](LICENSE). Si modificas y publicas este servicio, comparte también el código.
