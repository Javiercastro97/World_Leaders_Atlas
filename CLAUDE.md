# Atlas Político Mundial — Contexto para Claude Code

## Lo que es este proyecto

Atlas político mundial interactivo con datos en vivo de Wikidata: mapa mundi clicable → panel lateral con jefe de gobierno/estado, foto, partido, y gráfico de últimas elecciones. Estética de periodismo de datos (FT, Economist, NYT Interactive) — no dashboard SaaS.

## Cómo trabajar con Javier

- **No sabe programar.** Explica en lenguaje natural qué vas a hacer ANTES de tocar código.
- **Trabaja paso a paso** siguiendo el orden de BRIEF.md. No saltes adelante. Termina un paso, pide confirmación de prueba en navegador, y solo entonces sigue.
- **Decisiones de diseño dudosas** (tamaños, springs, márgenes): ofrece dos opciones, no decidas solo.
- **Queries SPARQL no triviales**: muestra el resultado crudo antes de conectarlas a la UI.
- **Nunca inventes datos.** Si Wikidata no tiene algo, la UI lo dice con dignidad (ver mensajes editoriales en PartyCard, HeadOfGovernmentCard).
- **Cuando pidas prueba**: di exactamente qué comando ejecutar y qué debe verse.

## Estado del proyecto

### Completados
- **Paso 1** — Dependencias, Tailwind v4, Google Fonts (Fraunces + Inter), CSS custom properties.
- **Paso 2** — WorldMap con TopoJSON world-atlas, proyección geoEqualEarth, hover/click/zoom.
- **Paso 3** — `lib/sparql.ts`: cliente SPARQL con cache en memoria, AbortController, headers correctos.
- **Paso 4** — `useWikidataCountry` hook + `CountryPanel` + `HeadOfGovernmentCard` + `PartyCard` con datos reales de Wikidata.
- **Paso 5** — `useWikidataElection` con cascada Wikidata → Wikipedia → fallback editorial.
- **Paso 6** — ElectionChart completo y validado visualmente. Incluye: colores de partido (Plantilla:Color_político + expandtemplates fallback), `electoral-systems.json` como fuente de verdad del tipo de elección (174 entradas), filtrado SPARQL por tipo, filtro de precisión de fecha (`prec >= 10`), heurística de infobox compuesto, `&redirects=1`, P361 parent sitelink fallback, nombres de candidatos en presidenciales (etiqueta doble línea en YAxis), headers dinámicos ("PRESIDENCIALES · 2024", "LEGISLATIVAS · 2025", etc.), doble vuelta (Francia/Brasil/Argentina), fix interval={0} en Recharts v3. Validado visualmente: UK 14 partidos ✓, Brasil 4 candidatos ✓, Francia doble vuelta ✓, Alemania todas las etiquetas ✓.

- **Paso 7** — SearchBar conectado. Búsqueda insensible a acentos contra `name` (es) y `nameEn` (en), cubre los 263 países del dataset. zIndex: 5 (sobre mapa, bajo panel). Validado visualmente.

- **Paso 8** — Pulido visual masivo. Bloques completados y validados en móvil físico:
  - **Bloque A** — ElectionChart con barra animada, luminancia para color de label, tooltip oscuro, footer participación + Wikipedia.
  - **Bloque B–D** — (ver historial — refinamientos de ElectionChart y CountryPanel pre-F).
  - **Bloque E** — ElectionChart rewrite completo: luminance helper, dark tooltip, bar animation, LabelList inside/outside logic, footer participación + Wikipedia link. Props actualizadas: `{ parties, electionType, turnout?, wikipediaUrl? }`.
  - **Bloque F — Responsive Móvil** — F1 (CSS layout bottom sheet), F2 (polishing: hit area 44px, font-size, overflow), F3a (useIsMobile hook + snap state + drag handle visual), F3b (gestos táctiles reales, passive:false, stale-closure vía refs), F3c (fling-to-close con velocimetría), F4 (pinch-zoom/pan táctil del mapa vía `touch-action: none`). Validado en móvil físico.

