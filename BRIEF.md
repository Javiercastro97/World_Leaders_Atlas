# Atlas Político Mundial — Brief para Claude Code

## Contexto del proyecto

Construyo un atlas político mundial interactivo de calidad editorial. Referencia visual: piezas de datos del Financial Times, The Economist, NYT Interactive Graphics. Sobrio, tipográficamente cuidado, periodismo visual — no dashboard SaaS.

El usuario abre la web, ve un mapa mundi, hace clic en cualquier país y obtiene un panel con: foto del Jefe de Gobierno(o jefe de estado, en la practica el lider del pais), nombre y cargo, partido + logo, y gráfico de las últimas elecciones generales.

Cobertura: 193 estados ONU + estados con reconocimiento parcial (Taiwán, Kosovo, Palestina) + dependencias relevantes.

Requisito crítico: siempre actualizado ante cambios de gobierno → toda la data viva viene de Wikidata, nada hardcodeado.

## Stack ya instalado

El proyecto está montado con Vite + React + TypeScript. Faltan las librerías específicas:

- framer-motion (animaciones)
- react-simple-maps + d3-geo (mapa)
- recharts (gráficos)
- lucide-react (iconos)
- tailwindcss v4 con plugin de Vite

## Estrategia de datos — núcleo del proyecto

Endpoint: https://query.wikidata.org/sparql
Headers obligatorios: Accept: application/sparql-results+json y User-Agent: AtlasPolitico/1.0 (sin User-Agent, Wikidata devuelve 403).

Properties clave:
- P6: head of government
- P35: head of state (fallback)
- P102: member of political party
- P18: image (Commons)
- P154: logo image (partidos)
- P465: sRGB color hex (color de partido)
- P580/P582: start time / end time
- P39: position held

Para filtrar el cargo vigente: FILTER NOT EXISTS { ?statement pq:P582 ?endDate }

Mapeo ISO3 → Q-ID: pre-generar src/data/iso3-to-qid.json con una query a Wikidata sobre wd:Q6256 + wdt:P298. Son ~250 entradas, no cambian.

Elecciones — cascada:
1. Wikidata primero (items con wdt:P31/wdt:P279* wd:Q40231 ligados al país por wdt:P17, ordenados por P585 desc).
2. Wikipedia REST API como fallback.
3. Si no hay datos limpios, mostrar mensaje editorial: "Datos electorales no disponibles en formato estructurado. [Ver artículo en Wikipedia]". NUNCA inventar cifras.

Cliente SPARQL (lib/sparql.ts):
- Cache por hash de query en Map en memoria.
- AbortController para cancelar fetches al cambiar de país.
- Throttle suave (~5 req/s).

UX de frescura: cada panel cierra con "Datos de Wikidata · revisado [fecha] · [enlace al item]". No negociable.

## Diseño visual

Tipografía:
- Editorial / titulares: Fraunces (Google Fonts), 400/500/600.
- UI / cuerpo: Inter, 400/500/600.
- Numerales: font-variant-numeric: tabular-nums siempre.

Paleta — atmósfera "biblioteca cartográfica":
- --paper: #F5F1EA (fondo)
- --ink: #1A1A1A (tinta)
- --ink-soft: #4A4A4A
- --mute: #8A8278
- --map-base: #D9D2C5
- --map-hover: #C4B89E
- --rule: #E5DFD3
- --accent: #B8472E

NO usar rojo/azul/verde políticos en la UI. En el chart sí: P465 de cada partido cuando exista, fallback a paleta neutra de grises.

Layout desktop:
- Mapa a sangre, viewport completo.
- Search flotante arriba-izquierda, autocomplete.
- Click país → panel lateral derecho 420px desliza desde fuera. Mapa hace panTo al centroide.
- Esquina inferior izquierda: leyenda + toggle región.

Layout mobile:
- Mapa full-screen.
- Click → bottom sheet con drag handle, snap 40% / 90%.
- Pinch zoom funcional.

Proyección: geoEqualEarth de d3-geo. NO Mercator.

Estructura del panel:
- Bandera 24px + nombre país + forma gobierno · capital + botón cerrar.
- Foto 1:1 + "Jefe de Gobierno" (caps mute) + nombre (Fraunces 28px) + cargo (Inter 13px ink-soft) + "En el cargo desde [fecha]" (Inter 12px mute).
- "PARTIDO" (caps mute) + logo 32px + nombre (Fraunces 18px) + posición ideológica · fundación.
- "ÚLTIMAS ELECCIONES GENERALES · [año]" + bar chart horizontal stagger.
- Footer: "Fuente · Wikidata · revisado [fecha]" + enlaces.

