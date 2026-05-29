const E = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0' }
const OVERRIDES = new Set(['Q241', 'Q148', 'Q423', 'Q881', 'Q819'])

const COUNTRIES = [
  ['España',          'Q29'],
  ['Reino Unido',     'Q145'],
  ['Alemania',        'Q183'],
  ['Francia',         'Q142'],
  ['Argentina',       'Q414'],
  ['Cuba',            'Q241'],
  ['China',           'Q148'],
  ['Corea del Norte', 'Q423'],
  ['EE.UU.',          'Q30'],
]

function buildQuery(qid) {
  return `
SELECT
  ?gov ?govLabel ?govParty ?govPartyLabel
  ?stt ?sttLabel ?sttParty ?sttPartyLabel
  ?allGovForms
WHERE {
  OPTIONAL {
    wd:${qid} p:P6 ?govStmt .
    ?govStmt ps:P6 ?gov .
    FILTER NOT EXISTS { ?govStmt pq:P582 ?govEnd }
    ?gov wdt:P31 wd:Q5 .
    OPTIONAL {
      ?gov p:P102 ?govPartyStmt .
      ?govPartyStmt ps:P102 ?govParty .
      FILTER NOT EXISTS { ?govPartyStmt pq:P582 ?govPartyEnd }
    }
  }
  OPTIONAL {
    wd:${qid} p:P35 ?sttStmt .
    ?sttStmt ps:P35 ?stt .
    FILTER NOT EXISTS { ?sttStmt pq:P582 ?sttEnd }
    ?stt wdt:P31 wd:Q5 .
    OPTIONAL {
      ?stt p:P102 ?sttPartyStmt .
      ?sttPartyStmt ps:P102 ?sttParty .
      FILTER NOT EXISTS { ?sttPartyStmt pq:P582 ?sttPartyEnd }
    }
  }
  {
    SELECT (GROUP_CONCAT(DISTINCT ?cgLabel; SEPARATOR=" | ") AS ?allGovForms)
    WHERE {
      OPTIONAL {
        wd:${qid} wdt:P122 ?cg .
        ?cg rdfs:label ?cgLabel .
        FILTER(LANG(?cgLabel) IN ("es","en"))
      }
    }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en,de,fr,mul". }
}
LIMIT 1`.trim()
}

async function testCountry(label, qid) {
  const url = `${E}?query=${encodeURIComponent(buildQuery(qid))}&format=json`
  const r = await fetch(url, { headers: H })
  const d = await r.json()
  const b = d.results.bindings[0]

  if (!b) {
    console.log(`  ${label.padEnd(18)} | (sin datos)`)
    return
  }

  const allGovForms = b.allGovForms?.value ?? ''
  const isPresidential = /presidencial|presidential|semi.?presidential|popular|socialista|socialist|comunista|communist/i.test(allGovForms)
  const useStt = !!b.stt && (!b.gov || OVERRIDES.has(qid) || isPresidential)
  const prefix = useStt ? 'stt' : 'gov'

  const leader = b[`${prefix}Label`]?.value ?? b[prefix]?.value?.split('/entity/')[1] ?? '(vacío)'
  const party  = b[`${prefix}PartyLabel`]?.value ?? '(sin partido — mensaje editorial)'
  const via    = OVERRIDES.has(qid) ? '[override]' : isPresidential ? '[regex]' : '[P6]'

  console.log(`  ${label.padEnd(18)} ${via.padEnd(12)} líder: ${leader.padEnd(28)} partido: ${party}`)
}

// Sequential to avoid rate-limiting
for (const [label, qid] of COUNTRIES) {
  await testCountry(label, qid)
}
