# Privacidad (diseño técnico)

Esta herramienta de solidaridad **no debe convertirse en una base de datos de personas vulnerables**. El texto público está en `/privacidad`.

## Minimización

| Dato | Tratamiento |
|---|---|
| Personas afectadas (nombre, teléfono, familia, economía, documentos) | **No existe ningún campo para ellos.** Los textos libres pasan por `scrubPersonalData()`: se retiran teléfonos, DNI/NIE, IBAN y emails, y se marcan posibles domicilios o datos personales para revisión |
| IP | No se guarda. `clientHash = HMAC(SUBMISSION_SECRET, día + IP)` rota cada día y sirve solo para limitar la frecuencia |
| Ubicación del usuario | Solo tras pulsar «Usar mi ubicación» y leer para qué se usa. Se redondea a ~1 km en el navegador, la respuesta es `no-store` y el service worker no la cachea |
| Contacto de quien reporta | Opcional. Se borra (`contact = null`) al cerrar el reporte |
| Cookies | Solo `mod_session` (moderación). Sin analítica ni terceros |
| Punto exacto de convocatorias | Solo si es el punto público de encuentro publicado por la organización y la convocatoria está activa. Se degrada al vuelo (`publicLocation`) y en la BD (`privacy:degrade`) |

## Seguridad

- Cabeceras: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY` y `Permissions-Policy` (geolocalización solo desde nuestro propio origen).
- Anti-spam sin terceros: sello temporal firmado (entre 3 s y 2 h), campo trampa, límite de frecuencia en memoria y en BD.
- Moderación: token compartido comparado en tiempo constante, cookie HMAC y comprobación de origen en las escrituras.
- El JSON-LD se escapa (`<` → `<`).
- `moderation_log` no admite `UPDATE` ni `DELETE` (trigger).

## RGPD

- Base legal: interés legítimo para informar de convocatorias y organizaciones que ellas mismas hacen públicas.
- Derechos (acceso, rectificación, supresión, oposición y limitación): formulario `/reportar`. La supresión se aplica con «Retirar» en moderación.
- Conservación: los envíos rechazados pueden purgarse periódicamente, y el registro de moderación no guarda el contenido retirado.
- No se implementa, ni debe implementarse por defecto, ningún tratamiento de datos de personas afectadas. Cualquier excepción necesitaría una política específica y una evaluación de impacto previa.

## Lista de comprobación para cambios

- [ ] ¿Añade algún campo que pueda identificar a una persona afectada? → No debe.
- [ ] ¿Alguna ruta nueva devuelve ubicaciones? → Debe pasar por `toPublic()` / `publicLocation()`.
- [ ] ¿Alguna respuesta depende de la ubicación del usuario? → `no-store` y excluida del service worker.
- [ ] ¿Algún log nuevo? → No debe guardar IPs, coordenadas de usuarios ni textos de envíos.
