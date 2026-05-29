const E = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0' }
async function sparql(q) {
  const r = await fetch(`${E}?query=${encodeURIComponent(q)}&format=json`, { headers: H })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()).results.bindings
}
function sep(t) { console.log(`\n${'═'.repeat(70)}\n${t}\n${'═'.repeat(70)}`) }

// ─── 1. ¿Existe P5045 en Q84082018? ─────────────────────────────────────────
sep('¿Q84082018 tiene P5045 (results breakdown)?')
const p5045check = `
SELECT ?breakdown ?breakdownLabel WHERE {
  wd:Q84082018 wdt:P5045 ?breakdown .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}`
const check = await sparql(p5045check)
if (!check.length) {
  console.log('  (sin P5045 directo en Q84082018)')
} else {
  check.forEach(b => console.log(`  ${b.breakdown?.value?.split('/entity/')[1]?.padEnd(14)} ${b.breakdownLabel?.value}`))
}

// ─── 2. Buscar P5045 en los subitems del grupo de elecciones ─────────────────
sep('¿Algún subitem de Q84082018 tiene P5045?')
const subP5045 = `
SELECT ?sub ?subLabel ?breakdown ?breakdownLabel WHERE {
  wd:Q84082018 wdt:P527 ?sub .
  ?sub wdt:P5045 ?breakdown .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}`
const subs = await sparql(subP5045)
if (!subs.length) console.log('  (ningún subitem tiene P5045)')
else subs.forEach(b => console.log(`  sub:${b.sub?.value?.split('/entity/')[1]?.padEnd(14)} → breakdown:${b.breakdown?.value?.split('/entity/')[1]?.padEnd(14)} ${b.breakdownLabel?.value}`))

// ─── 3. Query exacta del usuario sobre Q84082018 con P5045 ───────────────────
sep('Query literal del usuario: P5045 → partido → votos/escaños/%')
const userQ = `
SELECT ?breakdown ?breakdownLabel ?party ?partyLabel ?votes ?seats ?pct WHERE {
  wd:Q84082018 wdt:P5045 ?breakdown .
  ?breakdown ?p ?party .
  ?party wdt:P31/wdt:P279* wd:Q7278 .
  OPTIONAL { ?party wdt:P1111 ?votes }
  OPTIONAL { ?party wdt:P1410 ?seats }
  OPTIONAL { ?party wdt:P1107 ?pct }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}`
const userRes = await sparql(userQ)
if (!userRes.length) {
  console.log('  (sin resultados con esa query)')
} else {
  console.log(`  ${userRes.length} filas`)
  for (const b of userRes) {
    const bd    = b.breakdown?.value?.split('/entity/')[1]?.padEnd(14)
    const party = (b.partyLabel?.value ?? b.party?.value?.split('/entity/')[1] ?? '?').slice(0,35).padEnd(35)
    const votes = b.votes?.value ?? '—'
    const seats = b.seats?.value ?? '—'
    const pct   = b.pct?.value ?? '—'
    console.log(`  ${bd}  ${party}  votos:${votes}  esc:${seats}  pct:${pct}`)
  }
}

// ─── 4. Buscar Q121297778 directamente (si el usuario lo mencionó) ────────────
sep('Q121297778 directamente — ¿qué propiedades tiene?')
const directQ = `
SELECT ?prop ?propLabel ?val ?valLabel WHERE {
  wd:Q121297778 ?p ?val .
  ?prop wikibase:directClaim ?p .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY ?prop
LIMIT 30`
const direct = await sparql(directQ)
if (!direct.length) {
  console.log('  (Q121297778 no existe o está vacío)')
} else {
  for (const b of direct) {
    const prop = b.prop?.value?.split('/entity/')[1]?.padEnd(8)
    const pLbl = b.propLabel?.value?.padEnd(28)
    const val  = (b.val?.value ?? '').replace('http://www.wikidata.org/entity/','').slice(0,50)
    const vLbl = b.valLabel?.value?.slice(0,30) ?? ''
    console.log(`  ${prop} ${pLbl} ${val}  ${vLbl}`)
  }
}

// ─── 5. Si Q121297778 existe, buscar sus datos de partido ────────────────────
sep('Q121297778 — buscar datos de partido (P804, P710, statements de partido)')
const breakdownQ = `
SELECT ?prop ?propLabel ?party ?partyLabel ?votes ?pct ?seats WHERE {
  wd:Q121297778 ?p ?party .
  ?prop wikibase:directClaim ?p .
  OPTIONAL {
    wd:Q121297778 p:?pStmt ?stmt .
    ?stmt ps:?pStmt ?party .
    OPTIONAL { ?stmt pq:P1111 ?votes }
    OPTIONAL { ?stmt pq:P1107 ?pct }
    OPTIONAL { ?stmt pq:P1410 ?seats }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
LIMIT 20`
// Actually this query is invalid - let me try differently
const breakdownQ2 = `
SELECT ?prop ?propLabel ?val ?valLabel WHERE {
  wd:Q121297778 ?p ?val .
  ?prop wikibase:directClaim ?p .
  FILTER(?p != schema:description && ?p != schema:name && ?p != rdfs:label && ?p != skos:altLabel)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
LIMIT 40`
const bd2 = await sparql(breakdownQ2)
if (!bd2.length) console.log('  (sin datos)')
else {
  for (const b of bd2) {
    const prop = b.prop?.value?.split('/entity/')[1]?.padEnd(8)
    const pLbl = b.propLabel?.value?.padEnd(28)
    const val  = (b.val?.value ?? '').replace('http://www.wikidata.org/entity/','').slice(0,45)
    const vLbl = b.valLabel?.value?.slice(0,30) ?? ''
    console.log(`  ${prop} ${pLbl} ${val}  ${vLbl}`)
  }
}

// ─── 6. Buscar P5045 globalmente: ¿cuántas elecciones lo tienen? ─────────────
sep('¿Cuántas elecciones nacionales tienen P5045 (results breakdown)?')
const globalQ = `
SELECT (COUNT(DISTINCT ?election) AS ?n) WHERE {
  ?election wdt:P31/wdt:P279* wd:Q40231 ;
            wdt:P17 ?country ;
            wdt:P5045 ?breakdown .
}`
const globalN = await sparql(globalQ)
console.log(`  Elecciones con P5045: ${globalN[0]?.n?.value ?? '?'}`)

// ─── 7. Muestra de cuáles elecciones tienen P5045 ────────────────────────────
sep('Muestra de elecciones con P5045 (últimas 10, cualquier país)')
const sampleQ = `
SELECT ?election ?electionLabel ?date ?country ?countryLabel WHERE {
  ?election wdt:P31/wdt:P279* wd:Q40231 ;
            wdt:P17 ?country ;
            wdt:P5045 ?breakdown ;
            wdt:P585 ?date .
  FILTER(?date < NOW())
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?date)
LIMIT 10`
const sampleRes = await sparql(sampleQ)
if (!sampleRes.length) console.log('  (ninguna)')
else sampleRes.forEach(b => {
  const qid   = b.election?.value?.split('/entity/')[1]?.padEnd(14)
  const date  = b.date?.value?.slice(0,10)
  const lbl   = b.electionLabel?.value?.slice(0,40)?.padEnd(40)
  const cntry = b.countryLabel?.value ?? '?'
  console.log(`  ${qid} ${date}  ${lbl}  [${cntry}]`)
})
