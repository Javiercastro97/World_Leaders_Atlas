# Seguridad

## Informar de una vulnerabilidad

**No abras un issue público.** Usa el aviso privado de vulnerabilidades de GitHub (*Security → Report a vulnerability*) en el repositorio. Indica los pasos para reproducirla y su impacto. Responderemos en 72 h como máximo.

Tienen prioridad máxima:

1. Cualquier forma de obtener datos de personas o la ubicación exacta de convocatorias ya degradadas.
2. Saltarse la moderación: publicar sin pasar por `verified`.
3. Acceso a `/moderacion` o `/api/moderation/*` sin token.
4. Inyección (SQL, XSS, en JSON-LD o iCal) o posibilidad de alterar `moderation_log`.

## Alcance y medidas existentes

Resumidas en [PRIVACY.md](PRIVACY.md) (sección Seguridad). Las dependencias se mantienen al mínimo: en ejecución solo `next`, `react`, `maplibre-gl`, `zod` y `postgres`.

## Secretos

`MODERATION_TOKEN` y `SUBMISSION_SECRET` deben ser largos y aleatorios, por ejemplo `openssl rand -base64 32`. Renuévalos si una persona deja de moderar.
