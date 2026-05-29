const E = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0' }
async function sparql(q) {
  const r = await fetch(`${E}?query=${encodeURIComponent(q)}&format=json`, { headers: H })
  if (!r.ok) { const t = await r.text(); throw new Error(`HTTP ${r.status}: ${t.slice(0,300)}`) }
  return (await r.json()).results.bindings
}
function sep(t) { console.log(`\n${'═'.repeat(70)}\n${t}\n${'═'.repeat(70)}`) }

// ─── QUERY 1 FINAL ──────────────────────────────────────────────────────────
// Cambio clave: un solo P279* para la unión a Q40231.
// Exclusiones vía FILTER(?type NOT IN ...) — compara el tipo DIRECTO P31, no subclases.
// Esto evita los timeouts por múltiples recorridos transitivos.
// Tipos excluidos:
//   Q1128324 = European Parliament election (subclase de Q40231)
//   Q6508670 = political party leadership election (subclase de Q40231)
//   Q29048322 = by-election (subclase de Q40231)  ← añadido preventivamente
function q1(qid) {
  return `
SELECT ?election ?electionLabel ?date ?esSlug ?enSlug WHERE {
  {
    SELECT DISTINCT ?election ?date WHERE {
      ?election wdt:P31 ?type ;
                wdt:P17 wd:${qid} ;
                wdt:P1001 wd:${qid} ;
                wdt:P585 ?date .
      ?type wdt:P279* wd:Q40231 .
      FILTER(?date < NOW())
      FILTER(?type NOT IN (wd:Q1128324, wd:Q6508670, wd:Q29048322))
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
    const es   = b.esSlug?.value ? `es:${decodeURIComponent(b.esSlug.value).slice(0,55)}` : '(sin es-wiki)'
    const en   = b.enSlug?.value ? `en:${decodeURIComponent(b.enSlug.value).slice(0,55)}` : '(sin en-wiki)'
    console.log(`  ${qid?.padEnd(14)} ${date}  "${lbl}"`)
    console.log(`               ${es}`)
    console.log(`               ${en}`)
  }
}

function printQ2(rows) {
  if (!rows.length) { console.log('  ⚠ (vacío) → Capa B'); return }
  const hasVotes = rows.some(b => b.votes)
  const hasPct   = rows.some(b => b.pct)
  const hasSeats = rows.some(b => b.seats)
  console.log(`  ${rows.length} participantes  |  votos: ${hasVotes}  |  %: ${hasPct}  |  escaños: ${hasSeats}`)
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

async function testCountry(label, qid) {
  sep(label)
  console.log('\n── Query 1')
  const q1rows = await sparql(q1(qid))
  printQ1(q1rows)
  if (!q1rows[0]) return
  const topQid = q1rows[0].election.value.split('/entity/')[1]
  const date   = q1rows[0].date.value.slice(0,10)
  console.log(`\n── Query 2 — ${topQid} (${date})`)
  printQ2(await sparql(q2(topQid)))
}

await testCountry('ESPAÑA (Q29)',       'Q29')
await testCountry('ALBANIA (Q222)',     'Q222')
await testCountry('ALEMANIA (Q183)',    'Q183')
await testCountry('REINO UNIDO (Q145)', 'Q145')
