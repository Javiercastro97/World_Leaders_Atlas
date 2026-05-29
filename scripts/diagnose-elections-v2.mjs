const E = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0' }

async function sparql(query) {
  const r = await fetch(`${E}?query=${encodeURIComponent(query)}&format=json`, { headers: H })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()).results.bindings
}

function sep(t) { console.log(`\n${'═'.repeat(70)}\n${t}\n${'═'.repeat(70)}`) }
function sub(t) { console.log(`\n── ${t}`) }

// ─── QUERY 1 CORREGIDA ───────────────────────────���───────────────────────────
// Cambios vs v1:
//   + FILTER(?date < NOW())       — excluye elecciones futuras
//   + ?election wdt:P1001 wd:QID  — solo jurisdicción nacional, no regional
function q1(qid) {
  return `
SELECT ?election ?electionLabel ?date ?esSlug ?enSlug WHERE {
  ?election wdt:P31/wdt:P279* wd:Q40231 ;
            wdt:P17 wd:${qid} ;
            wdt:P1001 wd:${qid} ;
            wdt:P585 ?date .
  FILTER(?date < NOW())
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

function printQ1(rows) {
  if (!rows.length) { console.log('  (sin resultados)'); return }
  for (const b of rows) {
    const qid   = b.election?.value?.split('/entity/')[1] ?? '?'
    const label = b.electionLabel?.value ?? '(sin label)'
    const date  = b.date?.value?.slice(0,10) ?? '?'
    const es    = b.esSlug?.value ? `es:${decodeURIComponent(b.esSlug.value)}` : '(sin es-wiki)'
    const en    = b.enSlug?.value ? `en:${decodeURIComponent(b.enSlug.value)}` : '(sin en-wiki)'
    console.log(`  ${qid.padEnd(14)} ${date}  "${label}"`)
    console.log(`               ${es}`)
    console.log(`               ${en}`)
  }
}

function printQ2(rows) {
  if (!rows.length) { console.log('  (sin filas — Wikidata no tiene resultados numéricos → ir a Capa B)'); return }
  const hasVotes = rows.some(b => b.votes)
  const hasPct   = rows.some(b => b.pct)
  const hasSeats = rows.some(b => b.seats)
  console.log(`  ${rows.length} participantes  |  votos: ${hasVotes}  |  %: ${hasPct}  |  escaños: ${hasSeats}`)
  if (!hasVotes && !hasPct) {
    console.log('  ⚠ No hay datos numéricos — Capa A vacía → proceder a Capa B')
    return
  }
  console.log()
  for (const b of rows.slice(0, 12)) {
    const raw  = b.pct?.value ?? null
    // Wikidata stores % sometimes as 0-1, sometimes as 0-100
    const pct  = raw ? (parseFloat(raw) <= 1 ? (parseFloat(raw)*100).toFixed(2) : parseFloat(raw).toFixed(2)) : null
    const name  = (b.partyLabel?.value ?? b.party?.value?.split('/entity/')[1] ?? '?').slice(0,38).padEnd(38)
    const pctStr   = pct  ? `${pct}%`.padStart(8)  : '       ?'
    const votesStr = b.votes ? (+b.votes.value).toLocaleString('es-ES').padStart(13) : '            ?'
    const seatsStr = b.seats ? b.seats.value.padStart(4) : '   ?'
    const color = b.partyColor?.value ? `#${b.partyColor.value}` : ''
    console.log(`  ${name} ${pctStr}  ${votesStr}  esc:${seatsStr}  ${color}`)
  }
  if (rows.length > 12) console.log(`  ... y ${rows.length - 12} más`)
}

// ─── ESPAÑA ───────────────────────────────────────────────────────────────────
sep('ESPAÑA (Q29) — query corregida con P1001 + FILTER(date < NOW())')
sub('Query 1 — últimas 3 elecciones nacionales pasadas')
const espQ1 = await sparql(q1('Q29'))
printQ1(espQ1)

if (espQ1[0]) {
  const topQid = espQ1[0].election.value.split('/entity/')[1]
  sub(`Query 2 — resultados de ${topQid} (${espQ1[0].date.value.slice(0,10)})`)
  printQ2(await sparql(q2(topQid)))
}

// ─── ALBANIA ─────────────────────────────────────────────────────────────────
sep('ALBANIA (Q222) — query corregida')
sub('Query 1 — últimas 3 elecciones nacionales pasadas')
const albQ1 = await sparql(q1('Q222'))
printQ1(albQ1)

if (albQ1[0]) {
  const topQid = albQ1[0].election.value.split('/entity/')[1]
  sub(`Query 2 — resultados de ${topQid} (${albQ1[0].date.value.slice(0,10)})`)
  printQ2(await sparql(q2(topQid)))
}

// ─── BONUS: ALEMANIA y REINO UNIDO (controles rápidos) ───────────────────────
sep('ALEMANIA (Q183) — solo Query 1')
printQ1(await sparql(q1('Q183')))

sep('REINO UNIDO (Q145) — solo Query 1')
printQ1(await sparql(q1('Q145')))