- **Paso 9** — Limpieza de deuda técnica + fixes de parser. Completado y validado visualmente:
  - **Masthead selector**: `#root > div > div:first-child` → `className="masthead"` en App.tsx + selector CSS `.masthead` en index.css. Frágil por estructura eliminado.
  - **CSS móvil sin `!important`**: estilos del CountryPanel en móvil migrados de `S` inline + `!important` a clases CSS propias en index.css.
  - **Fix SPARQL ORDER BY**: `ORDER BY DESC(?date)` → `ORDER BY DESC(BOUND(?esSlug)) DESC(?date)` en `outerSelect` y `outerSelectPresidential`. Soluciona India (Q668) que mostraba elección Rajya Sabha en lugar de Lok Sabha. 0 regresiones verificadas en países de control.
  - **Refactor `parsePairs` + `splitInlineFields`**: manejo de múltiples campos en una misma línea del infobox (formato India 2024: `|partido1=[[BJP]] |líder1=[[Narendra Modi]]`). Retrocompatible — todos los países previos sin cambio.
  - **Líderes parlamentarios en tooltip**: `parseFichaDeEleccion` añade `líder${n}` como fallback; `parseInfoboxElection` añade `leader${n}`. En elecciones no presidenciales, el campo `candidate` (ahora = líder del partido) aparece como tercera línea sutil en el tooltip (no en el eje Y).

- **Paso 10** — Deploy a Vercel. Atlas en producción. Auto-deploy configurado: push a `main` → Vercel rebuild automático.

- **Rediseño Dirección A** — Bloques visuales completados y fusionados a main:
  - **R1** — Bandera en el header del panel: `<img>` desde Wikidata P41 (URL directa, sin proxy), tamaño 28×21px, borde hairline `1px solid var(--rule)`. Fallback silencioso si P41 no existe. Fuente de la URL: SPARQL junto al resto de los datos del país.
  - **R2.1** — Retícula cartográfica: `<Sphere>` y `<Graticule>` de react-simple-maps, stroke `var(--rule)`, strokeWidth 0.5/0.4. Dibuja el contorno Equal Earth y los meridianos/paralelos como textura editorial sutil.
  - **R2.2** — Hover refinado: transición `fill/stroke/stroke-width 180ms ease-out` en ambos estados (`default` y `hover`) para que la animación funcione en ambas direcciones. Hover añade `stroke: ink3 (#6B6660)` y `strokeWidth: 0.6` — más sutil que el seleccionado (1.5px / ink).
  - **R2.3** — Zoom cinematográfico: ZoomableGroup con `center`/`zoom` como estado controlado (`camera: { center, zoom }`). `computeCamera` calcula centroide (`geoCentroid`) y zoom por bounding box (`calcZoom`). Viajes: país→país directo, cierre→mapamundi. `is-panning` con DOM imperativo (sin lag). CSS `transition: transform 800ms` en `.rsm-zoomable-group`, desactivado durante gestos. Offset móvil: `latOffset = min(25, 61.5/zoom)`. Fallback sin zoom para países fuera del TopoJSON (Andorra, Bahréin). SearchBar dispara el mismo `useEffect`. `prefers-reduced-motion` override.
  - **Fix móvil producción** — Masthead y SearchBar con fade-out (`opacity: 0; pointer-events: none`) cuando el panel está abierto en móvil, controlado por `data-panel-open` en el div raíz de App.tsx. Snap FULL del bottom sheet `90vh → 86vh`.

### Siguiente
- **Rediseño R3** — Coreografía del panel: crossfade entre países, animación de entrada/salida de secciones.
- **Rediseño R4** — Modo oscuro (opcional, baja prioridad).

### Roadmap de features (aprobado, sin orden fijo)
- **OG image + deep linking**: compartir URL de un país directamente (ej. `/country/Q29`).
- **B1 — Próximas elecciones**: fecha de la siguiente elección programada desde Wikidata.
- **B2 — Comparador de países**: panel lateral con dos países en paralelo.
- **B5 — Organizaciones internacionales**: pertenencia a ONU, UE, OTAN, etc.
- **B7 — Coloreado ideológico del mapa**: requiere taxonomía de ideologías aprobada por Javier antes de implementar.

