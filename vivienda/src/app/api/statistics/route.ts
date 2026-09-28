import { z } from "zod";
import { METRICS, PROCEDURE_TYPES } from "@/lib/vocab";
import { choropleth, primarySeries, timeSeries, periodsOf } from "@/server/stats";
import { getRepo } from "@/server/repo";
import { queryObject, resolveTerritory } from "@/server/params";
import { error, json, zodError, guardRate, tooMany } from "@/server/http";

const Q = z.object({
  view: z.enum(["raw", "choropleth", "series"]).default("raw"),
  metric: z.enum(METRICS).default("lanzamientos_practicados"),
  territory: z.string().optional(),
  level: z.enum(["province", "ccaa"]).default("province"),
  period: z.string().regex(/^\d{4}(-Q[1-4])?$/).optional(),
  period_type: z.enum(["year", "quarter"]).default("year"),
  procedure: z.enum(PROCEDURE_TYPES).default("total"),
  dataset: z.string().max(80).optional(),
});

/**
 * GET /api/statistics
 *   view=raw        filas normalizadas (con fuente, dataset, snapshot y fecha de consulta)
 *   view=choropleth valores por provincia/CCAA para un periodo (+ tasa por 100.000 hab.)
 *   view=series     serie temporal de un territorio con variación interanual
 */
export async function GET(req: Request) {
  const rl = guardRate(req, "api");
  if (!rl.allowed) return tooMany(rl.retryAfterSec);
  const url = new URL(req.url);
  const parsed = Q.safeParse(queryObject(url));
  if (!parsed.success) return zodError(parsed.error);
  const q = parsed.data;
  const territory = q.territory ? (q.territory.toUpperCase() === "ES" ? "ES" : resolveTerritory(q.territory)) : null;
  if (q.territory && !territory) return error(400, `Territorio desconocido: ${q.territory}`);

  if (q.view === "choropleth") {
    const c = await choropleth({ metric: q.metric, level: q.level, period: q.period, periodType: q.period?.includes("-Q") ? "quarter" : q.period_type, procedure: q.procedure });
    return json({ choropleth: c }, { cache: "public", maxAge: 3600 });
  }

  const repo = await getRepo();
  if (q.dataset) {
    const rows = await repo.listStatistics({ metric: url.searchParams.has("metric") ? q.metric : undefined, datasetIds: [q.dataset], territoryCode: territory ?? undefined });
    const dataset = (await repo.listDatasets()).find((d) => d.id === q.dataset) ?? null;
    return json({ dataset, statistics: rows }, { cache: "public", maxAge: 3600 });
  }

  const sel = await primarySeries(q.metric);
  if (!sel) return json({ dataset: null, statistics: [], note: "No hay datos cargados para esta métrica." }, { cache: "public", maxAge: 600 });

  if (q.view === "series") {
    const points = timeSeries(sel.rows, { territory: territory ?? "ES", periodType: q.period_type, procedure: q.procedure });
    return json({ dataset: sel.dataset, territory: territory ?? "ES", series: points }, { cache: "public", maxAge: 3600 });
  }
  const rows = sel.rows.filter((r) => (!territory || r.territory_code === territory) && (!q.period || r.period === q.period));
  return json(
    { dataset: sel.dataset, periods: { year: periodsOf(sel.rows, "year"), quarter: periodsOf(sel.rows, "quarter") }, statistics: rows },
    { cache: "public", maxAge: 3600 },
  );
}
