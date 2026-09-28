-- Mapa por la Vivienda — esquema inicial.
-- PostgreSQL ≥ 14 (compatible con Supabase). Sin extensiones obligatorias.
-- Principio: solo eventos públicos, organizaciones y estadísticas agregadas.
-- No existe ninguna tabla ni columna para datos de personas afectadas.

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

-- Procedencia de cualquier dato publicado ---------------------------------------
create table sources (
  id            text primary key,
  name          text not null check (length(name) between 2 and 200),
  url           text not null check (url ~* '^https?://'),
  type          text not null check (type in ('web_organizacion','red_social_publica','boletin_oficial','prensa','dataset_oficial','envio_ciudadano','otro')),
  retrieved_at  timestamptz not null,
  published_at  timestamptz,
  notes         text
);

-- Territorios de referencia (INE) -------------------------------------------------
create table territories (
  id        text primary key,            -- ES | CA-XX | PR-XX
  type      text not null check (type in ('country','ccaa','province')),
  ine       text not null,
  name      text not null,
  short_name text not null,
  slug      text not null unique,
  parent_id text references territories(id),
  tsj       text,
  timezone  text not null
);

-- Organizaciones ---------------------------------------------------------------
create table organizations (
  id               text primary key,
  slug             text not null unique,
  name             text not null,
  description      text not null default '',
  type             text not null check (type in ('sindicato_vivienda','pah','asociacion_vecinal','plataforma','colectivo','asesoria','otros')),
  territory_id     text not null references territories(id),
  municipality_name text,
  scope            text not null check (scope in ('barrio','municipal','comarcal','provincial','autonomico','estatal')),
  website          text check (website is null or website ~* '^https?://'),
  social_links     jsonb not null default '[]'::jsonb,
  public_contact   text,
  latitude         double precision,
  longitude        double precision,
  source_id        text not null references sources(id),
  verified         boolean not null default false,
  demo             boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index organizations_territory_idx on organizations (territory_id);

-- Ubicaciones (públicas) ---------------------------------------------------------
create table locations (
  id                     text primary key,
  municipality_code      text check (municipality_code is null or municipality_code ~ '^\d{5}$'),
  municipality_name      text,
  province_id            text not null references territories(id),
  neighborhood           text,
  public_meeting_point   text,
  latitude               double precision not null check (latitude between 27 and 44.5),
  longitude              double precision not null check (longitude between -18.5 and 4.6),
  precision              text not null check (precision in ('exacta','via','barrio','municipio')),
  neighborhood_latitude  double precision,
  neighborhood_longitude double precision
);

-- Convocatorias ------------------------------------------------------------------
create table events (
  id                  text primary key,
  slug                text not null unique,
  type                text not null check (type in ('desahucio','concentracion','manifestacion','asamblea','asesoria','accion','charla','otro')),
  title               text not null,
  description         text not null default '',
  date                date not null,
  time                time,
  end_time            time,
  timezone            text not null check (timezone in ('Europe/Madrid','Atlantic/Canary')),
  status              text not null check (status in ('programada','cancelada','suspendida','realizada')),
  organization_id     text references organizations(id) on delete set null,
  organizer_name      text not null,
  location_id         text not null references locations(id),
  -- Columnas desnormalizadas para consultas espaciales rápidas; se actualizan al degradar precisión.
  latitude            double precision not null,
  longitude           double precision not null,
  precision           text not null check (precision in ('exacta','via','barrio','municipio')),
  source_id           text not null references sources(id),
  verification_status text not null check (verification_status in ('verificada','fuente_oficial','pendiente')),
  submitted_at        timestamptz,
  verified_at         timestamptz,
  last_checked_at     timestamptz not null,
  demo                boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index events_date_idx on events (date);
create index events_org_idx on events (organization_id);
create index events_geo_idx on events (latitude, longitude);

-- Estadísticas agregadas ---------------------------------------------------------
create table datasets (
  id                 text primary key,
  source_id          text not null references sources(id),
  title              text not null,
  url                text not null,
  methodology        text not null,
  limitations        jsonb not null default '[]'::jsonb,
  territorial_levels jsonb not null default '[]'::jsonb,
  period_types       jsonb not null default '[]'::jsonb,
  first_period       text,
  last_period        text,
  source_updated_at  timestamptz,
  retrieved_at       timestamptz,
  demo               boolean not null default false
);

create table statistics (
  id              text primary key,
  period          text not null check (period ~ '^\d{4}(-Q[1-4])?$'),
  period_type     text not null check (period_type in ('year','quarter')),
  territory_type  text not null check (territory_type in ('country','ccaa','province','tsj')),
  territory_code  text not null,
  metric          text not null,
  procedure_type  text not null check (procedure_type in ('total','ejecucion_hipotecaria','arrendamientos_urbanos','otros')),
  value           double precision not null check (value >= 0),
  derivation      text not null default 'reported' check (derivation in ('reported','derived')),
  source_id       text not null references sources(id),
  dataset_id      text not null references datasets(id),
  snapshot_id     text not null,
  retrieved_at    timestamptz not null,
  demo            boolean not null default false
);
create index statistics_lookup_idx on statistics (metric, dataset_id, territory_type, period);
create index statistics_territory_idx on statistics (territory_code);

-- Envíos ciudadanos --------------------------------------------------------------
create table submissions (
  id             text primary key,
  status         text not null check (status in ('submitted','pending_review','verified','published','rejected')),
  payload        jsonb not null,
  privacy_flags  jsonb not null default '[]'::jsonb,
  client_hash    text not null,           -- HMAC diario de la IP; la IP nunca se guarda
  event_id       text references events(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index submissions_status_idx on submissions (status, created_at);
create index submissions_client_idx on submissions (client_hash, created_at);

-- Solicitudes de corrección o retirada ------------------------------------------
create table reports (
  id           text primary key,
  target_type  text not null check (target_type in ('event','organization','statistic','other')),
  target_id    text,
  reason       text not null,
  message      text not null,
  contact      text,                      -- opcional, lo aporta quien reporta, se borra al cerrar
  status       text not null default 'open' check (status in ('open','resolved','dismissed')),
  client_hash  text not null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- Registro de moderación (inmutable) ---------------------------------------------
create table moderation_log (
  id           bigserial primary key,
  target_type  text not null,
  target_id    text not null,
  action       text not null,
  from_status  text,
  to_status    text,
  note         text,
  moderator    text not null,
  created_at   timestamptz not null default now()
);
create index moderation_log_target_idx on moderation_log (target_type, target_id);

create or replace function forbid_update() returns trigger language plpgsql as $$
begin
  raise exception 'moderation_log es de solo inserción';
end $$;
create trigger moderation_log_immutable before update or delete on moderation_log
  for each row execute function forbid_update();