## Animaciones — Framer Motion

Easing global: easeEditorial = [0.25, 0.1, 0.25, 1]

Mapa:
- Hover país: fill transition 180ms + cursor pointer + tooltip 120ms.
- Click: país a --ink (300ms), resto opacity 0.5 (400ms), pan al centroide 600ms.
- Wheel zoom suave, scale 1-6.

Panel:
- Entrada: x: 100% → 0%, opacity 0→1, spring { stiffness: 280, damping: 32 }.
- Salida: 280ms ease-out.
- Stagger interno 60ms: bandera → nombre → foto → partido → chart.

Foto: skeleton bg-stone-200/80, fade-in 400ms + scale 1.02→1.

Chart: barras 0→valor, stagger 80ms, hover tooltip con cifras absolutas + % + escaños.

Search: underline animado al focus, resultados stagger 40ms, teclado ↑↓↵ESC.

Respetar prefers-reduced-motion: animaciones a fades simples.

## Estructura de archivos a crear

src/
├── components/
│   ├── WorldMap.tsx
│   ├── CountryPanel.tsx
│   ├── HeadOfGovernmentCard.tsx
│   ├── PartyCard.tsx
│   ├── ElectionChart.tsx
│   ├── SearchBar.tsx
│   └── Legend.tsx
├── hooks/
│   ├── useWikidataCountry.ts
│   ├── useWikidataElection.ts
│   └── useMapInteraction.ts
├── lib/
│   ├── sparql.ts
│   ├── wikipedia.ts
│   └── countryMap.ts
├── data/
│   └── iso3-to-qid.json
├── types/
│   └── atlas.ts
└── App.tsx (reescribir el actual)

## Estados a manejar

- Loading: skeletons tipográficos, no spinners. Mapa con shimmer mientras carga TopoJSON.
- Error de red: mensaje sobrio + botón "Reintentar". No alerts.
- Datos faltantes: mostrar lo que sí hay, "Sin imagen disponible", "Partido no registrado". No placeholders rotos.
- Países en transición / gobierno disputado: si Wikidata tiene >1 claim sin P582, mostrar todos con etiqueta "reclamado por".

## Accesibilidad

- ARIA labels en cada path del mapa con nombre del país.
- Focus rings: ring-2 ring-stone-900 ring-offset-2.
- Contraste AAA en panel.
- Search + Enter como ruta de teclado a cualquier país.

## Lo que NO quiero

- Banderas como elemento dominante.
- Iconitos infantiles, gradientes morados, glassmorphism.
- Tooltips con sombras de 40px.
- Spinners circulares.
- Mercator.
- Texto centrado en el panel.
- Inventar datos cuando faltan en la fuente.

## Orden de trabajo (CRÍTICO — ejecutar en este orden)

1. Instalar dependencias + configurar Tailwind v4 + cargar Fuentes Google + definir CSS variables de la paleta.
2. WorldMap con TopoJSON world-atlas/countries-110m.json, proyección Equal Earth, hover y click funcionales (sin datos aún).
3. lib/sparql.ts aislado: función query(sparql, signal) con cache. Test manual con la query principal sobre España (Q29) — mostrar el resultado crudo en consola antes de meterlo en UI.
4. useWikidataCountry hook + CountryPanel con datos reales del jefe de gobierno y partido.
5. useWikidataElection con cascada Wikidata → Wikipedia → fallback editorial.
6. ElectionChart con recharts + colores de partido + animación stagger.
7. SearchBar con autocomplete sobre dataset ISO3.
8. Pulido: animaciones del panel, transiciones del mapa, mobile bottom sheet, accesibilidad.
9. Estados de error y datos faltantes.
10. Preparar para deploy (build limpio).

## Reglas de trabajo conmigo (importante)

- No sé programar. Explícame en lenguaje natural qué vas a hacer en cada paso ANTES de hacerlo.
- Trabaja paso a paso del orden de arriba. No saltes adelante. Termina un paso, pídeme que lo pruebe en el navegador, y solo cuando confirme seguimos al siguiente.
- Si una query SPARQL se complica, muéstrame primero la query y el resultado crudo antes de meterla en producción.
- Si Wikidata no tiene datos de elecciones para un país que pruebes, dímelo — no construyas un fallback inventado.
- Decisiones de diseño dudosas (tamaños, márgenes, spring vs tween): preguntame con dos opciones, no decidas solo.
- Cuando me pidas probar algo, dime exactamente qué comando ejecutar y qué debo ver.