### Pendientes (orden del BRIEF.md)
— Todo el BRIEF.md original completado. Ver Roadmap arriba para próximas features.

## Arquitectura clave

### Resolución de colores de partido
- **Fuente principal (es.wikipedia)**: `Plantilla:Color_político` — 1328+ entradas curadas. Se descarga una vez por sesión, se parsea el `{{#switch}}` (stripping de comentarios HTML + split en `|`) y se cachea como `Map<nombre, hex>`. Lookup directo por `colorTemplateArg` extraído del infobox.
- **Fuente fallback (en.wikipedia)**: `action=expandtemplates` de la API de Wikipedia. Una request por nombre de partido, en paralelo, cacheadas. Expande `{{Party color|NAME}}` → hex via módulo Lua `Module:Political party`.
- **NO usar Wikidata P465**: cobertura desigual + problemas de IRI encoding. La plantilla es la fuente que la propia Wikipedia usa.
- **Render progresivo**: `setData` inmediato con grises → `resolvePartyColors` en background → segundo `setData` al terminar. Loading spinner desaparece con el chart; colores aparecen sin flash de carga.
- Código: `src/lib/wikipediaColors.ts`. `ElectionParty.colorTemplateArg` es el campo clave para el lookup es.wikipedia.

### Performance de fetches
- **Wikipedia**: `&rvsection=0` → solo sección 0 del artículo (~9KB vs ~115KB para UK 2024). El infobox de resultados siempre está en la sección 0.
- **`&redirects=1`**: la API de Wikipedia NO sigue redirects por defecto. Sin este parámetro, slugs como "2022 Brazilian presidential election" (que es un redirect) devuelven wikitext vacío. Siempre incluirlo en `fetchWikitext`.
- **Timeouts**: 8s por intento en `sparql.ts` y `wikipedia.ts` via `AbortSignal.any([outerSignal, AbortSignal.timeout(8000)])`. `TimeoutError` se trata como transient (reintenta).
- **Tiempos típicos**: primer click ~1.1s (incluye descarga de plantilla de colores), clicks posteriores 200-400ms (todo cacheado).

### Clasificación del tipo de elección — `src/data/electoral-systems.json`
- 174 entradas, clave = QID de país, valor `{ electionTypeToShow, note }`. Fuente única de verdad. Deprecated y eliminado `no-elections-override.json`.
- `electionTypeToShow`: `"presidential"` | `"legislative"` | `"general"` | `"none"`.
  - `"none"` → fallback editorial inmediato (monarquías absolutas, ciudades-estado, etc.).
  - Países no clasificados → aviso en consola + query general como fallback seguro.
- Query SPARQL según tipo: presidential → `wdt:P279* wd:Q858439`; legislative → `wdt:P279* wd:Q2618461` (**ojo**: Q40222 = "Kate Gleason", una persona — usar Q2618461); general → `wdt:P279* wd:Q40231`.
- Fallback cascade: si la query tipada no devuelve resultados → reintenta con query general.
- **Filtro de precisión de fecha** (`FILTER(?prec >= 10)`): Wikidata pre-crea items de elecciones futuras con fecha año-solo (precisión=9, almacenada como 1 enero). Pasan `FILTER(?date < NOW())` aunque la elección no haya ocurrido. Requiere `p:P585/psv:P585/wikibase:timePrecision` en lugar de `wdt:P585`.

### P361 parent sitelink fallback (elecciones presidenciales)
- Algunos items presidenciales en Wikidata (ej. Q83975602, Brasil 2022; Q84309634, Perú 2021) no tienen sitelinks directos en Wikipedia, pero su item padre vía `wdt:P361` ("part of") sí los tiene.
- `buildPresidentialElectionQuery` usa COALESCE: primero intenta sitelink directo del item presidencial; si no existe, usa el sitelink del padre. Variables separadas `?esSlugDirect`/`?esSlugParent` → `BIND(COALESCE(...) AS ?esSlug)`.
- Las queries general y legislative NO tienen este fallback (su granularidad es diferente).

