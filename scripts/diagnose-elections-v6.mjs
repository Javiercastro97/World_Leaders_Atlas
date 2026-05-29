const E = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0' }
async function sparql(q) {
  const r = await fetch(`${E}?query=${encodeURIComponent(q)}&format=json`, { headers: H })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()).results.bindings
}
function sep(t) { console.log(`\n${'═'.repeat(70)}\n${t}\n${'═'.repeat(70)}`) }

// ─── 1. ¿Qué propiedades tiene Q84082018 (España 2023)? ──────────────────────
sep('Propiedades directas de Q84082018 (España 2023)')
const propsQ = `
SELECT ?prop ?propLabel ?val ?valLabel WHERE {
  wd:Q84082018 ?p ?val .
  ?prop wikibase:directClaim ?p .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY ?prop`
const props = await sparql(propsQ)
for (const b of props) {
  const prop = b.prop?.value?.split('/entity/')[1] ?? '?'
  const pLbl = b.propLabel?.value ?? '?'
  const val  = b.val?.value?.replace('http://www.wikidata.org/entity/', '')
               .replace('http://www.wikidata.org/prop/direct/', '')
  const vLbl = b.valLabel?.value ?? ''
  console.log(`  ${prop.padEnd(8)} ${pLbl.padEnd(30)} ${val.slice(0,50)} ${vLbl.slice(0,30)}`)
}

// ─── 2. ¿Hay statements P710 en Q84082018, con o sin qualifiers? ─────────────
sep('P710 statements en Q84082018 (¿existen? ¿tienen qualifiers numéricos?)')
const p710Q = `
SELECT ?party ?partyLabel ?votes ?pct ?seats WHERE {
  wd:Q84082018 p:P710 ?stmt .
  ?stmt ps:P710 ?party .
  OPTIONAL { ?stmt pq:P1111 ?votes }
  OPTIONAL { ?stmt pq:P1107 ?pct }
  OPTIONAL { ?stmt pq:P1410 ?seats }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
LIMIT 20`
const p710 = await sparql(p710Q)
if (!p710.length) console.log('  (ningún statement P710)')
else {
  console.log(`  ${p710.length} rows`)
  for (const b of p710) {
    const name  = (b.partyLabel?.value ?? b.party?.value?.split('/entity/')[1] ?? '?').slice(0,40).padEnd(40)
    const votes = b.votes?.value ?? '—'
    const pct   = b.pct?.value ?? '—'
    const seats = b.seats?.value ?? '—'
    console.log(`  ${name}  votos:${votes}  pct:${pct}  escaños:${seats}`)
  }
}

// ─── 3. Buscar resultados en subitems P527 (has part) ────────────────────────
sep('¿Q84082018 tiene P527 (has part) — subelecciones con resultados?')
const p527Q = `
SELECT ?part ?partLabel WHERE {
  wd:Q84082018 wdt:P527 ?part .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
LIMIT 10`
const p527 = await sparql(p527Q)
if (!p527.length) console.log('  (ningún P527)')
else p527.forEach(b => console.log(`  ${b.part?.value?.split('/entity/')[1]?.padEnd(14)} ${b.partLabel?.value}`))

// ─── 4. Buscar resultados via P1128 (number of seats) u otras props en Q84082018 ──
sep('¿Hay datos numéricos directos en Q84082018? (P1141, P1128, P1410...)')
const numQ = `
SELECT ?prop ?propLabel ?val WHERE {
  VALUES ?prop { wdt:P1141 wdt:P1128 wdt:P1410 wdt:P1111 wdt:P1107 wdt:P2046 }
  wd:Q84082018 ?p ?val .
  ?prop wikibase:directClaim ?p .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}`
const nums = await sparql(numQ)
if (!nums.length) console.log('  (ninguno)')
else nums.forEach(b => console.log(`  ${b.prop?.value?.split('/entity/')[1]?.padEnd(8)} ${b.propLabel?.value?.padEnd(20)} ${b.val?.value}`))

// ─── 5. ¿Hay items que referencian Q84082018 como "based on" de resultados? ──
sep('Items que referencian Q84082018 via P361 (part of) o P805 (statement) — buscar resultados separados')
const refQ = `
SELECT ?item ?itemLabel ?type ?typeLabel WHERE {
  { ?item wdt:P361 wd:Q84082018 }
  UNION
  { wd:Q84082018 wdt:P527 ?item }
  OPTIONAL { ?item wdt:P31 ?type }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
LIMIT 15`
const refs = await sparql(refQ)
if (!refs.length) console.log('  (ninguno)')
else refs.forEach(b => {
  const qid  = b.item?.value?.split('/entity/')[1]?.padEnd(14)
  const lbl  = b.itemLabel?.value?.slice(0,40)?.padEnd(40)
  const type = b.typeLabel?.value ?? ''
  console.log(`  ${qid} ${lbl} [${type}]`)
})

// ─── 6. España 2023: intenta vía P991 (successful candidate) ─────────────────
sep('P991 (successful candidate) en Q84082018')
const p991Q = `
SELECT ?cand ?candLabel ?party ?partyLabel WHERE {
  wd:Q84082018 p:P991 ?stmt .
  ?stmt ps:P991 ?cand .
  OPTIONAL { ?cand wdt:P102 ?party }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
LIMIT 15`
const p991 = await sparql(p991Q)
if (!p991.length) console.log('  (ningún P991)')
else p991.forEach(b => console.log(`  ${b.candLabel?.value?.slice(0,30)?.padEnd(30)} partido: ${b.partyLabel?.value ?? '—'}`))

// ─── 7. Igual para UK 2024 (Q78851988) ───────────────────────────────────────
sep('P710 statements en Q78851988 (UK 2024)')
const ukQ = `
SELECT ?party ?partyLabel ?votes ?pct ?seats WHERE {
  wd:Q78851988 p:P710 ?stmt .
  ?stmt ps:P710 ?party .
  OPTIONAL { ?stmt pq:P1111 ?votes }
  OPTIONAL { ?stmt pq:P1107 ?pct }
  OPTIONAL { ?stmt pq:P1410 ?seats }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
LIMIT 15`
const uk = await sparql(ukQ)
if (!uk.length) console.log('  (ningún P710 en UK 2024)')
else {
  console.log(`  ${uk.length} rows`)
  for (const b of uk.slice(0,8)) {
    const name = (b.partyLabel?.value ?? '?').slice(0,36).padEnd(36)
    console.log(`  ${name}  votos:${b.votes?.value ?? '—'}  pct:${b.pct?.value ?? '—'}  seats:${b.seats?.value ?? '—'}`)
  }
}

// ─── 8. Alemania 2025 via P461 (opponent) o P1128 ────────────────────────────
sep('P710 en Q108761711 (Alemania 2025) — ¿hay aunque sea una fila?')
const deQ = `
SELECT (COUNT(*) AS ?n) WHERE {
  wd:Q108761711 p:P710 ?s .
}`
const deN = await sparql(deQ)
console.log(`  Filas P710: ${deN[0]?.n?.value ?? 0}`)
