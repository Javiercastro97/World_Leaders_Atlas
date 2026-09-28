/**
 * Modelo territorial de referencia.
 *
 * Códigos: INE (provincias 01–52, comunidades autónomas 01–19).
 * Identificador canónico en toda la app: "ES" | "CA-XX" | "PR-XX" | "MU-XXXXX".
 *
 * Nota judicial: el CGPJ agrega por Tribunal Superior de Justicia (TSJ). Hay 17 TSJ;
 * Ceuta y Melilla pertenecen al TSJ de Andalucía, Ceuta y Melilla. Por eso cada CCAA
 * lleva su `tsj` y los datos por TSJ nunca se comparan directamente con los de CCAA
 * sin avisar de esta diferencia.
 */

export type TerritoryType = "country" | "ccaa" | "province" | "municipality";

export interface Territory {
  id: string; // ES | CA-01 | PR-03
  type: TerritoryType;
  ine: string;
  name: string; // nombre oficial (puede ser bilingüe)
  shortName: string; // nombre de uso en la interfaz
  slug: string;
  parent: string | null;
  tsj: string | null; // código del TSJ (coincide con el INE de la CCAA sede)
  timezone: "Europe/Madrid" | "Atlantic/Canary";
}

type CcaaRow = [ine: string, name: string, shortName: string, slug: string, tsj: string];

const CCAA_ROWS: CcaaRow[] = [
  ["01", "Andalucía", "Andalucía", "andalucia", "01"],
  ["02", "Aragón", "Aragón", "aragon", "02"],
  ["03", "Principado de Asturias", "Asturias", "principado-de-asturias", "03"],
  ["04", "Illes Balears", "Illes Balears", "illes-balears", "04"],
  ["05", "Canarias", "Canarias", "canarias", "05"],
  ["06", "Cantabria", "Cantabria", "comunidad-de-cantabria", "06"],
  ["07", "Castilla y León", "Castilla y León", "castilla-y-leon", "07"],
  ["08", "Castilla-La Mancha", "Castilla-La Mancha", "castilla-la-mancha", "08"],
  ["09", "Cataluña/Catalunya", "Catalunya", "catalunya", "09"],
  ["10", "Comunitat Valenciana", "Comunitat Valenciana", "comunitat-valenciana", "10"],
  ["11", "Extremadura", "Extremadura", "extremadura", "11"],
  ["12", "Galicia", "Galicia", "galicia", "12"],
  ["13", "Comunidad de Madrid", "C. de Madrid", "comunidad-de-madrid", "13"],
  ["14", "Región de Murcia", "R. de Murcia", "region-de-murcia", "14"],
  ["15", "Comunidad Foral de Navarra", "Navarra", "comunidad-foral-de-navarra", "15"],
  ["16", "País Vasco/Euskadi", "Euskadi", "euskadi", "16"],
  ["17", "La Rioja", "La Rioja", "comunidad-autonoma-de-la-rioja", "17"],
  // Ceuta y Melilla: jurisdicción del TSJ de Andalucía, Ceuta y Melilla.
  ["18", "Ciudad Autónoma de Ceuta", "Ceuta", "ciudad-autonoma-de-ceuta", "01"],
  ["19", "Ciudad Autónoma de Melilla", "Melilla", "ciudad-autonoma-de-melilla", "01"],
];

type ProvRow = [ine: string, name: string, shortName: string, slug: string, ccaa: string];