### Heurística de infobox compuesto (elecciones presidenciales)
- Algunos artículos en.wikipedia cubren elecciones generales (presidencial + legislativa) en un único `{{Infobox election}}` anidado. `parsePairs` aplana todas las líneas, mezclando campos de módulos distintos.
- Guard en `parseInfoboxElection` (activo solo cuando `isPresidential=true`): si `partyCount >= 4` y `partyWithCandCount / partyCount < 0.5`, devolver `null` → hook cae a Capa C-b (fallback editorial).
- Principio editorial: mostrar "datos no disponibles" es mejor que mostrar datos cruzados entre módulos. No se inventan datos para llenar huecos.

### Doble vuelta (segunda vuelta presidencial)
- El parser `parseFichaDeEleccion` detecta campos sufijados `2v` en `{{Ficha de elección}}`: `porcentaje2v1`, `porcentaje2v2`, `votos2v1`, `votos2v2`, `participación2`. Si `porcentaje2v1` y `porcentaje2v2` están ambos presentes, construye `secondRound` reutilizando nombre, candidato y colores de la primera vuelta (misma numeración). Si solo uno o ninguno, `secondRound = null`.
- Solo se muestra cuando los datos estructurados existen en Wikipedia. No se inventa ni extrapola.
- `ElectionData` lleva `secondRound: ElectionParty[] | null` y `turnoutSecondRound: number | null`.
- `ElectionChart` acepta `{ parties, electionType }` (no el objeto `ElectionData` completo) — reutilizable para ambos rounds sin duplicar el componente.
- En `CountryPanel`, cuando `secondRound` existe: header "PRIMERA VUELTA · YYYY", chart, `<hr>` separador con `margin: 18px 0`, header "SEGUNDA VUELTA · YYYY", chart, participación de segunda vuelta si no es null. Mismo estilo de header que el genérico (11px, caps, --mute, letter-spacing).
- El orden de barras en segunda vuelta es por % descendente: el ganador siempre arriba.
- Colores heredados: `buildElectionData` construye un `Map<nombre, colorHex>` de la primera vuelta coloreada y lo aplica a los partidos de segunda vuelta por nombre.
- La doble vuelta solo está implementada para `parseFichaDeEleccion` (es.wikipedia). `parseInfoboxElection` devuelve `secondRound: null` — el patrón `2v` no está estandarizado en en.wikipedia.

### SearchBar
- Conectado al mismo `handleSelect` que el click del mapa — mismo flujo de estado, sin adaptadores.
- Búsqueda insensible a acentos: `normalize("NFD").replace(/[̀-ͯ]/g, "")` aplicado a query y a datos del dataset (precalculado fuera del componente, una sola vez al cargar).
- Busca contra `name` (es), `nameEn` (en) e `iso3`. Máximo 8 resultados. Con 263 países el filtro es O(n) puro, instantáneo.
- Cobertura: los 263 países del dataset, no solo los 174 clickables en el mapa. Países buscables pero no clickables (Andorra, Bahréin, Malta…) abren el panel y caen a fallback editorial genérico en la sección de elecciones — comportamiento esperado.
- `zIndex: 5`: por encima del mapa, por debajo del panel (`zIndex: 10`).

### Bloque F — Responsive Móvil (arquitectura)

- **`useIsMobile` hook** (`src/hooks/useIsMobile.ts`): `window.matchMedia('(max-width: 720px)')` con listener `change`. Valor inicial sincrónico en `useState` initializer para evitar flash de layout incorrecto.

- **Bottom sheet (panel en móvil)**: CSS `.panel-overlay` con `position: fixed; bottom: 0; width: 100%; height: 86vh; border-radius: 8px 8px 0 0`. (Era 90vh; bajado a 86vh para dejar franja libre visible y alejar el botón X de la zona de gestos del sistema.) Transform controlado desde JS (no CSS animation) — la razón es que `animation-fill-mode: both` entra en conflicto con `style.transform` inline: ambos compiten por la misma propiedad. Fuente única de verdad: estado React + refs.

