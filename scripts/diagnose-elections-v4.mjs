const E = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0' }
async function sparql(q) {
  const r = await fetch(`${E}?query=${encodeURIComponent(q)}&format=json`, { headers: H })
  if (!r.ok) { const t = await r.text(); throw new Error(`HTTP ${r.status}: ${t.slice(0,200)}`) }
  return (await r.json()).results.bindings
}
function sep(t) { console.log(`\n${'═'.repeat(70)}\n${t}\n${'═'.repeat(70)}`) }

// ─── VERIFICAR: ¿Q1128324 y Q6508670 son subclases de Q40231? ────────────────
sep('Verificar: ¿EP (Q1128324) y liderazgo (Q6508670) ∈ subclase de Q40231?')
const askEP  = await fetch(`${E}?query=${encodeURIComponent('ASK { wd:Q1128324 wdt:P279* wd:Q40231 }')}&format=json`, { headers: H })
const askLdr = await fetch(`${E}?query=${encodeURIComponent('ASK { wd:Q6508670 wdt:P279* wd:Q40231 }')}&format=json`, { headers: H })
console.log('  Q1128324 (EP election)         P279* Q40231:', (await askEP.json()).boolean)
console.log('  Q6508670 (leadership election) P279* Q40231:', (await askLdr.json()).boolean)

// ─── QUERY 1 DEFINITIVA ──────────────────────────────────────────────────────
// Usa subSELECT para deduplicar (election, date) ANTES de unir con labels y sitelinks.
// Excluye explícitamente EP elections (Q1128324) y leadership elections (Q6508670).
function q1(qid) {
  return `
SELECT ?election ?electionLabel ?date ?esSlug ?enSlug WHERE {
  {
    SELECT DISTINCT ?election ?date WHERE {
      ?election wdt:P31/wdt:P279* wd:Q40231 ;
                wdt:P17 wd:${qid} ;
                wdt:P1001 wd:${qid} ;
                wdt:P585 ?date .
      FILTER(?date < NOW())
      FILTER NOT EXISTS { ?election wdt:P31/wdt:P279* wd:Q1128324 }
      FILTER NOT EXISTS { ?election wdt:P31/wdt:P279* wd:Q6508670 }
    }
  }
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
ORDER BY DESC(?date)
LIMIT 3`.trim()
}

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

function printQ1(rows) {
  if (!rows.length) { console.log('  (sin resultados)'); return }
  for (const b of rows) {
    const qid  = b.election?.value?.split('/entity/')[1]
    const date = b.date?.value?.slice(0,10)
    const lbl  = b.electionLabel?.value ?? '?'
    const es   = b.esSlug?.value ? `es:${decodeURIComponent(b.esSlug.value).slice(0,50)}` : '(sin es-wiki)'
    const en   = b.enSlug?.value ? `en:${decodeURIComponent(b.enSlug.value).slice(0,50)}` : '(sin en-wiki)'
    console.log(`  ${qid?.padEnd(14)} ${date}  "${lbl}"`)
    console.log(`               ${es}`)
    console.log(`               ${en}`)
  }
}

function printQ2(rows) {
  if (!rows.length) { console.log('  (vacío) → Capa B'); return }
  const hasVotes = rows.some(b => b.votes)
  const hasPct   = rows.some(b => b.pct)
  const hasSeats = rows.some(b => b.seats)
  console.log(`  ${rows.length} participantes | votos: ${hasVotes} | %: ${hasPct} | escaños: ${hasSeats}`)
  for (const b of rows.slice(0, 8)) {
    const raw  = b.pct?.value
    const pct  = raw ? (parseFloat(raw) <= 1 ? (parseFloat(raw)*100).toFixed(2) : parseFloat(raw).toFixed(2)) : null
    const name = (b.partyLabel?.value ?? '?').slice(0,36).padEnd(36)
    const pStr = pct   ? `${pct}%`.padStart(8) : '       ?'
    const vStr = b.votes ? (+b.votes.value).toLocaleString('es-ES').padStart(12) : '           ?'
    const sStr = b.seats?.value?.padStart(4) ?? '   ?'
    const col  = b.partyColor?.value ? `#${b.partyColor.value}` : ''
    console.log(`  ${name}${pStr}  ${vStr}  esc:${sStr}  ${col}`)
  }
  if (rows.length > 8) console.log(`  ... y ${rows.length - 8} más`)
}

// ─── ESPAÑA ───────────────────────────────────────────────────────────────────
sep('ESPAÑA (Q29)')
console.log('\n── Query 1 final')
const espQ1 = await sparql(q1('Q29'))
printQ1(espQ1)
if (espQ1[0]) {
  const topQid = espQ1[0].election.value.split('/entity/')[1]
  const date   = espQ1[0].date.value.slice(0,10)
  console.log(`\n── Query 2 — ${topQid} (${date})`)
  printQ2(await sparql(q2(topQid)))
}

// ─── ALBANIA ─────────────────────────────────────────────────────────────────
sep('ALBANIA (Q222)')
console.log('\n── Query 1 final')
const albQ1 = await sparql(q1('Q222'))
printQ1(albQ1)
if (albQ1[0]) {
  const topQid = albQ1[0].election.value.split('/entity/')[1]
  const date   = albQ1[0].date.value.slice(0,10)
  console.log(`\n── Query 2 — ${topQid} (${date})`)
  const albQ2 = await sparql(q2(topQid))
  printQ2(albQ2)
  if (!albQ2.length && albQ1[0].esSlug) {
    console.log(`  → Wikipedia disponible: es:${decodeURIComponent(albQ1[0].esSlug.value)}`)
    console.log(`    Capa B se activaría sobre ese artículo.`)
  }
}

// ─── ALEMANIA + REINO UNIDO (controles) ──────────────────────────────────────
sep('ALEMANIA (Q183)')
console.log('\n── Query 1 final')
const deQ1 = await sparql(q1('Q183'))
printQ1(deQ1)
if (deQ1[0]) {
  const topQid = deQ1[0].election.value.split('/entity/')[1]
  console.log(`\n── Query 2 — ${topQid}`)
  printQ2(await sparql(q2(topQid)))
}

sep('REINO UNIDO (Q145)')
console.log('\n── Query 1 final')
const ukQ1 = await sparql(q1('Q145'))
printQ1(ukQ1)
if (ukQ1[0]) {
  const topQid = ukQ1[0].election.value.split('/entity/')[1]
  console.log(`\n── Query 2 — ${topQid}`)
  printQ2(await sparql(q2(topQid)))
}
