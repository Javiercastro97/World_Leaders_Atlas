/**
 * Degradación física de la precisión geográfica del histórico.
 *
 * La API ya degrada al vuelo (src/lib/privacy.ts), pero además borramos de la base de datos
 * el punto exacto de las convocatorias terminadas: lo que no se guarda no se puede filtrar.
 * Ejecutar a diario (cron / GitHub Actions). Uso: DATABASE_URL=… npm run privacy:degrade
 */
import postgres from "postgres";
import { isPast } from "../src/lib/dates";
import { municipioCentroid } from "../src/server/municipios";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definido");
  const sql = postgres(url, { max: 1 });
  const now = new Date();
  const rows = await sql`
    select e.id, to_char(e.date,'YYYY-MM-DD') as date, e.time, e.end_time, e.timezone, e.status,
           l.id as location_id, l.precision, l.municipality_code, l.latitude, l.longitude,
           l.neighborhood_latitude, l.neighborhood_longitude
    from events e join locations l on l.id = e.location_id
    where l.precision in ('exacta','via')`;
  let n = 0;
  for (const r of rows) {
    const ev = { date: r.date as string, time: r.time ? String(r.time).slice(0, 5) : null, end_time: r.end_time ? String(r.end_time).slice(0, 5) : null, timezone: r.timezone };
    if (r.status === "programada" && !isPast(ev, now)) continue;
    let lat: number, lon: number, precision: string;
    if (r.neighborhood_latitude != null) {
      [lat, lon, precision] = [r.neighborhood_latitude, r.neighborhood_longitude, "barrio"];
    } else {
      const c = r.municipality_code ? municipioCentroid(r.municipality_code) : null;
      [lat, lon, precision] = c ? [c.lat, c.lon, "municipio"] : [Math.round(r.latitude * 100) / 100, Math.round(r.longitude * 100) / 100, "municipio"];
    }
    await sql.begin(async (tx) => {
      await tx`update locations set latitude=${lat}, longitude=${lon}, precision=${precision}, public_meeting_point=null where id=${r.location_id}`;
      await tx`update events set latitude=${lat}, longitude=${lon}, precision=${precision}, updated_at=now() where id=${r.id}`;
      await tx`insert into moderation_log (target_type, target_id, action, from_status, to_status, note, moderator)
               values ('event', ${r.id}, 'privacy_degrade', ${r.precision}, ${precision}, 'Convocatoria finalizada: precisión reducida automáticamente', 'sistema')`;
    });
    n++;
  }
  console.log(`precisión reducida en ${n} convocatorias`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