- **Snap state**: `snapPoint: 'full' | 'peek'`. `'full'` → `translateY(0)`, `'peek'` → `translateY(50vh)`. La transición CSS `transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1)` en `.panel-overlay` anima el snapping. Durante drag se suprime con `panelEl.style.transition = 'none'` para respuesta inmediata.

- **Touch handlers con `passive: false`**: Necesario para `e.preventDefault()` (evita scroll del navegador durante drag). `handleEl.addEventListener('touchstart', fn, { passive: false })`. Los tres handlers (`touchstart`, `touchmove`, `touchend`) comparten workspace local (`startY`, `baseTranslateY`, `currentDragY`, `lastY`, `lastTimestamp`) en el closure del `useEffect`.

- **Anti-stale-closure**: Todos los valores mutables que los handlers necesitan leer se acceden vía refs (`snapPointRef`, `isClosingRef`, `onCloseRef`). El array de dependencias del `useEffect` de gestos es solo `[isMobile]`. `onCloseRef.current = onClose` se actualiza en cada render sin necesitar un efecto.

- **Fling-to-close**: Velocidad = `(finalY - lastY) / dt`, solo válida si `dt < 100ms`. Umbral: velocidad `> 1.2 px/ms` OR posición actual `> 60vh` → `animatedClose()`. `animatedClose()` definida en el cuerpo del componente (safe para llamar desde stale closure porque todos sus internals son refs): aplica `translateY(100vh)` + `setTimeout(onClose, 260)`.

- **Unmount safety**: Tres capas — `mountedRef` (checked antes de `onClose()`), `closeTimerRef` (cleared en cleanup del useEffect de montaje), `isClosingRef` (previene double-close).

- **`touch-action: none` en WorldMap**: Añadido al `div` contenedor del mapa (`src/components/WorldMap.tsx`). Cede el control de gestos táctiles al d3-zoom nativo (que tiene implementación completa de pinch y pan). Sin este CSS, el navegador roba los eventos táctiles antes de que d3 pueda procesarlos.

- **Masthead selector**: `className="masthead"` en App.tsx + `.masthead` en index.css. El selector estructural frágil fue eliminado en el Paso 9.

### Zoom cinematográfico — R2.3 (arquitectura)

- **ZoomableGroup controlado**: `center: [lon, lat]` y `zoom: number` como estado React único (`camera: { center, zoom }`). Cuando las props cambian, `useZoomPan` interno llama `svg.call(zoom.transform, newPos)` de forma inmediata → el CSS `transition: transform 800ms` en `.rsm-zoomable-group` anima el viaje.

- **`computeCamera(selectedId, geos, isMobile)`**: función pura que devuelve `Camera | null`. `null` si el país no está en el TopoJSON (Andorra, Bahréin) — el panel abre sin zoom. Usa `geoCentroid` para el centroide y `calcZoom` para el nivel basado en el bounding box (geoBounds, spans > 100° → 1.9, > 60° → 2.7, > 30° → 3.7, > 15° → 4.7, resto → 5.5).

- **Offset móvil**: cuando `isMobile`, desplaza el centro al sur: `latOffset = min(25°, 61.5/zoom)`. El país queda en la franja visible sobre el bottom sheet de 86vh. Derivado de la geometría del viewport (visible strip = 14vh, centro en 7%).

- **Gestos sin lag** (`is-panning`): `onMoveStart` → `classList.add('is-panning')` (imperativo, sin React state). `onMoveEnd` → `setCamera(coords)` + `requestAnimationFrame(() => classList.remove('is-panning'))`. El CSS `.is-panning .rsm-zoomable-group { transition: none }` elimina el lag en gestos táctiles y de ratón.

- **Viajes**: país→país (selectedId cambia directamente), cierre→mapamundi (selectedId=null → INITIAL_CENTER [0,0], INITIAL_ZOOM 1). SearchBar usa la misma ruta (mismo `handleSelect` → mismo `selectedId` → mismo `useEffect`).

- **`prefers-reduced-motion`**: `.rsm-zoomable-group { transition: none !important }` en el bloque reduced-motion de index.css.

