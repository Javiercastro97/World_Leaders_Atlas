const E = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0' }

async function sparql(query) {
  const r = await fetch(`${E}?query=${encodeURIComponent(query)}&format=json`, { headers: H })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()).results.bindings
}

function sep(title) {
  console.log(`\n${'═'.repeat(70)}\n${title}\n${'═'.repeat(70)}`)
}
function sub(title) { console.log(`\n── ${title}`) }

// ─── QUERY 1: last general election for a country ────────────────────────────
function q1(countryQid) {
  return `
SELECT ?election ?electionLabel ?date ?esSlug ?enSlug WHERE {
  ?election wdt:P31/wdt:P279* wd:Q40231 ;
            wdt:P17 wd:${countryQid} ;
            wdt:P585 ?date .
  OPTIONAL {
    ?esArt schema:about ?election ;
           schema:isPartOf <https://es.wikipedia.org/> .
    BIND(REPLACE(STR(?esArt), "https://es.wikipedia.org/wiki/", "") AS ?esSlug)
  }
  OPTIONAL {
    ?enArt schema:about ?election ;
           schema:isPartOf <https://en.wikipedia.org/> .
    BIND(REPLACE(STR(?enArt), "https://en.wikipedia.org/wiki/", "") AS ?enSlug)
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?date)
LIMIT 3`.trim()
}

// ─── QUERY 2: participants + results for a specific election item ─────────────
function q2(electionQid) {
  return `
SELECT ?party ?partyLabel ?partyColor ?votes ?pct ?seats WHERE {
  wd:${electionQid} p:P710 ?stmt .
  ?stmt ps:P710 ?party .
  OPTIONAL { ?stmt pq:P1111 ?votes }
  OPTIONAL { ?stmt pq:P1107 ?pct }
  OPTIONAL { ?stmt pq:P1410 ?seats }
  OPTIONAL { ?party wdt:P465 ?partyColor }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?pct) DESC(?votes)`.trim()
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function printQ1Row(b) {
  const qid   = b.election?.value?.split('/entity/')[1] ?? '?'
  const label = b.electionLabel?.value ?? '(sin label)'
  const date  = b.date?.value?.slice(0,10) ?? '?'
  const es    = b.esSlug?.value ? `es:${decodeURIComponent(b.esSlug.value)}` : '(sin es-wiki)'
  const en    = b.enSlug?.value ? `en:${decodeURIComponent(b.enSlug.value)}` : '(sin en-wiki)'
  console.log(`  ${qid.padEnd(14)} ${date}  ${label}`)
  console.log(`               ${es}`)
  console.log(`               ${en}`)
}

function printQ2Rows(rows) {
  if (!rows.length) { console.log('  (sin filas — no hay P710 / resultados)'); return }
  const hasVotes = rows.some(b => b.votes)
  const hasPct   = rows.some(b => b.pct)
  const hasSeats = rows.some(b => b.seats)
  console.log(`  ${rows.length} participantes. Votos: ${hasVotes} | %: ${hasPct} | Escaños: ${hasSeats}`)
  console.log()
  for (const b of rows.slice(0, 10)) {
    const name  = (b.partyLabel?.value ?? b.party?.value?.split('/entity/')[1] ?? '?').padEnd(40)
    const pct   = b.pct   ? `${(+b.pct.value * (b.pct.value <= 1 ? 100 : 1)).toFixed(2)}%`.padStart(7) : '      ?'
    const votes = b.votes ? (+b.votes.value).toLocaleString('es').padStart(12) : '           ?'
    const seats = b.seats ? b.seats.value.padStart(4) : '   ?'
    const color = b.partyColor ? `#${b.partyColor.value}` : ''
    console.log(`  ${name} ${pct}  ${votes}  escaños:${seats}  ${color}`)
  }
  if (rows.length > 10) console.log(`  ... y ${rows.length - 10} más`)
}

// ─── ESPAÑA (Q29) ─────────────────────────────────────────────────────────────
sep('ESPAÑA (Q29)')

sub('Query 1 — últimas 3 elecciones')
const espQ1 = await sparql(q1('Q29'))
espQ1.forEach(printQ1Row)

if (espQ1.length) {
  const topElection = espQ1[0].election?.value?.split('/entity/')[1]
  sub(`Query 2 — resultados de ${topElection} (${espQ1[0].date?.value?.slice(0,10)})`)
  const espQ2 = await sparql(q2(topElection))
  printQ2Rows(espQ2)
}

// ─── ALBANIA (Q222) ───────────────────────────────────────────────────────────
sep('ALBANIA (Q222)')

sub('Query 1 — últimas 3 elecciones')
const albQ1 = await sparql(q1('Q222'))
albQ1.forEach(printQ1Row)

if (albQ1.length) {
  const topElection = albQ1[0].election?.value?.split('/entity/')[1]
  sub(`Query 2 — resultados de ${topElection} (${albQ1[0].date?.value?.slice(0,10)})`)
  const albQ2 = await sparql(q2(topElection))
  printQ2Rows(albQ2)
}

// ─── CUBA (Q241) — solo verificar clasificación, NO lanzar queries ───────────
sep('CUBA (Q241) — verificación en electoral-systems.json')
import { readFileSync } from 'fs'
const electoralSystems = JSON.parse(readFileSync('src/data/electoral-systems.json', 'utf8'))
const cubaEntry = electoralSystems['Q241']
if (cubaEntry?.electionTypeToShow === 'none') {
  console.log(`  ✓ Cuba está en electoral-systems.json como "none"`)
  console.log(`    note: "${cubaEntry.note}"`)
  console.log(`  → El hook retornará fallback editorial sin lanzar ninguna query SPARQL.`)
} else {
  console.log('  ✗ Cuba NO tiene electionTypeToShow=none en electoral-systems.json — revisar.')
}