const PROVINCE_ROWS: ProvRow[] = [
  ["01", "Araba/Álava", "Álava", "alava", "16"],
  ["02", "Albacete", "Albacete", "albacete", "08"],
  ["03", "Alacant/Alicante", "Alicante", "alicante", "10"],
  ["04", "Almería", "Almería", "almeria", "01"],
  ["05", "Ávila", "Ávila", "avila", "07"],
  ["06", "Badajoz", "Badajoz", "badajoz", "11"],
  ["07", "Illes Balears", "Illes Balears", "baleares", "04"],
  ["08", "Barcelona", "Barcelona", "barcelona", "09"],
  ["09", "Burgos", "Burgos", "burgos", "07"],
  ["10", "Cáceres", "Cáceres", "caceres", "11"],
  ["11", "Cádiz", "Cádiz", "cadiz", "01"],
  ["12", "Castelló/Castellón", "Castellón", "castellon", "10"],
  ["13", "Ciudad Real", "Ciudad Real", "ciudad-real", "08"],
  ["14", "Córdoba", "Córdoba", "cordoba", "01"],
  ["15", "A Coruña", "A Coruña", "a-coruna", "12"],
  ["16", "Cuenca", "Cuenca", "cuenca", "08"],
  ["17", "Girona", "Girona", "girona", "09"],
  ["18", "Granada", "Granada", "granada", "01"],
  ["19", "Guadalajara", "Guadalajara", "guadalajara", "08"],
  ["20", "Gipuzkoa", "Gipuzkoa", "gipuzkoa", "16"],
  ["21", "Huelva", "Huelva", "huelva", "01"],
  ["22", "Huesca", "Huesca", "huesca", "02"],
  ["23", "Jaén", "Jaén", "jaen", "01"],
  ["24", "León", "León", "leon", "07"],
  ["25", "Lleida", "Lleida", "lleida", "09"],
  ["26", "La Rioja", "La Rioja", "la-rioja", "17"],
  ["27", "Lugo", "Lugo", "lugo", "12"],
  ["28", "Madrid", "Madrid", "madrid", "13"],
  ["29", "Málaga", "Málaga", "malaga", "01"],
  ["30", "Murcia", "Murcia", "murcia", "14"],
  ["31", "Navarra", "Navarra", "navarra", "15"],
  ["32", "Ourense", "Ourense", "ourense", "12"],
  ["33", "Asturias", "Asturias", "asturias", "03"],
  ["34", "Palencia", "Palencia", "palencia", "07"],
  ["35", "Las Palmas", "Las Palmas", "las-palmas", "05"],
  ["36", "Pontevedra", "Pontevedra", "pontevedra", "12"],
  ["37", "Salamanca", "Salamanca", "salamanca", "07"],
  ["38", "Santa Cruz de Tenerife", "S. C. de Tenerife", "santa-cruz-de-tenerife", "05"],
  ["39", "Cantabria", "Cantabria", "cantabria", "06"],
  ["40", "Segovia", "Segovia", "segovia", "07"],
  ["41", "Sevilla", "Sevilla", "sevilla", "01"],
  ["42", "Soria", "Soria", "soria", "07"],
  ["43", "Tarragona", "Tarragona", "tarragona", "09"],
  ["44", "Teruel", "Teruel", "teruel", "02"],
  ["45", "Toledo", "Toledo", "toledo", "08"],
  ["46", "València/Valencia", "València", "valencia", "10"],
  ["47", "Valladolid", "Valladolid", "valladolid", "07"],
  ["48", "Bizkaia", "Bizkaia", "bizkaia", "16"],
  ["49", "Zamora", "Zamora", "zamora", "07"],
  ["50", "Zaragoza", "Zaragoza", "zaragoza", "02"],
  ["51", "Ceuta", "Ceuta", "ceuta", "18"],
  ["52", "Melilla", "Melilla", "melilla", "19"],
];

const CANARY_CCAA = "05";

export const SPAIN: Territory = {
  id: "ES",
  type: "country",
  ine: "00",
  name: "España",
  shortName: "España",
  slug: "espana",
  parent: null,
  tsj: null,
  timezone: "Europe/Madrid",
};

export const CCAA: Territory[] = CCAA_ROWS.map(([ine, name, shortName, slug, tsj]) => ({
  id: `CA-${ine}`,
  type: "ccaa",
  ine,
  name,
  shortName,
  slug,
  parent: "ES",
  tsj,
  timezone: ine === CANARY_CCAA ? "Atlantic/Canary" : "Europe/Madrid",
}));

export const PROVINCES: Territory[] = PROVINCE_ROWS.map(([ine, name, shortName, slug, ccaa]) => {
  const parent = CCAA.find((c) => c.ine === ccaa)!;
  return {
    id: `PR-${ine}`,
    type: "province",
    ine,
    name,
    shortName,
    slug,
    parent: parent.id,
    tsj: parent.tsj,
    timezone: parent.timezone,
  };
});

export const ALL_TERRITORIES: Territory[] = [SPAIN, ...CCAA, ...PROVINCES];

const byId = new Map(ALL_TERRITORIES.map((t) => [t.id, t]));
const provinceBySlug = new Map(PROVINCES.map((t) => [t.slug, t]));
const ccaaBySlug = new Map(CCAA.map((t) => [t.slug, t]));

export function getTerritory(id: string | null | undefined): Territory | null {
  return id ? byId.get(id) ?? null : null;
}

export function getProvinceBySlug(slug: string): Territory | null {
  return provinceBySlug.get(slug) ?? null;
}

export function getCcaaBySlug(slug: string): Territory | null {
  return ccaaBySlug.get(slug) ?? null;
}

/** Slugs reservados: una organización no puede usar el slug de un territorio. */
export const RESERVED_TERRITORY_SLUGS = new Set<string>([
  ...PROVINCES.map((p) => p.slug),
  ...CCAA.map((c) => c.slug),
]);

export function provincesOf(ccaaId: string): Territory[] {
  return PROVINCES.filter((p) => p.parent === ccaaId);
}

