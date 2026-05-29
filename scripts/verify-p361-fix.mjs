// Verification: P361 parent sitelink fallback in presidential query
// Tests 8 countries: 5 known presidential + 3 Latin American unknowns
// Run: node scripts/verify-p361-fix.mjs

const EP = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function sparql(q) {
  const r = await fetch(EP, { method: 'POST', headers: H, body: 'query=' + encodeURIComponent(q), signal: AbortSignal.timeout(20000) })
  return r.json()
}

function innerWhere(qid, typeFilter) {
  return `
      ?election wdt:P31 ?type ;
                wdt:P1001 wd:${qid} ;
                p:P585 ?dateStmt .
      ?dateStmt psv:P585 ?dateV .
      ?dateV wikibase:timeValue ?date ;
             wikibase:timePrecision ?prec .
      ${typeFilter}
      FILTER(?type NOT IN (wd:Q1128324, wd:Q6508670))
      FILTER(?date < NOW())
      FILTER(?prec >= 10)`
}

function buildPresidentialQuery(qid) {
  const inner = innerWhere(qid, '?type wdt:P279* wd:Q858439 .')
  return `
SELECT ?election ?electionLabel ?date ?esSlug ?enSlug WHERE {
  {
    SELECT DISTINCT ?election ?date WHERE {${inner}
    }
    ORDER BY DESC(?date)
    LIMIT 5
  }
  OPTIONAL {
    ?esArticle schema:about ?election ;
               schema:isPartOf <https://es.wikipedia.org/> ;
               schema:name ?esSlugDirect .
  }
  OPTIONAL {
    ?enArticle schema:about ?election ;
               schema:isPartOf <https://en.wikipedia.org/> ;
               schema:name ?enSlugDirect .
  }
  OPTIONAL {
    ?election wdt:P361 ?parentEs .
    ?esArticleP schema:about ?parentEs ;
                schema:isPartOf <https://es.wikipedia.org/> ;
                schema:name ?esSlugParent .
  }
  OPTIONAL {
    ?election wdt:P361 ?parentEn .
    ?enArticleP schema:about ?parentEn ;
                schema:isPartOf <https://en.wikipedia.org/> ;
                schema:name ?enSlugParent .
  }
  BIND(COALESCE(?esSlugDirect, ?esSlugParent) AS ?esSlug)
  BIND(COALESCE(?enSlugDirect, ?enSlugParent) AS ?enSlug)
  FILTER(BOUND(?esSlug) || BOUND(?enSlug))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?date)
LIMIT 1`.trim()
}

const COUNTRIES = [
  { label: 'Brasil',    qid: 'Q155'    },
  { label: 'EE.UU.',   qid: 'Q30'     },
  { label: 'Argentina',qid: 'Q414'    },
  { label: 'México',   qid: 'Q96'     },
  { label: 'Francia',  qid: 'Q142'    },
  { label: 'Colombia', qid: 'Q739'    },
  { label: 'Perú',     qid: 'Q419'    },
  { label: 'Ecuador',  qid: 'Q736'    },
]

console.log('=== Verificación fix P361 (presidential query con sitelink fallback) ===\n')

for (const { label, qid } of COUNTRIES) {
  await sleep(1500)
  try {
    const data = await sparql(buildPresidentialQuery(qid))
    const b = data.results.bindings[0]
    if (!b) {
      console.log(`${label.padEnd(10)} ${qid.padEnd(6)} → NO RESULT`)
      continue
    }
    const electionQid = b.election?.value?.split('/').pop()
    const date = b.date?.value?.slice(0, 10)
    const esSlug = b.esSlug?.value ?? 'NONE'
    const enSlug = b.enSlug?.value ?? 'NONE'
    const label2 = b.electionLabel?.value ?? '?'
    console.log(`${label.padEnd(10)} ${qid.padEnd(6)} → ${electionQid} | ${date}`)
    console.log(`${''.padEnd(18)}esSlug: ${esSlug}`)
    console.log(`${''.padEnd(18)}enSlug: ${enSlug}`)
    console.log(`${''.padEnd(18)}label:  ${label2}`)
  } catch (e) {
    console.log(`${label.padEnd(10)} ERROR: ${e.message}`)
  }
}

console.log('\nDone.')
