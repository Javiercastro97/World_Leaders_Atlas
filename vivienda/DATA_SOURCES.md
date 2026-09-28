# Fuentes de datos

Orden de preferencia: APIs y endpoints estructurados → ficheros oficiales descargables → transcripción revisada de informes oficiales. **No se hace scraping de redes sociales ni de páginas que requieren iniciar sesión**. Se respetan `robots.txt`, los términos de uso y los límites de peticiones: el cliente PxWeb espera 1,5 s entre peticiones y se identifica con `User-Agent`.

## CGPJ · Estadística Judicial (PxWeb) — `src/data-sources/cgpj.ts`

- **Qué es:** la base de datos PC-Axis/PxWeb de la Sección de Estadística del Consejo General del Poder Judicial.
- **Acceso:** `https://www6.poderjudicial.es/<versión>/pxweb/es/` (interfaz web). API PxWeb v1 en `<versión>/api/v1/es/…` si está habilitada, o fichero `.px` en `<versión>/Resources/PX/Databases/<bd>/<tabla>.px`.
- **Versión de la ruta:** cambia con cada publicación (`PxWeb2020v2`, `PxWeb2023v1`, `PXWeb-2025-v1`, `PxWeb-20252-v1`). El adaptador prueba `CGPJ_PXWEB_BASE` y después la lista de `CGPJ_BASE_CANDIDATES`.
- **Tablas configuradas** (títulos y rutas localizados en el catálogo público):

| Dataset | BD / tabla | Qué mide | Cobertura |
|---|---|---|---|
| `cgpj-lanzamientos-practicados-jpii` | `10.-Juzgados de Primera Instancia e Instrucción` / `OUJII021.px` | Lanzamientos practicados | Solo ese tipo de órgano |
| `cgpj-lanzamientos-suspendidos-scpg` | `13.-Servicios Comunes de Notificaciones y Embargos` / `OUSCPG020.px` | Lanzamientos suspendidos | Solo partidos con servicio común |

- **Estado de verificación:** en el entorno de desarrollo la red bloqueaba `poderjudicial.es`, así que las dimensiones exactas de estas tablas **todavía no se han comprobado**. El primer paso con red es:

  ```bash
  npm run ingest:cgpj:discover   # informe en data/snapshots/cgpj/discover-*.txt
  ```

  Revisa el papel que se asigna a cada dimensión (periodo, territorio, procedimiento, concepto u otra) y cómo se clasifica cada valor territorial. Si algo no cuadra, fija los roles en `CGPJ_TABLES[i].roles`.

- **Qué hace la normalización** (`cube-mapping.ts`):
  - Periodos `2024`, `2024T1`, `1er trimestre 2024`… → `2024` o `2024-Q1`. Si un trimestre es ambiguo, no se adivina.
  - Territorios: nombres oficiales, exónimos (Gerona, Vizcaya…), prefijos numéricos, TSJ frente a provincia (la etiqueta repetida en uniprovinciales: la primera aparición es el TSJ). Los partidos judiciales y órganos concretos se ignoran para no contar dos veces.
  - Procedimiento: ejecución hipotecaria / LAU / otros / total.
  - Dimensiones sin papel conocido: se toma su valor «Total» o, si no existe, se suman y se avisa.
  - Agregados derivados (provincias → CCAA → España, trimestres → año) solo cuando están todas las piezas. Se contrastan con los totales publicados.

## CGPJ · informe «Efecto de la crisis en los órganos judiciales» — `manual.ts`

Es la publicación trimestral de referencia para los lanzamientos por TSJ y provincia, con desglose por procedimiento. Como se publica como informe, sus tablas se incorporan **por transcripción revisada** en `data/manual/*.csv` (formato en `data/manual/README.md`) y cada fila conserva la URL del informe. Es la serie principal por defecto (`data/config/series.json → cgpj-efecto-crisis`).

## INE · Padrón municipal — `ine.ts`

- API: `https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/2852?nult=25`. La tabla se configura con `INE_POPULATION_TABLE`.
- Población a 1 de enero por provincia. Se usa **solo** como denominador de las tasas por 100.000 habitantes.
- Hogares: no se incluyen todavía. La Encuesta Continua de Hogares no tiene la misma granularidad provincial y trimestral; cuando se incorpore, será con su propia nota metodológica.

## Cartografía — `scripts/build-geo.ts`

- IGN, Equipamiento Geográfico de Referencia Nacional (CC BY 4.0), empaquetado por `es-atlas`: provincias, CCAA y un índice de 8.131 centroides municipales.
- Natural Earth (`world-atlas`) para los países vecinos.
- Teselas vectoriales de calles: OpenStreetMap vía OpenFreeMap (esquema OpenMapTiles). Opcionales.

## Colectivos y convocatorias — `collectives.ts`

Los ficheros de `data/curated/organizations/*.json` y `data/curated/events/*.json` se validan con el mismo esquema que la BD. Ver `data/curated/README.md`.

## Serie principal

`data/config/series.json` define, para cada métrica, una **lista de datasets en orden de prioridad**: se usa el primero que tenga datos. Nunca se suman datasets de órganos distintos. Antes de cambiarla, documenta en el PR por qué la nueva serie es comparable y qué cubre.

## Reproducibilidad

Cada ingestión crea `data/snapshots/<fuente>/<AAAA-MM-DDTHHMMSSZ>/` con:

- los ficheros brutos, tal cual se descargaron;
- `manifest.json`, con la URL, el SHA-256, el tamaño, el tipo y la fecha de cada fichero;
- `report.json`, con los avisos de normalización.

`npm run ingest:<fuente> -- --normalize-only` rehace la normalización a partir del último snapshot sin conectarse a la red, tras comprobar que los hashes coinciden.

---

## Cómo añadir un proveedor de datos

1. Crea `src/data-sources/<id>.ts` que exporte un `DataSourceAdapter` (`types.ts`):

   ```ts
   export const miAdapter: DataSourceAdapter = {
     id: "mi-fuente",
     name: "Organismo · Estadística X",
     async fetchSnapshot(ctx) {
       const res = await ctx.fetch(URL, { headers: { "User-Agent": USER_AGENT } });
       const file = await saveRaw(ctx.dir, "datos.json", await res.text(), URL, "application/json");
       return { source: "mi-fuente", snapshot_id: ctx.snapshotId, retrieved_at: ctx.now.toISOString(), files: [file], notes: [] };
     },
     async normalize(dir, manifest) {
       // Función PURA del snapshot: lee ficheros de `dir`, devuelve Statistic[] con su procedencia.
       return { sources: [...], datasets: [...], statistics: [...], warnings: [] };
     },
   };
   ```

   - Si la fuente es PxWeb o JSON-stat, reutiliza `PxWebClient`, `parseJsonStat` o `parsePx` y `mapCube`.
   - Cada `Statistic` debe llevar `source_id`, `dataset_id`, `snapshot_id` y `retrieved_at`. Cada `Dataset`, su `methodology` y `limitations`.
   - Para emparejar territorios, usa `matchTerritory(nombre, nivel)`. No inventes códigos.
2. Regístralo en `src/data-sources/index.ts` y añade un script en `package.json`.
3. Añade tests en `tests/unit/` con un **fixture sintético** que imite la estructura, nunca con cifras copiadas presentadas como reales.
4. Si debe alimentar el mapa, añádelo a `data/config/series.json` y justifícalo en el PR.
5. Añádelo al workflow de ingestión si se puede automatizar.