### Flujo de trabajo de rediseño

- Bloques visuales grandes (R1, R2, R3…) se trabajan en local, se validan con Javier en `npm run dev`, y se fusionan a `main` cuando el bloque está aprobado.
- Push a `main` = producción automática vía Vercel.
- NO hacer push sin validación visual de Javier (esto aplica siempre, no solo al rediseño).
- Rama `redesign` puede crearse para trabajo especulativo o experimental. En la práctica, los bloques R1/R2 se hicieron directamente en `main` como cambios sin commitear hasta aprobación.

### ElectionChart — props y Recharts v3
- Props: `{ parties: ElectionParty[], electionType: ElectionTypeToShow }`. No recibe `ElectionData` completo.
- **`interval={0}` en `<YAxis>` es obligatorio**: Recharts v3 cambió el default de `interval` de `0` a `'preserveEnd'`. Cuando se usa una función `tick` personalizada en lugar de `tick={{ fontSize: 11 }}`, Recharts pierde la pista del tamaño del tick y puede ocultar ticks alternos en charts con muchas barras. `interval={0}` fuerza que todos los ticks sean visibles. Aplica a todos los charts del proyecto.

### Mapeo de países
- `src/data/country-codes.json` — 263 entradas generadas desde Wikidata. Clave = ID numérico ISO 3166-1 (el mismo que devuelve world-atlas al clicar). Valor: `{ qid, iso3, name, nameEn }`.
- `src/lib/countryMap.ts` — `getCountryByNumericId(numericId)` → `CountryMeta | null`.
- Kosovo (Q1246, ID 383), Taiwán (Q865, ID 158), Palestina (Q219060, ID 275) añadidos manualmente.

### Selección P6 vs P35 (jefe de gobierno vs jefe de estado)
El hook `useWikidataCountry` recoge ambos y decide en JS:
1. **Override de partido único** (`src/data/heads-of-state-override.json`): Cuba, China, Corea del Norte, Vietnam, Laos → siempre usar P35. Wikidata no los clasifica con labels que el regex pueda detectar. **No añadir países sin diagnóstico previo.**
2. **Regex sobre P122** (forma de gobierno): si contiene "presidencial", "presidential", "popular", "socialista", "socialist", "comunista", "communist" → usar P35.
3. **Defecto**: usar P6 (jefe de gobierno).

### Query SPARQL principal
- Variables: `?gov`/`?govLabel` (P6), `?stt`/`?sttLabel` (P35). Nombres simples deliberados — evitan quirks del label service.
- P122 con `GROUP_CONCAT` en sub-SELECT para agregar todos los valores (China tiene 7; LIMIT 1 sobre wdt:P122 es no determinista).
- Label service con `"es,en,de,fr,mul"` — el fallback de,fr,mul necesario para líderes recientes sin label es/en (ej. Delcy Rodríguez, Q15081116).
- Partido (P102) con `p:P102 / ps:P102 + FILTER NOT EXISTS pq:P582` — **nunca `wdt:P102`**, que devuelve todos los partidos históricos sin filtrar.

## Lecciones aprendidas (no repetir)

- **Colores de partido**: cuando una plantilla de Wikipedia (como `{{Color político}}`) tiene un mapping curado nombre→hex, ir a la plantilla directamente es más simple, más rápido y más fiable que reconstruir el mapping vía Wikidata P465. La plantilla es la fuente de verdad que el propio Wikipedia usa al renderizar.

- **Render progresivo + cache = UX correcta**: primer click muestra grises en <1s, colores reales aparecen en background. Segundo click es instantáneo. No intentar precargar todo antes del primer render.

- **Nombres de partidos en el chart**: usar el **TEXTO MOSTRADO** del wikilink del infobox (`[[Destino|Texto]]` → "Texto"), no el destino ni el label de Wikidata. Razón: el destino apunta a veces al grupo parlamentario en vez del partido (España partido2 = `[[Grupo Parlamentario Socialista|PSOE]]` → Wikidata devolvería "Grupo Parlamentario Socialista"). Wikidata P1813 (nombre corto) tiene cobertura ~17% en los casos probados. El display text es lo que el editor de Wikipedia eligió como más reconocible en el contexto del infobox. **Limitación aceptada:** para coaliciones electorales bajo siglas crípticas (Argentina "PL" por La Libertad Avanza), el atlas no puede resolverlo automáticamente — es un problema de datos en Wikipedia, no de nuestra arquitectura.

