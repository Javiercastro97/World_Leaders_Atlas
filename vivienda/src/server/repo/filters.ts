/** Filtros puros compartidos por los repositorios (y testeados de forma aislada). */
import type { HousingEvent, Organization, Statistic } from "@/lib/schema";
import { getTerritory, normalizeName } from "@/lib/territories";
import type { EventFilter, OrganizationFilter, StatisticFilter } from "./types";

function inTerritory(provinceId: string, territory: string): boolean {
  if (territory === "ES") return true;
  if (territory.startsWith("PR-")) return provinceId === territory;
  if (territory.startsWith("CA-")) return getTerritory(provinceId)?.parent === territory;
  return false;
}

export function filterEvents(events: HousingEvent[], f: EventFilter = {}): HousingEvent[] {
  const muni = f.municipality ? normalizeName(f.municipality) : null;
  return events
    .filter((e) => (f.includeDemo ? true : !e.demo))
    .filter((e) => !f.territory || inTerritory(e.location.province_id, f.territory))
    .filter((e) => !muni || normalizeName(e.location.municipality_name ?? "").split("/").some((n) => n.trim() === muni))
    .filter((e) => !f.from || e.date >= f.from)
    .filter((e) => !f.to || e.date <= f.to)
    .filter((e) => !f.types?.length || f.types.includes(e.type))
    .filter((e) => !f.organizationId || e.organization_id === f.organizationId)
    .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
}

export function filterOrganizations(orgs: Organization[], f: OrganizationFilter = {}): Organization[] {
  const q = f.q ? normalizeName(f.q) : null;
  return orgs
    .filter((o) => !f.territory || o.territory_id === f.territory || inTerritory(o.territory_id, f.territory) || getTerritory(o.territory_id)?.parent === f.territory)
    .filter((o) => !f.type || o.type === f.type)
    .filter((o) => !q || normalizeName(`${o.name} ${o.municipality_name ?? ""} ${o.description}`).includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function filterStatistics(rows: Statistic[], f: StatisticFilter = {}): Statistic[] {
  return rows.filter(
    (r) =>
      (!f.metric || r.metric === f.metric) &&
      (!f.datasetIds || f.datasetIds.includes(r.dataset_id)) &&
      (!f.territoryType || r.territory_type === f.territoryType) &&
      (!f.territoryCode || r.territory_code === f.territoryCode) &&
      (!f.periodType || r.period_type === f.periodType) &&
      (!f.procedureType || r.procedure_type === f.procedureType),
  );
}
