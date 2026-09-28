/** Aplica migrations/*.sql en orden, una sola vez cada una. Uso: DATABASE_URL=… npm run db:migrate */
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definido");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select version from schema_migrations`).map((r) => r.version as string));
  const dir = path.resolve(import.meta.dirname, "..", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const body = await readFile(path.join(dir, f), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (version) values (${f})`;
    });
    console.log(`aplicada ${f}`);
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