- **Sub-elecciones vs. grupos de elecciones en Wikidata**: España 2023 tiene un item padre Q84082018 (el grupo completo) y subitems como Q119494968 (solo el Congreso). Ambos cumplen P1001=Q29 y P585=2023. La query SPARQL con LIMIT 1 puede devolver el subitem (que no tiene sitelinks de Wikipedia). Fix: `LIMIT 5` en el subSELECT + `FILTER(BOUND(?esSlug) || BOUND(?enSlug))` en la query exterior para exigir que el item devuelto tenga al menos un artículo en Wikipedia.

- **Porcentajes en infoboxes de Wikipedia**: escala 0-100 siempre. Nunca multiplicar por 100 cuando el valor es ≤ 1. Los partidos regionales con < 1% de voto nacional tienen valores como "0.73" que representan 0,73%, no 73%.

- **Wikidata es inconsistente en granularidad**: un item presidencial específico puede carecer de sitelinks aunque el item general padre los tenga. Patrón general: cuando un item no tiene lo esperado, intentar resolver vía relaciones (P361) antes de abandonar. No asumir que la granularidad del item es siempre la correcta.

- **Tests de script (node) no reemplazan la validación visual**: un script puede mostrar el slug correcto y el parser extraer datos válidos, pero la UI puede fallar por un bug distinto. Validación final SIEMPRE en navegador con hard refresh (`Ctrl+Shift+R`), no solo `console.log` del hook.

- **"Datos no disponibles" > datos cruzados**: mostrar un fallback editorial es mejor que mostrar resultados incorrectos procedentes de módulos mezclados. Esta es una decisión editorial explícita del proyecto — no flexibilizarla para "llenar" el chart.

- **Cambios silenciosos en actualizaciones de librerías**: son la regresión más difícil de detectar. Cuando algo "no parece funcionar igual que antes", revisar changelogs de dependencias mayores antes de buscar el bug en el propio código. Caso: Recharts v3 cambió `interval` default de YAxis de `0` a `'preserveEnd'` sin aviso prominente.

- **Patrones de plantilla Wikipedia estandarizados entre países hispanohablantes**: una vez identificado el patrón en un país (ej. campos `2v` para doble vuelta en Francia/Brasil/Argentina), funciona sin cambios para todos los demás. No inventar variantes: si el patrón no aparece, no hay segunda vuelta.

- **Wikidata con múltiples items por elección (India, Japón)**: países con elecciones escalonadas (senado parcial + cámara baja en años distintos) pueden tener un sub-item sin sitelinks que gana el ORDER BY por fecha más reciente. Fix: `ORDER BY DESC(BOUND(?esSlug)) DESC(?date)` en la query exterior — prioriza el item que tiene artículo en Wikipedia antes de resolver por recencia. El inner subSELECT sigue usando `DESC(?date)` para traer los 5 más recientes; el outer ordena por disponibilidad de sitelink.

- **Infoboxes de Wikipedia con campos inline en la misma línea**: algunos editores empaquetan múltiples pares `|clave=valor` en una sola línea (ej. India 2024: `|partido1=[[BJP]] |líder1=[[Narendra Modi]]`). Un parser que divide solo por `\n` lee todo lo que sigue al primer `=` como valor del primer campo, produciendo etiquetas con "ruido" y colores sin resolver. Fix: `splitInlineFields` con depth-tracking de `[[...]]` y `{{...}}` para detectar separadores `space-pipe` reales fuera de wikilinks.

- **Líder del partido en legislativas enriquece sin contaminar**: en sistemas parlamentarios, mostrar el líder del partido en el tooltip del chart aporta contexto sin cambiar la representación visual (el eje Y sigue mostrando solo el nombre del partido). Clave: distinguir el propósito del campo `candidate` según `electionType` — en presidenciales es el nombre en el eje; en legislativas es información suplementaria solo en tooltip.

