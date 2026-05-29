// Uso: node scripts/generate-country-codes.mjs > src/data/country-codes.json
// Stats van a stderr (pantalla), JSON va a stdout (archivo).

const ENDPOINT = 'https://query.wikidata.org/sparql'

const QUERY = `
SELECT DISTINCT ?country ?iso3 ?numericCode
  (SAMPLE(?es) AS ?nameEs) (SAMPLE(?en) AS ?nameEn)
WHERE {
  ?country wdt:P298 ?iso3 .
  FILTER NOT EXISTS { ?country wdt:P576 ?d }
  OPTIONAL { ?country wdt:P299 ?numericCode }
  OPTIONAL { ?country rdfs:label ?es . FILTER(lang(?es) = "es") }
  OPTIONAL { ?country rdfs:label ?en . FILTER(lang(?en) = "en") }
}
GROUP BY ?country ?iso3 ?numericCode
ORDER BY ?iso3
`

const log = (msg) => process.stderr.write(msg + '\n')

log('[generate] Consultando Wikidata...')

const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(QUERY)}&format=json`, {
  headers: {
    'Accept': 'application/sparql-results+json',
    'User-Agent': 'AtlasPolitico/1.0',
  },
})

if (!res.ok) throw new Error(`Wikidata ${res.status}: ${res.statusText}`)

const data = await res.json()
const bindings = data.results.bindings
log(`[generate] Wikidata devolvió ${bindings.length} entradas (antes de filtrar)`)

// Construir mapa con clave numérica
const result = {}
const noNumeric = []

for (const b of bindings) {
  const qid     = b.country.value.replace('http://www.wikidata.org/entity/', '')
  const iso3    = b.iso3.value
  const numeric = b.numericCode?.value ?? null
  const name    = b.nameEs?.value ?? b.nameEn?.value ?? iso3
  const nameEn  = b.nameEn?.value ?? b.nameEs?.value ?? iso3

  if (numeric) {
    result[numeric] = { qid, iso3, name, nameEn }
  } else {
    noNumeric.push({ qid, iso3, name })
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────
log(`[generate] Con código numérico (usables en mapa): ${Object.keys(result).length}`)
log(`[generate] Sin código numérico (excluidos del mapa): ${noNumeric.length}`)

// Kosovo: sin P299 en Wikidata — inyección manual
result['383'] = { qid: 'Q1246', iso3: 'XKX', name: 'Kosovo', nameEn: 'Kosovo' }
log('[generate] Kosovo   (Q1246, 383) inyectado manualmente (sin P299 en Wikidata)')

// Palestina: dos entidades comparten P298=PSE (Q219060 Estado + Q407199 Territorios);
// forzamos el Estado de Palestina, reconocido por la ONU como observador
result['275'] = { qid: 'Q219060', iso3: 'PSE', name: 'Palestina', nameEn: 'Palestine' }
log('[generate] Palestina (Q219060, 275) inyectada manualmente (P298=PSE ambigua)')

// Verificación de casos especiales y correcciones conocidas
const CHECKS = [
  { name: 'Taiwán',         qid: 'Q865',    iso3: 'TWN', numeric: '158' },
  { name: 'Kosovo',         qid: 'Q1246',   iso3: 'XKX', numeric: '383' },
  { name: 'Palestina',      qid: 'Q219060', iso3: 'PSE', numeric: '275' },
  { name: 'Belarus',        qid: 'Q184',    iso3: 'BLR', numeric: '112' },
  { name: 'Benin',          qid: 'Q962',    iso3: 'BEN', numeric: '204' },
  { name: 'Burkina Faso',   qid: 'Q965',    iso3: 'BFA', numeric: '854' },
  { name: 'España',         qid: 'Q29',     iso3: 'ESP', numeric: '724' },
  { name: 'Alemania',       qid: 'Q183',    iso3: 'DEU', numeric: '276' },
]

log('\n[generate] Verificación de entradas clave:')
for (const c of CHECKS) {
  const entry = result[c.numeric]
  if (entry && entry.qid === c.qid) {
    log(`  ✓  ${c.name.padEnd(16)} numeric=${c.numeric}, iso3=${entry.iso3}, qid=${entry.qid}`)
  } else if (entry) {
    log(`  ✗  ${c.name.padEnd(16)} numeric=${c.numeric} INCORRECTO: qid=${entry.qid} iso3=${entry.iso3} (esperado qid=${c.qid})`)
  } else {
    log(`  ✗  ${c.name.padEnd(16)} numeric=${c.numeric} NO ENCONTRADO`)
  }
}

// Muestra de las primeras 8 entradas
log('\n[generate] Muestra (primeras 8 entradas, ordenadas por numérico):')
Object.entries(result)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .slice(0, 8)
  .forEach(([num, v]) => log(`  ${num.padStart(3)} | ${v.iso3} | ${v.qid.padEnd(8)} | ${v.nameEn} / ${v.name}`))

// Delta: comparar con JSON anterior si existe
try {
  const { readFileSync } = await import('fs')
  const prev = JSON.parse(readFileSync('src/data/country-codes.json', 'utf8'))
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(result)])
  const changed = [], added = [], removed = []
  for (const k of allKeys) {
    if (!prev[k]) added.push(k)
    else if (!result[k]) removed.push(`${k} (era ${prev[k].qid} ${prev[k].name})`)
    else if (prev[k].qid !== result[k].qid)
      changed.push(`${k}: ${prev[k].qid} (${prev[k].name}) → ${result[k].qid} (${result[k].name})`)
  }
  log('\n[generate] Delta respecto al JSON anterior:')
  if (changed.length) { log(`  Cambiados (${changed.length}):`);  changed.forEach(x => log(`    • ${x}`)) }
  if (removed.length) { log(`  Eliminados (${removed.length}):`); removed.forEach(x => log(`    • ${x}`)) }
  if (added.length)   { log(`  Añadidos (${added.length}):`);     added.forEach(x => log(`    • ${x}`)) }
  if (!changed.length && !removed.length && !added.length) log('  (sin cambios)')
} catch { log('\n[generate] (no hay JSON anterior para comparar)') }

log('\n[generate] JSON listo. Redirigiendo a src/data/country-codes.json...')

// ── Salida JSON a stdout ───────────────────────────────────────────────────
// Ordenar por código numérico para que el archivo sea legible
const sorted = Object.fromEntries(
  Object.entries(result).sort((a, b) => Number(a[0]) - Number(b[0]))
)
process.stdout.write(JSON.stringify(sorted, null, 2) + '\n')
