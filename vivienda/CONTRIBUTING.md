# Contribuir

Gracias por querer mejorar esta herramienta. Hay tres formas principales de ayudar.

## 1. Organizaciones: añadir o corregir vuestra ficha o convocatorias

Abre un pull request con un fichero en `data/curated/organizations/<slug>.json` o `data/curated/events/<slug>.json`. El formato está en [`data/curated/README.md`](data/curated/README.md). Incluid solo información **que ya sea pública** en vuestros canales y, en `source`, el enlace de donde sale. El slug no puede coincidir con el de una provincia o CCAA.

Si no usáis git, podéis enviar la convocatoria desde **Avisa de una convocatoria** o pedir cambios en **Reportar información**.

## 2. Datos

- Transcripciones de informes oficiales: `data/manual/*.csv`. Cada PR necesita **dos revisiones** y el enlace al informe.
- Nuevos proveedores: sigue «Cómo añadir un proveedor de datos» en [DATA_SOURCES.md](DATA_SOURCES.md).
- Nunca subas cifras sin fuente ni fixtures inventados fuera de `tests/` o `src/server/demo.ts`. Estos últimos van marcados con `[DEMO]` o `[PRUEBA]`.

## 3. Código

```bash
cd vivienda && npm install
npm run typecheck && npm run lint && npm test
npm run test:e2e
```

- TypeScript estricto. Valida con Zod en los bordes (API, ficheros, formularios).
- La lógica de dominio va en `src/lib` (pura, con tests); la E/S, en `src/server` y `src/data-sources`.
- Interfaz: cumple WCAG AA. No transmitas nada solo con el color (usa texto y forma), añade una tabla o listado equivalente a cada mapa o gráfico y asegúrate de que todo funciona con teclado.
- Estética: papel, negro, rojo señal y gris cartográfico. Nada de degradados morados, glassmorphism, sombras grandes, iconos decorativos ni cifras sin contexto temporal.
- Rojo = convocatorias y acción; grises = estadística.
- Revisa la lista de privacidad de [PRIVACY.md](PRIVACY.md) antes de abrir el PR.

Commits pequeños con mensaje descriptivo. Los PR que tocan datos o privacidad deben explicar el porqué.