- **React 19 + librerías legacy**: usar `npm install --legacy-peer-deps` cuando aparezca `ERESOLVE`. react-simple-maps necesita `prop-types` instalado manualmente.
- **Wikidata SPARQL sin User-Agent** → devuelve 403. Siempre incluir `User-Agent: AtlasPolitico/1.0`.
- **`wdt:Pxxx` (truthy shortcut)** devuelve TODOS los valores de una property sin filtrar por fecha. Para valores vigentes (cargo actual, partido actual) usar `p:Pxxx / ps:Pxxx + FILTER NOT EXISTS { ?stmt pq:P582 ?end }`.
- **LIMIT 1 con P122 multi-valued** es no determinista. Solución: sub-SELECT con GROUP_CONCAT.
- **Label service**: ampliar idiomas a `"es,en,de,fr,mul"` cuando un líder reciente aparezca con QID en lugar de nombre — probablemente tiene label en otro idioma pero no en es/en.
- **Milei (Argentina)**: Wikidata tiene P102 = "Partido Libertario" (nombre formal del partido). "La Libertad Avanza" es la coalición electoral, entidad distinta. No crear override local de partidos — mostrar lo que Wikidata tiene.
- **Venezuela**: Delcy Rodríguez (Q15081116) es presidenta encargada desde el 5 enero 2026. Wikidata la tiene correctamente como P35 activo, sin label es/en (solo de/fr/mul). Solución: ampliar idiomas del label service.

## Deuda técnica aceptada

1. **Alias de color heredados (`--ink-soft`, `--mute`)**: Definidos en `index.css` por compatibilidad con componentes existentes. `--ink-soft: #4A4A4A` y `--mute: #8A8278` no forman parte del sistema de diseño actual (que usa `--ink-2` a `--ink-4`). Conviven sin regresión visible — se acepta como deuda menor. Candidatos a migrar si se hace una sesión de limpieza de tokens.

2. **Polígonos sin numericId en el mapa (Kosovo Norte, Somaliland, etc.)**: Algunas entidades en el TopoJSON de world-atlas no tienen un numeric ID ISO 3166-1 reconocido. Al hacer click, `getCountryByNumericId` devuelve `null` y el panel no se abre — el click no hace nada. Comportamiento aceptado: estas entidades tienen estatus político ambiguo y no hay un QID de Wikidata claro que mappear.

## Convenciones del código

- TypeScript estricto. Importaciones de JSON con `resolveJsonModule: true` en `tsconfig.app.json`.
- Sin localStorage ni sessionStorage. Cache de queries en `Map<string, SparqlResponse>` en memoria (se resetea al recargar).
- Estilos: objetos de estilo inline con `const S = { ... }`. No clases Tailwind en componentes del panel — Tailwind reservado para layout global.
- Tipos centrales en `src/types/atlas.ts`: `CountryMeta`, `Leader`, `Party`, `CountryData`, `ElectionParty`, `ElectionData`, `ElectionFallback`, `ElectionTypeToShow`.

## Reglas para futuras sesiones

- **Antes de retomar tras límite de cupo**: leer CLAUDE.md primero para reconstruir contexto sin preguntar a Javier qué se hizo.
- **Antes de cerrar cualquier paso**: validación visual del usuario en navegador con hard refresh, no solo `console.log` del hook o resultado de script.
- **Antes de cerrar cualquier paso**: actualizar CLAUDE.md con estado, decisiones arquitectónicas y lecciones aprendidas.

## Lo que NO hacer

- NO Mercator. NO gradientes morados. NO glassmorphism. NO spinners circulares.
- NO inventar datos electorales ni de partidos para rellenar huecos.
- NO expandir `src/data/heads-of-state-override.json` sin diagnóstico previo con Javier.
- NO usar `wdt:P102` directo para partido actual.
- NO texto centrado en el panel lateral.
- NO añadir banderas como elemento dominante.
