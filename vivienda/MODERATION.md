# Guía de moderación

Acceso: `/moderacion` con `MODERATION_TOKEN`. La sesión dura 8 h y usa una cookie `httpOnly` con `SameSite=Strict`; además, las escrituras comprueban el origen. Cada acción queda en `moderation_log`, que es de solo inserción.

## Flujo

```
submitted ──Empezar revisión──▶ pending_review ──Marcar verificado──▶ verified ──Publicar──▶ published
    └───────────────────────────── Rechazar (con motivo) ──────────────────────────▶ rejected
```

Nada se publica automáticamente. Publicar solo es posible desde `verified`.

## Antes de pasar a «verificado»

1. Abre la **URL de la publicación original**. Debe ser pública (sin iniciar sesión) y de la organización convocante.
2. Comprueba que la fecha, la hora, el municipio y la organización coinciden.
3. Revisa los **avisos de privacidad**: teléfono, DNI o email retirados; posible domicilio; posible dato personal. Si el texto describe a una persona afectada, rechaza el aviso o publícalo sin esa parte (edita el título y deja la descripción genérica).
4. En «Cómo se verificó», anota qué comprobaste. Queda en el registro.

## Al publicar

- **Estado de verificación:**
  - `fuente_oficial`: la fuente es un canal oficial y público de la organización.
  - `verificada`: además, lo has confirmado con la organización o con dos fuentes independientes.
  - `pendiente`: hay indicios razonables pero no se ha podido contrastar. Se publica con aviso y **no admite ubicación exacta**.
- **Ubicación:**
  - Sin coordenadas, se publica en el centroide del municipio. Es la opción por defecto y la más segura.
  - Indica coordenadas y precisión `exacta` **solo** si la organización difundió ese lugar como punto público de concentración.
  - Nunca publiques un domicilio que la organización no haya hecho público.
- **Fuente:** tipo y nombre (p. ej. «Perfil público de X en Mastodon»).

## Después

- Si la convocatoria se cancela, se suspende o cambia, actualiza su estado en «Convocatorias publicadas».
- **Retirar:** ante una solicitud por datos personales o de seguridad, retira primero y revisa después. El motivo queda en el registro.
- **Reportes:** resuélvelos o descártalos con una nota. El contacto de quien reportó se borra al cerrar el reporte.

## Lo que no se publica

Rumores, casos individuales que la organización no ha hecho públicos, convocatorias difundidas solo en grupos privados, datos de personas afectadas, documentos judiciales y contenido que señale a particulares.