export function timezoneForProvince(provinceId: string | null | undefined): Territory["timezone"] {
  return getTerritory(provinceId)?.timezone ?? "Europe/Madrid";
}

/**
 * Código postal → provincia. En España los dos primeros dígitos del CP coinciden
 * con el código INE de provincia (01–52). Es una regla determinista, no una geocodificación.
 */
export function provinceFromPostalCode(cp: string): Territory | null {
  const m = /^\s*(\d{5})\s*$/.exec(cp);
  if (!m) return null;
  const prefix = m[1].slice(0, 2);
  return getTerritory(`PR-${prefix}`);
}

// ---------------------------------------------------------------------------
// Emparejado de nombres territoriales procedentes de fuentes externas (CGPJ, INE).

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9ñ/ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Alias históricos y exónimos habituales en las fuentes oficiales.
const PROVINCE_ALIASES: Record<string, string> = {
  alava: "01", araba: "01", "araba/alava": "01", "alava/araba": "01",
  alicante: "03", alacant: "03", "alicante/alacant": "03", "alacant/alicante": "03",
  baleares: "07", "illes balears": "07", "islas baleares": "07", "balears illes": "07",
  castellon: "12", castello: "12", "castellon/castello": "12", "castello/castellon": "12",
  "la coruna": "15", "a coruna": "15", coruna: "15", "coruna a": "15",
  gerona: "17", girona: "17",
  guipuzcoa: "20", gipuzkoa: "20",
  lerida: "25", lleida: "25",
  orense: "32", ourense: "32",
  "las palmas": "35", "palmas las": "35", "palmas": "35",
  "santa cruz de tenerife": "38", "s c tenerife": "38", "sc tenerife": "38", tenerife: "38",
  valencia: "46", "valencia/valencia": "46",
  vizcaya: "48", bizkaia: "48",
  "rioja la": "26", "la rioja": "26", rioja: "26",
  navarra: "31", nafarroa: "31",
  asturias: "33",
  cantabria: "39",
  murcia: "30",
  madrid: "28",
};

const CCAA_ALIASES: Record<string, string> = {
  andalucia: "01",
  "andalucia ceuta y melilla": "01",
  aragon: "02",
  asturias: "03", "principado de asturias": "03", "asturias principado de": "03",
  baleares: "04", "illes balears": "04", "islas baleares": "04", "balears illes": "04",
  canarias: "05",
  cantabria: "06",
  "castilla y leon": "07",
  "castilla-la mancha": "08", "castilla la mancha": "08", "castilla - la mancha": "08",
  cataluna: "09", catalunya: "09", "cataluna/catalunya": "09",
  "comunidad valenciana": "10", "comunitat valenciana": "10", "c valenciana": "10", valenciana: "10",
  extremadura: "11",
  galicia: "12",
  madrid: "13", "comunidad de madrid": "13", "madrid comunidad de": "13",
  murcia: "14", "region de murcia": "14", "murcia region de": "14",
  navarra: "15", "comunidad foral de navarra": "15", "navarra comunidad foral de": "15",
  "pais vasco": "16", euskadi: "16", "pais vasco/euskadi": "16",
  "la rioja": "17", "rioja la": "17", rioja: "17",
  ceuta: "18",
  melilla: "19",
};

function stripPrefixes(n: string): string {
  return n
    .replace(/^(tsj|t s j|tribunal superior de justicia( de)?|provincia( de)?|prov|comunidad autonoma( de)?|c a)\s+/, "")
    .replace(/^(de|del)\s+/, "")
    .trim();
}

/**
 * Empareja un nombre de territorio procedente de una fuente con nuestro modelo.
 * `level` es obligatorio porque "Madrid", "Murcia", "Navarra"… son a la vez provincia y CCAA.
 */
export function matchTerritory(raw: string, level: "province" | "ccaa" | "tsj"): Territory | null {
  const n = stripPrefixes(normalizeName(raw));
  if (level === "province") {
    const code = PROVINCE_ALIASES[n];
    if (code) return getTerritory(`PR-${code}`);
    const hit = PROVINCES.find((p) => normalizeName(p.name) === n || normalizeName(p.shortName) === n);
    return hit ?? null;
  }
  const code = CCAA_ALIASES[n];
  const hit =
    (code ? getTerritory(`CA-${code}`) : null) ??
    CCAA.find((c) => normalizeName(c.name) === n || normalizeName(c.shortName) === n) ??
    null;
  if (!hit) return null;
  if (level === "tsj") {
    // Un TSJ se identifica con la CCAA sede. Ceuta/Melilla no tienen TSJ propio.
    return hit.tsj === hit.ine ? hit : null;
  }
  return hit;
}

export function isTerritoryId(id: string): boolean {
  return byId.has(id);
}
