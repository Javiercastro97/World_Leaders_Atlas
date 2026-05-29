// Diagnostic: check actual P122 labels for the 5 critical countries
// Run: node scripts/diag-p122.mjs

const ENDPOINT = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }

async function sparql(q) {
  const r = await fetch(ENDPOINT, { method:'POST', headers:H, body:`query=${encodeURIComponent(q)}`, signal:AbortSignal.timeout(20000) })
  return r.json()
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function checkP122(label, qid) {
  await sleep(1500)
  const res = await sparql(`SELECT ?cgLabel WHERE {
    wd:${qid} wdt:P122 ?cg .
    ?cg rdfs:label ?cgLabel .
    FILTER(LANG(?cgLabel) IN ("es","en"))
  }`)
  const labels = res.results.bindings.map(b => b.cgLabel?.value).filter(Boolean)
  console.log(`\n${label} (${qid}): ${labels.length} P122 labels`)
  labels.forEach(l => console.log(`  - "${l}"`))
}

// Also check what types the most recent elections have
async function checkElectionTypes(label, qid) {
  await sleep(1500)
  const res = await sparql(`SELECT ?election ?electionLabel ?typeLabel ?date WHERE {
    ?election wdt:P31 ?type ; wdt:P1001 wd:${qid} ; wdt:P585 ?date .
    ?type wdt:P279* wd:Q40231 .
    FILTER(?date > "2020-01-01"^^xsd:dateTime)
    FILTER(?date < NOW())
    ?type rdfs:label ?typeLabel .
    FILTER(LANG(?typeLabel) = "en")
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
  } ORDER BY DESC(?date) LIMIT 10`)
  const rows = res.results.bindings
  console.log(`\n${label} (${qid}): ${rows.length} recent elections (>2020):`)
  rows.forEach(b => {
    const year = (b.date?.value ?? '').slice(0, 4)
    const eName = b.electionLabel?.value ?? b.election?.value ?? '?'
    const tName = b.typeLabel?.value ?? '?'
    console.log(`  ${year}  type="${tName}"  "${eName}"`)
  })
}

console.log('=== P122 labels ===')
await checkP122('EE.UU.', 'Q30')
await checkP122('Argentina', 'Q414')
await checkP122('Francia', 'Q142')
await checkP122('Brasil', 'Q155')

console.log('\n\n=== Recent election types ===')
await checkElectionTypes('EE.UU.', 'Q30')
await checkElectionTypes('Brasil', 'Q155')
await checkElectionTypes('Francia', 'Q142')

console.log('\nDone.')
