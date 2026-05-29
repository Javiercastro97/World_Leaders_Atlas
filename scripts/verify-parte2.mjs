// Verification script for PARTE 2 refactor
// Mirrors the new useWikidataElection.ts logic exactly.
// Run: node scripts/verify-parte2.mjs

import { readFileSync } from 'fs'
const electoralSystems = JSON.parse(readFileSync('src/data/electoral-systems.json', 'utf8'))

const ENDPOINT = 'https://query.wikidata.org/sparql'
const H = {
  'Accept': 'application/sparql-results+json',
  'User-Agent': 'AtlasPolitico/1.0',
  'Content-Type': 'application/x-www-form-urlencoded',
}

async function sparql(q) {
  const r = await fetch(ENDPOINT, {
    method: 'POST', headers: H,
    body: `query=${encodeURIComponent(q)}`,
    signal: AbortSignal.timeout(20000),
  })
  if (!r.ok) throw new Error(`SPARQL ${r.status}`)
  return r.json()
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function buildElectionQuery(qid) {
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

function buildPresidentialElectionQuery(qid) {
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

function buildLegislativeElectionQuery(qid) {
  return `SELECT ?election ?electionLabel ?date ?esSlug ?enSlug WHERE {
  { SELECT DISTINCT ?election ?date WHERE {
      ?election wdt:P31 ?type ; wdt:P1001 wd:${qid} ; wdt:P585 ?date .
      ?type wdt:P279* wd:Q40222 .
      FILTER(?type NOT IN (wd:Q1128324, wd:Q6508670))
      FILTER(?date < NOW())
    } ORDER BY DESC(?date) LIMIT 5 }
  OPTIONAL { ?esA schema:about ?election ; schema:isPartOf <https://es.wikipedia.org/> ; schema:name ?esSlug . }
  OPTIONAL { ?enA schema:about ?election ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enSlug . }
  FILTER(BOUND(?esSlug) || BOUND(?enSlug))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
} ORDER BY DESC(?date) LIMIT 1`
}

async function test(label, qid, expectedYear) {
  await sleep(2500)
  const entry = electoralSystems[qid]
  const electionType = entry?.electionTypeToShow ?? 'general (sin clasificar)'

  // Capa C-a: none → fallback editorial inmediato
  if (entry?.electionTypeToShow === 'none') {
    console.log(`${label.padEnd(12)} (${qid}) [C-a / none]  → fallback editorial: "${entry.note.slice(0, 70)}"`)
    return
  }

  const buildQuery =
    electionType === 'presidential' ? buildPresidentialElectionQuery :
    electionType === 'legislative'  ? buildLegislativeElectionQuery  :
                                      buildElectionQuery

  try {
    let res = await sparql(buildQuery(qid))
    let b = res.results.bindings[0]
    let usedFallback = false

    // Fallback cascade
    if (!b?.election && electionType !== 'general' && electionType !== 'general (sin clasificar)') {
      await sleep(500)
      res = await sparql(buildElectionQuery(qid))
      b = res.results.bindings[0]
      usedFallback = true
    }

    if (!b?.election) {
      console.log(`${label.padEnd(12)} (${qid}) [${electionType.padEnd(11)}]  → NO RESULT`)
      return
    }

    const year = (b.date?.value ?? '').replace(/^\+/, '').slice(0, 4)
    const name = b.electionLabel?.value ?? '?'
    const yearOk = expectedYear ? (String(year) === String(expectedYear) ? '✓' : `✗ expected ${expectedYear}`) : ''
    const fallbackTag = usedFallback ? ' [fallback→general]' : ''
    console.log(`${label.padEnd(12)} (${qid}) [${electionType.padEnd(11)}]  ${year} ${yearOk.padEnd(12)}  "${name}"${fallbackTag}`)
  } catch (e) {
    console.log(`${label.padEnd(12)} (${qid})  ERROR: ${e.message}`)
  }
}

console.log('=== PARTE 2 — Verificación de routing por electoral-systems.json ===\n')
console.log('Test 1 — Regresión (deben seguir funcionando):')
await test('España',    'Q29',  2023)
await test('UK',        'Q145', 2024)

console.log('\nTest 2 — Filtro presidencial:')
await test('EE.UU.',    'Q30',  2024)
await test('Argentina', 'Q414', 2023)
await test('Francia',   'Q142', 2022)
await test('Brasil',    'Q155', 2022)
await test('México',    'Q96',  2024)

console.log('\nTest 3 — Sistemas no triviales:')
await test('Portugal',  'Q45',  2025)
await test('Alemania',  'Q183', 2025)
await test('Sudáfrica', 'Q258', 2024)

console.log('\nTest 4 — Override editorial (none):')
await test('Cuba',      'Q241')
await test('China',     'Q148')
await test('Mali',      'Q912')

console.log('\nDone.')
