# Datos curados (vía pull request)

Solo información **pública** de las propias organizaciones. Cada fichero se valida con el esquema de `src/lib/schema.ts`. Si un fichero no es válido, se ignora y se avisa (y `db:sync` falla).

## `organizations/<slug>.json`

```json
{
  "slug": "sindicato-vivienda-ejemplo",
  "name": "Sindicato de Vivienda de Ejemplo",
  "description": "Qué hace la organización, con sus palabras.",
  "type": "sindicato_vivienda",
  "territory_id": "PR-28",
  "municipality_name": "Madrid",
  "scope": "municipal",
  "website": "https://…",
  "social_links": [{ "network": "Mastodon", "url": "https://…" }],
  "public_contact": "correo público de la organización",
  "latitude": 40.41,
  "longitude": -3.70,
  "verified": false,
  "updated_at": "2026-09-28T00:00:00Z",
  "source": { "name": "Web oficial", "url": "https://…", "type": "web_organizacion", "retrieved_at": "2026-09-28T00:00:00Z" }
}
```

- `type`: `sindicato_vivienda`, `pah`, `asociacion_vecinal`, `plataforma`, `colectivo`, `asesoria` u `otros`.
- `scope`: `barrio`, `municipal`, `comarcal`, `provincial`, `autonomico` o `estatal`.
- `latitude`/`longitude`: la sede pública o el centro de su ámbito. **Nunca un domicilio particular.**
- `verified`: `true` solo si moderación lo ha confirmado con la organización.

## `events/<slug>.json`

```json
{
  "slug": "asamblea-ejemplo-2026-10-01",
  "type": "asamblea",
  "title": "Asamblea abierta de vivienda",
  "description": "",
  "date": "2026-10-01",
  "time": "19:00",
  "end_time": null,
  "status": "programada",
  "organization_id": "sindicato-vivienda-ejemplo",
  "organizer_name": "Sindicato de Vivienda de Ejemplo",
  "verification_status": "fuente_oficial",
  "verified_at": null,
  "last_checked_at": "2026-09-28T00:00:00Z",
  "updated_at": "2026-09-28T00:00:00Z",
  "location": {
    "municipality_code": "28079",
    "municipality_name": "Madrid",
    "province_id": "PR-28",
    "neighborhood": "Lavapiés",
    "public_meeting_point": "Local público anunciado por la organización",
    "latitude": 40.408,
    "longitude": -3.701,
    "precision": "via",
    "neighborhood_latitude": null,
    "neighborhood_longitude": null
  },
  "source": { "name": "Web oficial", "url": "https://…", "type": "web_organizacion", "retrieved_at": "2026-09-28T00:00:00Z", "published_at": null }
}
```

La zona horaria se deduce de la provincia (Canarias → `Atlantic/Canary`). Tras la fecha, la precisión se reduce automáticamente.
