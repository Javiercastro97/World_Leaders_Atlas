const E = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0' }
async function sparql(q) {
  const r = await fetch(`${E}?query=${encodeURIComponent(q)}&format=json`, { headers: H })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()).results.bindings
}
function sep(t) { console.log(`\n${'═'.repeat(70)}\n${t}\n${'═'.repeat(70)}`) }

function q2(qid) {
  return `
SELECT ?party ?partyLabel ?partyColor ?votes ?pct ?seats WHERE {
  wd:${qid} p:P710 ?stmt .
  ?stmt ps:P710 ?party .
  OPTIONAL { ?stmt pq:P1111 ?votes }
  OPTIONAL { ?stmt pq:P1107 ?pct }
  OPTIONAL { ?stmt pq:P1410 ?seats }
  OPTIONAL { ?party wdt:P465 ?partyColor }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?pct) DESC(?votes)`.trim()
}

function printQ2(rows, label) {
  console.log(`\n── ${label}`)
  if (!rows.length) { console.log('  (vacío)'); return }
  const hasVotes = rows.some(b => b.votes)
  const hasPct   = rows.some(b => b.pct)
  const hasSeats = rows.some(b => b.seats)
  console.log(`  ${rows.length} participantes | votos:${hasVotes} | %:${hasPct} | escaños:${hasSeats}`)
  for (const b of rows.slice(0, 10)) {
    const raw  = b.pct?.value
    const pct  = raw ? (parseFloat(raw) <= 1 ? (parseFloat(raw)*100).toFixed(2) : parseFloat(raw).toFixed(2)) : null
    const name = (b.partyLabel?.value ?? '?').slice(0,36).padEnd(36)
    const pStr = pct ? `${pct}%`.padStart(8) : '       ?'
    const vStr = b.votes ? (+b.votes.value).toLocaleString('es-ES').padStart(12) : '           ?'
    const sStr = b.seats?.value?.padStart(4) ?? '   ?'
    const col  = b.partyColor?.value ? `#${b.partyColor.value}` : ''
    console.log(`  ${name}${pStr}  ${vStr}  esc:${sStr}  ${col}`)
  }
  if (rows.length > 10) console.log(`  ... y ${rows.length - 10} más`)
}

// Query combinada: cuando hay P527 subitems, busca P710 en ellos directamente
// Prioriza la cámara baja (Congreso, Bundestag, Commons...)
function q2viaSubitems(parentQid) {
  return `
SELECT ?party ?partyLabel ?partyColor ?votes ?pct ?seats ?subElec ?subElecLabel WHERE {
  wd:${parentQid} wdt:P527 ?subElec .
  ?subElec p:P710 ?stmt .
  ?stmt ps:P710 ?party .
  OPTIONAL { ?stmt pq:P1111 ?votes }
  OPTIONAL { ?stmt pq:P1107 ?pct }
  OPTIONAL { ?stmt pq:P1410 ?seats }
  OPTIONAL { ?party wdt:P465 ?partyColor }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY ?subElec DESC(?pct) DESC(?votes)
LIMIT 100`.trim()
}

// ─── ESPAÑA: subitem Congreso Q119494968 ─────────────────────────────────────
sep('ESPAÑA — P710 en Q119494968 (Congreso de los Diputados 2023)')
printQ2(await sparql(q2('Q119494968')), 'Congreso directo')

sep('ESPAÑA — P710 via P527 subitems de Q84082018 (grupo elecciones)')
const espSub = await sparql(q2viaSubitems('Q84082018'))
// Group by subElec
const bySubElec = {}
for (const b of espSub) {
  const key = b.subElec?.value?.split('/entity/')[1]
  if (!bySubElec[key]) bySubElec[key] = { label: b.subElecLabel?.value, rows: [] }
  bySubElec[key].rows.push(b)
}
for (const [qid, { label, rows }] of Object.entries(bySubElec)) {
  printQ2(rows, `Subitem ${qid} — ${label}`)
}

// ─── UK 2024: subitems ────────────────────────────────────────────────────────
sep('UK — P527 subitems de Q78851988')
const ukSubs = `
SELECT ?part ?partLabel ?type ?typeLabel WHERE {
  wd:Q78851988 wdt:P527 ?part .
  OPTIONAL { ?part wdt:P31 ?type }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
LIMIT 10`
const ukParts = await sparql(ukSubs)
if (!ukParts.length) {
  console.log('  (sin P527 — Q78851988 no es un grupo)')
  console.log('\n── Intentar P710 directo en Q78851988')
  const direct = await sparql(q2('Q78851988'))
  printQ2(direct, 'P710 directo Q78851988')
} else {
  ukParts.forEach(b => console.log(`  ${b.part?.value?.split('/entity/')[1]?.padEnd(14)} ${b.partLabel?.value?.padEnd(40)} [${b.typeLabel?.value ?? '?'}]`))
}

// ─── ALEMANIA 2025: subitems ──────────────────────────────────────────────────
sep('ALEMANIA — P527 subitems de Q108761711')
const deSubs = `
SELECT ?part ?partLabel ?type ?typeLabel WHERE {
  wd:Q108761711 wdt:P527 ?part .
  OPTIONAL { ?part wdt:P31 ?type }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
LIMIT 10`
const deParts = await sparql(deSubs)
if (!deParts.length) {
  console.log('  (sin P527 — intentar P710 directo)')
  printQ2(await sparql(q2('Q108761711')), 'P710 directo Q108761711')
} else {
  deParts.forEach(b => console.log(`  ${b.part?.value?.split('/entity/')[1]?.padEnd(14)} ${b.partLabel?.value?.padEnd(40)} [${b.typeLabel?.value ?? '?'}]`))
}

// ─── Query unificada final: intenta P710 directo, luego via P527 ──────────────
sep('QUERY UNIFICADA — P710 directo o via P527 (para el hook real)')
// Idea: un solo SELECT que prueba ambas rutas
function qUnified(elQid) {
  return `
SELECT DISTINCT ?party ?partyLabel ?partyColor ?votes ?pct ?seats WHERE {
  {
    wd:${elQid} p:P710 ?stmt .
  } UNION {
    wd:${elQid} wdt:P527 ?sub .
    ?sub p:P710 ?stmt .
  }
  ?stmt ps:P710 ?party .
  OPTIONAL { ?stmt pq:P1111 ?votes }
  OPTIONAL { ?stmt pq:P1107 ?pct }
  OPTIONAL { ?stmt pq:P1410 ?seats }
  OPTIONAL { ?party wdt:P465 ?partyColor }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?pct) DESC(?votes)
LIMIT 50`.trim()
}

console.log('\n── España Q84082018 via query unificada')
printQ2(await sparql(qUnified('Q84082018')), 'España 2023 unificada')
