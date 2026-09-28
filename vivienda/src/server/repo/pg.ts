/** Repositorio PostgreSQL (Supabase o cualquier Postgres ≥ 14). */
import postgres from "postgres";
import type { Dataset, HousingEvent, Organization, Source, Statistic, Submission } from "@/lib/schema";
import { demoEnabled } from "../demo";
import { filterEvents } from "./filters";
import type { EventFilter, ModerationLogEntry, OrganizationFilter, Repo, StatisticFilter, StoredReport } from "./types";
import { getTerritory, PROVINCES } from "@/lib/territories";

type Sql = ReturnType<typeof postgres>;

let shared: Sql | null = null;
export function sqlClient(url = process.env.DATABASE_URL!): Sql {
  shared ??= postgres(url, {
    max: Number(process.env.DATABASE_POOL ?? 5),
    idle_timeout: 20,
    prepare: false, // compatible con el pooler de Supabase (pgBouncer en modo transacción)
    types: { bigint: postgres.BigInt },
  });
  return shared;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const hm = (v: unknown) => (v == null ? null : String(v).slice(0, 5));

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToEvent(r: any): HousingEvent {
  return {
    id: r.id,
    slug: r.slug,
    type: r.type,
    title: r.title,
    description: r.description,
    date: r.date_s,
    time: hm(r.time),
    end_time: hm(r.end_time),
    timezone: r.timezone,
    status: r.status,
    organization_id: r.organization_id,
    organizer_name: r.organizer_name,
    location: {
      id: r.location_id,
      municipality_code: r.municipality_code,
      municipality_name: r.municipality_name,
      province_id: r.province_id,
      neighborhood: r.neighborhood,
      public_meeting_point: r.public_meeting_point,
      latitude: r.l_latitude,
      longitude: r.l_longitude,
      precision: r.l_precision,
      neighborhood_latitude: r.neighborhood_latitude,
      neighborhood_longitude: r.neighborhood_longitude,
    },
    source_id: r.source_id,
    verification_status: r.verification_status,
    submitted_at: iso(r.submitted_at),
    verified_at: iso(r.verified_at),
    last_checked_at: iso(r.last_checked_at)!,
    demo: r.demo,
    created_at: iso(r.created_at)!,
    updated_at: iso(r.updated_at)!,
  };
}

function rowToOrg(r: any): Organization {
  return { ...r, created_at: iso(r.created_at)!, updated_at: iso(r.updated_at)! };
}

function rowToSource(r: any): Source {
  return { ...r, retrieved_at: iso(r.retrieved_at)!, published_at: iso(r.published_at) };
}

function rowToSubmission(r: any): Submission {
  return { ...r, created_at: iso(r.created_at)!, updated_at: iso(r.updated_at)! };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export class PgRepo implements Repo {
  readonly kind = "postgres" as const;
  readonly writable = true;
  constructor(private sql: Sql = sqlClient()) {}

  async listEvents(f: EventFilter = {}) {
    const sql = this.sql;
    const provinces = f.territory?.startsWith("CA-")
      ? PROVINCES.filter((p) => p.parent === f.territory).map((p) => p.id)
      : f.territory?.startsWith("PR-")
        ? [f.territory]
        : null;
    const rows = await sql`
      select e.*, to_char(e.date, 'YYYY-MM-DD') as date_s,
             l.municipality_code, l.municipality_name, l.province_id, l.neighborhood, l.public_meeting_point,
             l.latitude as l_latitude, l.longitude as l_longitude, l.precision as l_precision,
             l.neighborhood_latitude, l.neighborhood_longitude
      from events e join locations l on l.id = e.location_id
      where true
        ${provinces ? sql`and l.province_id in ${sql(provinces)}` : sql``}
        ${f.from ? sql`and e.date >= ${f.from}` : sql``}
        ${f.to ? sql`and e.date <= ${f.to}` : sql``}
        ${f.types?.length ? sql`and e.type in ${sql(f.types)}` : sql``}
        ${f.organizationId ? sql`and e.organization_id = ${f.organizationId}` : sql``}
        ${demoEnabled() ? sql`` : sql`and e.demo = false`}
      order by e.date, e.time nulls first
      limit 2000`;
    // municipio: comparación insensible a acentos en JS (evita depender de la extensión unaccent)
    return filterEvents(rows.map(rowToEvent), { municipality: f.municipality, includeDemo: true });
  }

  async getEvent(slug: string) {
    return (await this.byWhere(this.sql`e.slug = ${slug}`))[0] ?? null;
  }
  async getEventById(id: string) {
    return (await this.byWhere(this.sql`e.id = ${id}`))[0] ?? null;
  }
  private async byWhere(where: ReturnType<Sql>) {
    const rows = await this.sql`
      select e.*, to_char(e.date, 'YYYY-MM-DD') as date_s,
             l.municipality_code, l.municipality_name, l.province_id, l.neighborhood, l.public_meeting_point,
             l.latitude as l_latitude, l.longitude as l_longitude, l.precision as l_precision,
             l.neighborhood_latitude, l.neighborhood_longitude
      from events e join locations l on l.id = e.location_id where ${where} limit 1`;
    return rows.map(rowToEvent);
  }

  async createEvent(e: HousingEvent, source: Source) {
    await this.sql.begin(async (tx) => {
      await tx`insert into sources ${tx(source)} on conflict (id) do nothing`;
      const l = e.location;
      await tx`insert into locations ${tx({ ...l })}`;
      await tx`insert into events ${tx({
        id: e.id,
        slug: e.slug,
        type: e.type,
        title: e.title,
        description: e.description,
        date: e.date,
        time: e.time,
        end_time: e.end_time,
        timezone: e.timezone,
        status: e.status,
        organization_id: e.organization_id,
        organizer_name: e.organizer_name,
        location_id: l.id,
        latitude: l.latitude,
        longitude: l.longitude,
        precision: l.precision,
        source_id: e.source_id,
        verification_status: e.verification_status,
        submitted_at: e.submitted_at,
        verified_at: e.verified_at,
        last_checked_at: e.last_checked_at,
        demo: e.demo,
        created_at: e.created_at,
        updated_at: e.updated_at,
      })}`;
    });
  }

  async updateEvent(id: string, patch: Partial<HousingEvent>) {
    const { location, ...rest } = patch;
    const cols = Object.fromEntries(
      Object.entries(rest).filter(([k]) => ["status", "verification_status", "verified_at", "last_checked_at", "title", "description", "time", "date"].includes(k)),
    );
    await this.sql.begin(async (tx) => {
      if (Object.keys(cols).length) await tx`update events set ${tx(cols)}, updated_at = now() where id = ${id}`;
      if (location) {
        const [ev] = await tx`select location_id from events where id = ${id}`;
        if (ev) {
          await tx`update locations set ${tx(location as Record<string, unknown>)} where id = ${ev.location_id}`;
          if (location.latitude != null)
            await tx`update events set latitude = ${location.latitude}, longitude = ${location.longitude ?? null}, precision = ${location.precision ?? "municipio"} where id = ${id}`;
        }
      }
    });
  }

  async deleteEvent(id: string) {
    await this.sql.begin(async (tx) => {
      const [ev] = await tx`delete from events where id = ${id} returning location_id`;
      if (ev) await tx`delete from locations where id = ${ev.location_id}`;
    });
  }

  async listOrganizations(f: OrganizationFilter = {}) {
    const sql = this.sql;
    const t = f.territory ? getTerritory(f.territory) : null;
    const territories = t?.type === "ccaa" ? [t.id, ...PROVINCES.filter((p) => p.parent === t.id).map((p) => p.id)] : t ? [t.id] : null;
    const rows = await sql`
      select * from organizations where true
      ${territories ? sql`and territory_id in ${sql(territories)}` : sql``}
      ${f.type ? sql`and type = ${f.type}` : sql``}
      ${f.q ? sql`and (name ilike ${"%" + f.q + "%"} or coalesce(municipality_name,'') ilike ${"%" + f.q + "%"})` : sql``}
      ${demoEnabled() ? sql`` : sql`and demo = false`}
      order by name`;
    return rows.map(rowToOrg);
  }
  async getOrganization(slug: string) {
    const [r] = await this.sql`select * from organizations where slug = ${slug}`;
    return r ? rowToOrg(r) : null;
  }

  async listSources() {
    return (await this.sql`select * from sources order by name`).map(rowToSource);
  }
  async getSource(id: string) {
    const [r] = await this.sql`select * from sources where id = ${id}`;
    return r ? rowToSource(r) : null;
  }

  async listDatasets() {
    const rows = await this.sql`select * from datasets ${demoEnabled() ? this.sql`` : this.sql`where demo = false`}`;
    return rows.map((r) => ({ ...r, source_updated_at: iso(r.source_updated_at), retrieved_at: iso(r.retrieved_at) }) as Dataset);
  }

  async listStatistics(f: StatisticFilter = {}) {
    const sql = this.sql;
    const rows = await sql`
      select * from statistics where true
      ${f.metric ? sql`and metric = ${f.metric}` : sql``}
      ${f.datasetIds ? sql`and dataset_id in ${sql(f.datasetIds.length ? f.datasetIds : ["__none__"])}` : sql``}
      ${f.territoryType ? sql`and territory_type = ${f.territoryType}` : sql``}
      ${f.territoryCode ? sql`and territory_code = ${f.territoryCode}` : sql``}
      ${f.periodType ? sql`and period_type = ${f.periodType}` : sql``}
      ${f.procedureType ? sql`and procedure_type = ${f.procedureType}` : sql``}
      ${demoEnabled() ? sql`` : sql`and demo = false`}`;
    return rows.map((r) => ({ ...r, retrieved_at: iso(r.retrieved_at) }) as Statistic);
  }

  async createSubmission(s: Submission) {
    await this.sql`insert into submissions ${this.sql({ ...s, payload: this.sql.json(s.payload), privacy_flags: this.sql.json(s.privacy_flags) } as Record<string, unknown>)}`;
  }
  async listSubmissions(status?: Submission["status"]) {
    const rows = await this.sql`select * from submissions ${status ? this.sql`where status = ${status}` : this.sql``} order by created_at desc limit 500`;
    return rows.map(rowToSubmission);
  }
  async getSubmission(id: string) {
    const [r] = await this.sql`select * from submissions where id = ${id}`;
    return r ? rowToSubmission(r) : null;
  }
  async updateSubmission(id: string, patch: Partial<Submission>) {
    const cols: Record<string, unknown> = { ...patch };
    delete cols.id;
    delete cols.updated_at; // lo fija la propia consulta
    if (patch.payload) cols.payload = this.sql.json(patch.payload);
    if (patch.privacy_flags) cols.privacy_flags = this.sql.json(patch.privacy_flags);
    await this.sql`update submissions set ${this.sql(cols)}, updated_at = now() where id = ${id}`;
  }
  async countSubmissionsSince(clientHash: string, sinceIso: string) {
    const [r] = await this.sql`select count(*)::int as n from submissions where client_hash = ${clientHash} and created_at >= ${sinceIso}`;
    return r.n as number;
  }

  async createReport(r: StoredReport) {
    await this.sql`insert into reports ${this.sql(r as unknown as Record<string, unknown>)}`;
  }
  async listReports(status?: StoredReport["status"]) {
    const rows = await this.sql`select * from reports ${status ? this.sql`where status = ${status}` : this.sql``} order by created_at desc limit 500`;
    return rows.map((r) => ({ ...r, created_at: iso(r.created_at), resolved_at: iso(r.resolved_at) }) as StoredReport);
  }
  async updateReport(id: string, patch: Partial<StoredReport>) {
    const cols: Record<string, unknown> = { ...patch };
    delete cols.id;
    await this.sql`update reports set ${this.sql(cols)} where id = ${id}`;
  }

  async log(entry: ModerationLogEntry) {
    const { id: _ignored, ...e } = entry;
    void _ignored;
    await this.sql`insert into moderation_log ${this.sql(e as unknown as Record<string, unknown>)}`;
  }
  async listLog(targetId?: string) {
    const rows = await this.sql`select * from moderation_log ${targetId ? this.sql`where target_id = ${targetId}` : this.sql``} order by id desc limit 500`;
    return rows.map((r) => ({ ...r, id: Number(r.id), created_at: iso(r.created_at) }) as ModerationLogEntry);
  }
}
