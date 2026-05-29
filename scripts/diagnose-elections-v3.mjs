const E = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0' }
async function sparql(q) {
  const r = await fetch(`${E}?query=${encodeURIComponent(q)}&format=json`, { headers: H })
  return (await r.json()).results.bindings
}
function sep(t) { console.log(`\n${'═'.repeat(70)}\n${t}\n${'═'.repeat(70)}`) }
function sub(t) { console.log(`\n── ${t}`) }

// ─── DIAGNÓSTICO 1: ¿qué P31 tienen la elección EP de España y la de liderazgo de UK? ──
sep('P31 types — EP España (Q123431962) + Liderazgo Conservador UK (Q114774987)')
const typeQ = `
SELECT ?item ?itemLabel ?type ?typeLabel WHERE {
  VALUES ?item { wd:Q123431962 wd:Q114774987 }
  ?item wdt:P31 ?type .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}`
const types = await sparql(typeQ)
for (const b of types) {
  const item = b.item.value.split('/entity/')[1]
  const itemL = b.itemLabel?.value ?? '?'
  const type  = b.type.value.split('/entity/')[1]
  const typeL = b.typeLabel?.value ?? '?'
  console.log(`  ${item.padEnd(14)} "${itemL.slice(0,35).padEnd(35)}" → P31 = ${type.padEnd(14)} "${typeL}"`)
}

// ─── DIAGNÓSTICO 2: ¿Q40260 (EP election) es subclase de Q40231 (election)? ──
sep('¿Q40260 (European Parliament election) sube a Q40231 por P279*?')
const subclassQ = `
ASK { wd:Q40260 wdt:P279* wd:Q40231 }`
const r2 = await fetch(`${E}?query=${encodeURIComponent(subclassQ)}&format=json`, { headers: H })
const d2 = await r2.json()
console.log('  Resultado ASK:', d2.boolean, '— si true, Q40260 ∈ subclase de Q40231 → hay que excluirlo explícitamente')

// ─── DIAGNÓSTICO 3: Query corregida final con DISTINCT + exclusión EP + exclusión leadership ──
sep('ESPAÑA — Query 1 final (DISTINCT + sin EP + sin leadership)')

function q1Final(qid) {
  return `
SELECT DISTINCT ?election ?electionLabel (MAX(?date) AS ?date) ?esSlug ?enSlug WHERE {
  ?election wdt:P31/wdt:P279* wd:Q40231 ;
            wdt:P17 wd:${qid} ;
            wdt:P1001 wd:${qid} ;
            wdt:P585 ?date .
  FILTER(?date < NOW())
  FILTER NOT EXISTS { ?election wdt:P31/wdt:P279* wd:Q40260 }
  FILTER NOT EXISTS { ?election wdt:P31/wdt:P279* wd:Q1076518 }
  OPTIONAL {
    ?esArt schema:about ?election ; schema:isPartOf <https://es.wikipedia.org/> .
    BIND(REPLACE(STR(?esArt), "https://es.wikipedia.org/wiki/", "") AS ?esSlug)
  }
  OPTIONAL {
    ?enArt schema:about ?election ; schema:isPartOf <https://en.wikipedia.org/> .
    BIND(REPLACE(STR(?enArt), "https://en.wikipedia.org/wiki/", "") AS ?enSlug)
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
GROUP BY ?election ?electionLabel ?esSlug ?enSlug
ORDER BY DESC(?date)
LIMIT 3`.trim()
}

const espFinal = await sparql(q1Final('Q29'))
for (const b of espFinal) {
  const qid  = b.election?.value?.split('/entity/')[1]
  const date = b.date?.value?.slice(0,10)
  const lbl  = b.electionLabel?.value ?? '?'
  const es   = b.esSlug?.value ? `es:${decodeURIComponent(b.esSlug.value)}` : '(sin es-wiki)'
  const en   = b.enSlug?.value ? `en:${decodeURIComponent(b.enSlug.value)}` : '(sin en-wiki)'
  console.log(`  ${qid?.padEnd(14)} ${date}  "${lbl}"`)
  console.log(`               ${es}`)
  console.log(`               ${en}`)
}

sep('REINO UNIDO — Query 1 final')
const ukFinal = await sparql(q1Final('Q145'))
for (const b of ukFinal) {
  const qid  = b.election?.value?.split('/entity/')[1]
  const date = b.date?.value?.slice(0,10)
  const lbl  = b.electionLabel?.value ?? '?'
  console.log(`  ${qid?.padEnd(14)} ${date}  "${lbl}"`)
}

sep('ALEMANIA — Query 1 final')
const deFinal = await sparql(q1Final('Q183'))
for (const b of deFinal) {
  console.log(`  ${b.election?.value?.split('/entity/')[1]?.padEnd(14)} ${b.date?.value?.slice(0,10)}  "${b.electionLabel?.value}"`)
}

// ─── DIAGNÓSTICO 4: Query 2 sobre elecciones conocidas ───────────────────────
sep('Query 2 — resultados estructurados: España 2023 (Q84082018)')
function q2(elQid) {
  return `
SELECT ?party ?partyLabel ?partyColor ?votes ?pct ?seats WHERE {
  wd:${elQid} p:P710 ?stmt .
  ?stmt ps:P710 ?party .
  OPTIONAL { ?stmt pq:P1111 ?votes }
  OPTIONAL { ?stmt pq:P1107 ?pct }
  OPTIONAL { ?stmt pq:P1410 ?seats }
  OPTIONAL { ?party wdt:P465 ?partyColor }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?pct) DESC(?votes)`.trim()
}
const espData = await sparql(q2('Q84082018'))
console.log(`  ${espData.length} participantes`)
for (const b of espData.slice(0,8)) {
  const raw  = b.pct?.value
  const pct  = raw ? (parseFloat(raw) <= 1 ? (parseFloat(raw)*100).toFixed(2) : parseFloat(raw).toFixed(2)) : null
  const name = (b.partyLabel?.value ?? '?').slice(0,38).padEnd(38)
  const pStr = pct ? `${pct}%`.padStart(8) : '       ?'
  const vStr = b.votes ? (+b.votes.value).toLocaleString('es-ES').padStart(13) : '            ?'
  const sStr = b.seats?.value?.padStart(4) ?? '   ?'
  const col  = b.partyColor?.value ? `#${b.partyColor.value}` : ''
  console.log(`  ${name}${pStr}  ${vStr}  esc:${sStr}  ${col}`)
}

sub('Query 2 — Alemania 2025 (Q108761711)')
const deData = await sparql(q2('Q108761711'))
console.log(`  ${deData.length} participantes`)
for (const b of deData.slice(0,8)) {
  const raw  = b.pct?.value
  const pct  = raw ? (parseFloat(raw) <= 1 ? (parseFloat(raw)*100).toFixed(2) : parseFloat(raw).toFixed(2)) : null
  const name = (b.partyLabel?.value ?? '?').slice(0,38).padEnd(38)
  const pStr = pct ? `${pct}%`.padStart(8) : '       ?'
  console.log(`  ${name}${pStr}`)
}

sub('Query 2 — Albania 2025 (Q106625095) — esperamos vacío → Capa B')
const albData = await sparql(q2('Q106625095'))
if (!albData.length) console.log('  (vacío) ✓ → Capa B se activaría')
else console.log(`  ${albData.length} participantes inesperados`)
