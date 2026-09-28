# Transcripciones manuales de publicaciones oficiales

Coloca aquí ficheros `.csv` con cifras **copiadas de una publicación oficial** que no
ofrece un endpoint estructurado (p. ej. el informe trimestral del CGPJ
"Efecto de la crisis en los órganos judiciales", tablas por TSJ y provincia).

Formato (cabecera obligatoria, UTF-8, separador coma). Las líneas que empiezan por `#` se ignoran:

```
dataset_id,dataset_title,source_name,source_url,retrieved_at,period,territory_code,metric,procedure_type,value
cgpj-efecto-crisis,"Lanzamientos practicados (informe Efecto de la crisis)","CGPJ · Efecto de la crisis en los órganos judiciales",https://www.poderjudicial.es/...,2026-09-28,2025-Q4,PR-03,lanzamientos_practicados,arrendamientos_urbanos,123
```

- `territory_code`: `ES`, `CA-XX`, `PR-XX` (INE) o `TSJ-XX` (TSJ con sede en la CCAA XX).
- `metric`: `lanzamientos_practicados`, `lanzamientos_suspendidos`, `lanzamientos_recibidos`, `ejecuciones_hipotecarias_ingresadas`.
- `procedure_type`: `total`, `ejecucion_hipotecaria`, `arrendamientos_urbanos`, `otros`.

Después: `npm run ingest:manual`. Cualquier fila inválida detiene la importación.
Un segundo par de ojos debe revisar la transcripción en el pull request.
