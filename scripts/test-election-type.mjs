// Test FIX 2: parliament-exclusion strategy for election type selection
// Run: node scripts/test-election-type.mjs

const ENDPOINT = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }

async function sparql(q) {
  const r = await fetch(ENDPOINT, { method:'POST', headers:H, body:`query=${encodeURIComponent(q)}`, signal:AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`SPARQL ${r.status}: ${await r.text().then(t => t.slice(0,100))}`)
  return r.json()
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// === Mirrors src/hooks/useWikidataElection.ts logic exactly ===

function buildGeneral(qid) {
  return `SELECT ?election ?electionLabel ?date ?esSlug ?enSlug WHERE {
  { SELECT DISTINCT ?election ?date WHERE {
      ?election wdt:P31 ?type ; wdt:P1001 wd:${qid} ; wdt:P585 ?date .
      ?type wdt:P279* wd:Q40231 .
      FILTER(?type NOT IN (wd:Q1128324, wd:Q6508670))
      FILTER(?date < NOW())
    } ORDER BY DESC(?date) LIMIT 5 }
  OPTIONAL { ?esA schema:about ?election ; schema:isPartOf <https://es.wikipedia.org/> ; schema:name ?esSlug . }
  OPTIONAL { ?enA schema:about ?election ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enSlug . }
  FILTER(BOUND(?esSlug) || BOUND(?enSlug))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
} ORDER BY DESC(?date) LIMIT 1`
}

function buildPresidential(qid) {
  return `SELECT ?election ?electionLabel ?date ?esSlug ?enSlug WHERE {
  { SELECT DISTINCT ?election ?date WHERE {
      ?election wdt:P31 ?type ; wdt:P1001 wd:${qid} ; wdt:P585 ?date .
      ?type wdt:P279* wd:Q858439 .
      FILTER(?type NOT IN (wd:Q1128324, wd:Q6508670))
      FILTER(?date < NOW())
    } ORDER BY DESC(?date) LIMIT 5 }
  OPTIONAL { ?esA schema:about ?election ; schema:isPartOf <https://es.wikipedia.org/> ; schema:name ?esSlug . }
  OPTIONAL { ?enA schema:about ?election ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enSlug . }
  FILTER(BOUND(?esSlug) || BOUND(?enSlug))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
} ORDER BY DESC(?date) LIMIT 1`
}

function buildGovType(qid) {
  return `SELECT (GROUP_CONCAT(DISTINCT ?cgLabel; SEPARATOR=" | ") AS ?allGovForms)
WHERE {
  OPTIONAL {
    wd:${qid} wdt:P122 ?cg .
    ?cg rdfs:label ?cgLabel .
    FILTER(LANG(?cgLabel) IN ("es","en"))
  }
}`
}

function isParliamentarySystem(label) {
  const l = label.toLowerCase()
  return /parlamentar[io]|parliamentary/.test(l)
    || /monarquía constitucional|constitutional monarchy/.test(l)
}

async function test(label, qid, expectedYear) {
  await sleep(2000)
  process.stdout.write(`${label.padEnd(12)} (${qid}): `)
  try {
    const [govRes, baseRes] = await Promise.all([sparql(buildGovType(qid)), sparql(buildGeneral(qid))])
    const govForms = govRes.results.bindings[0]?.allGovForms?.value ?? ''
    const parliamentary = isParliamentarySystem(govForms)
    process.stdout.write(`parl=${String(parliamentary).padEnd(5)}  `)

    let b = baseRes.results.bindings[0]
    let source = 'general'

    if (!parliamentary) {
      await sleep(500)
      const presRes = await sparql(buildPresidential(qid))
      const presB = presRes.results.bindings[0]
      if (presB?.election) { b = presB; source = 'PRESIDENTIAL' }
      else source = 'general(pres-empty)'
    }

    if (!b?.election) { console.log('NO RESULT'); return }

    const year = (b.date?.value ?? '').replace(/^\+/, '').slice(0, 4)
    const name = b.electionLabel?.value ?? '?'
    const ok = expectedYear ? (String(year) === String(expectedYear) ? '✓' : `✗ (expected ${expectedYear})`) : ''
    console.log(`[${source.padEnd(18)}] ${year}  ${ok}  "${name}"`)
    if (govForms) process.stdout.write(`  P122: "${govForms.slice(0, 90)}"\n`)
  } catch(e) { console.log(`ERROR: ${e.message}`) }
}

console.log('FIX 2 final verification — parliament-exclusion strategy')
console.log()

await test('EE.UU.',    'Q30',  2024)
await test('Brasil',    'Q155', 2022)
await test('Mexico',    'Q96',  2024)
await test('Argentina', 'Q414', 2023)
await test('Francia',   'Q142', 2022)
await test('Espana',    'Q29',  2023)
await test('UK',        'Q145', 2024)
await test('Alemania',  'Q183', 2025)

console.log('\nDone.')
