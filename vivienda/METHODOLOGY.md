# Metodología

El texto público está en [`/metodologia`](src/app/metodologia/page.tsx). Aquí va el resumen técnico para quien mantiene el proyecto.

## Tres tipos de información que nunca se mezclan

| Tipo | Dónde vive | Cómo se representa | Etiqueta |
|---|---|---|---|
| Estadística oficial agregada | `statistics`, `datasets` | Choropleth, gráficos, indicadores | Fuente + periodo + nota metodológica |
| Información de organizaciones | `events` con `verification_status = fuente_oficial \| verificada`, `organizations` | Punto (solo si hay convocatoria), ficha | ▣ Fuente oficial del colectivo · ■ Verificada |
| Avisos sin verificar | `events` con `pendiente`; `submissions` (nunca públicos) | Punto con precisión máxima de barrio y marcador hueco | □ Pendiente de verificación |

## Lanzamiento

Diligencia judicial de desalojo, la unidad de la estadística del CGPJ. No es una persona ni un hogar, y no incluye salidas previas al señalamiento. Se desglosa en LAU (arrendamientos urbanos), ejecución hipotecaria y otros.

- **Periodos:** año `AAAA` o trimestre `AAAA-QN`. La variación interanual compara siempre el mismo periodo del año anterior.
- **Tasa:** lanzamientos ÷ población a 1 de enero del mismo año (INE) × 100.000. Si no hay población de ese año, no se calcula.
- **Totales derivados:** solo con todas las piezas, marcados como calculados y contrastados con los publicados.
- **TSJ:** el de Andalucía incluye Ceuta y Melilla. Si solo hay datos por TSJ, la CCAA muestra el dato del TSJ con una nota.
- **Escalas:** clases por quintiles. En `/memoria` la escala es fija para toda la serie.

## Convocatoria

Evento público y concreto difundido expresamente por una organización. Estados del evento: `programada`, `cancelada`, `suspendida` o `realizada` (esta última se infiere si la fecha ya pasó). Estados de verificación: `verificada`, `fuente_oficial` o `pendiente`.

## Precisión geográfica (`src/lib/privacy.ts`)

| Situación | Precisión máxima publicada |
|---|---|
| Programada, fuente oficial o verificada | La que publicó la organización (hasta `exacta`, el punto público de encuentro) |
| Programada, pendiente de verificación | `barrio` |
| Realizada, cancelada o suspendida | `barrio`; sin centroide de barrio, `municipio` |

Además, `npm run privacy:degrade` (diario) reescribe en la BD el punto de las convocatorias terminadas.

## Calidad

- Cualquier fila inválida en los datos manuales detiene la importación.
- Los avisos de normalización se guardan en `report.json` de cada snapshot y se revisan en el PR automático.
- Las correcciones se hacen en git, con el motivo en el mensaje del commit.
