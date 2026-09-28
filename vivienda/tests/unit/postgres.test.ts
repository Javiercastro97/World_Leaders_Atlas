/**
 * Integración con PostgreSQL. Se ejecuta solo si TEST_DATABASE_URL apunta a una base de datos
 * desechable (se borra y recrea el esquema). En CI se levanta un servicio postgres.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { readFile } from "node:fs/promises";
import path from "node:path";

const URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!URL)("PgRepo", () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(async () => {
    sql = postgres(URL!, { max: 1, onnotice: () => {} });
    await sql.unsafe("drop schema public cascade; create schema public;");
    await sql.unsafe(await readFile(path.resolve("migrations/001_init.sql"), "utf8"));
    await sql`insert into territories (id,type,ine,name,short_name,slug,parent_id,tsj,timezone) values ('ES','country','00','España','España','espana',null,null,'Europe/Madrid')`;
    await sql`insert into territories (id,type,ine,name,short_name,slug,parent_id,tsj,timezone) values ('CA-10','ccaa','10','CV','CV','comunitat-valenciana','ES','10','Europe/Madrid'), ('PR-03','province','03','Alicante','Alicante','alicante','CA-10','10','Europe/Madrid')`;
  });
  afterAll(async () => sql?.end());

  it("publica un envío y degrada, lista y borra el evento", async () => {
    const { PgRepo } = await import("@/server/repo/pg");
    const repo = new PgRepo(sql);
    const now = new Date().toISOString();
    await repo.createSubmission({
      id: "s1", status: "verified", privacy_flags: [], client_hash: "h", event_id: null, created_at: now, updated_at: now,
      payload: { type: "asamblea", date: "2030-01-01", time: "19:00", municipality: "Elche", province_id: "PR-03", organization: "X", source_url: "https://example.org", description: "desc", meeting_point: null, comments: null },
    });
    expect(await repo.countSubmissionsSince("h", "2000-01-01")).toBe(1);
    await repo.updateSubmission("s1", { status: "published", updated_at: now });
    expect((await repo.getSubmission("s1"))?.status).toBe("published");
    const src = { id: "src1", name: "Colectivo X", url: "https://example.org", type: "web_organizacion" as const, retrieved_at: now, published_at: null, notes: null };
    await repo.createEvent(
      {
        id: "e1", slug: "e1", type: "asamblea", title: "Asamblea", description: "", date: "2030-01-01", time: "19:00", end_time: null, timezone: "Europe/Madrid",
        status: "programada", organization_id: null, organizer_name: "X", source_id: "src1", verification_status: "verificada", submitted_at: now, verified_at: now,
        last_checked_at: now, demo: false, created_at: now, updated_at: now,
        location: { id: "l1", municipality_code: "03065", municipality_name: "Elche", province_id: "PR-03", neighborhood: null, public_meeting_point: "Plaza", latitude: 38.26, longitude: -0.7, precision: "exacta", neighborhood_latitude: null, neighborhood_longitude: null },
      },
      src,
    );
    const list = await repo.listEvents({ territory: "CA-10" });
    expect(list[0]).toMatchObject({ slug: "e1", date: "2030-01-01", time: "19:00" });
    await repo.updateEvent("e1", { status: "cancelada" });
    expect((await repo.getEvent("e1"))?.status).toBe("cancelada");
    await repo.log({ target_type: "event", target_id: "e1", action: "status", from_status: "programada", to_status: "cancelada", note: null, moderator: "t", created_at: now });
    await expect(sql`update moderation_log set note = 'x'`).rejects.toThrow(/solo inserción/);
    await repo.deleteEvent("e1");
    expect(await repo.getEvent("e1")).toBeNull();
  });
});
