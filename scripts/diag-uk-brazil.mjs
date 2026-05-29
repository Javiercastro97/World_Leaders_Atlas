// Diagnostic: UK B-2 regression + Brazil P361 parent
// Run: node scripts/diag-uk-brazil.mjs

const EP = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }

async function sparql(q) {
  const r = await fetch(EP, { method: 'POST', headers: H, body: 'query=' + encodeURIComponent(q), signal: AbortSignal.timeout(15000) })
  return r.json()
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchWT(title, lang) {
  const params = new URLSearchParams({
    action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
    format: 'json', rvsection: '0', redirects: '1', titles: title,
  })
  const url = `https://${lang}.wikipedia.org/w/api.php?${params}`
  const r = await fetch(url, { headers: { 'User-Agent': 'AtlasPolitico/1.0' }, signal: AbortSignal.timeout(12000) })
  const d = await r.json()
  const pages = Object.values(d.query?.pages ?? {})
  const pg = pages[0]
  return {
    wikitext: pg?.revisions?.[0]?.slots?.main?.['*'] ?? null,
    missing: pg?.missing !== undefined,
    resolvedTitle: pg?.title,
  }
}

function extractBlock(w, start) {
  let depth = 0, i = start, end = -1
  while (i < w.length) {
    if (w[i] === '{' && w[i + 1] === '{') { depth++; i += 2 }
    else if (w[i] === '}' && w[i + 1] === '}') { depth--; if (depth === 0) { end = i + 2; break }; i += 2 }
    else i++
  }
  return end > 0 ? w.slice(start, end) : w.slice(start, start + 4000)
}

function parsePairs(block) {
  const map = new Map()
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*\|\s*([\wÀ-ɏ]+)\s*=\s*(.*)/)
    if (m) map.set(m[1].trim(), m[2].trim())
  }
  return map
}

function stripMarkup(raw) {
  return raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref[^>]*\/>/gi, '')
    .replace(/\{\{efn[^}]*\}\}/gi, '').replace(/\{\{[^|}]+\|[^}]*\}\}/g, '')
    .replace(/'{2,3}/g, '').replace(/<br\s*\/?>/gi, ' ')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1').trim()
}

// ── DIAGNÓSTICO 1: UK ─────────────────────────────────────────────────────────

console.log('=== DIAGNÓSTICO 1: UK 2024 ===\n')

const { wikitext: ukWT, missing: ukMissing, resolvedTitle: ukTitle } =
  await fetchWT('Elecciones generales del Reino Unido de 2024', 'es')

console.log('Missing:', ukMissing)
console.log('Resolved title:', ukTitle)
console.log('Wikitext length (section 0, redirects=1):', ukWT?.length ?? 'null')

if (ukWT) {
  const hasFicha = ukWT.includes('{{Ficha') || ukWT.includes('{{ficha')
  console.log('Has {{Ficha de elección}}:', hasFicha)
  if (hasFicha) {
    const idx = ukWT.indexOf('{{Ficha')
    const block = extractBlock(ukWT, idx)
    const pairs = parsePairs(block)
    let partyCount = 0
    for (let n = 1; n <= 30; n++) {
      const nameRaw = pairs.get(`partido${n}`) ?? pairs.get(`candidato${n}`)
      if (nameRaw === undefined || nameRaw === '') break
      const name = stripMarkup(nameRaw)
      const pct = pairs.get(`porcentaje${n}`)
      const votes = pairs.get(`votos${n}`)
      const seats = pairs.get(`diputados${n}`) ?? pairs.get(`escaños${n}`)
      if (!name || (pct === undefined && votes === undefined && seats === undefined)) continue
      partyCount++
      console.log(`  ${partyCount}: ${name.slice(0, 35).padEnd(35)} pct=${(pct ?? 'null').padEnd(6)} votos=${(votes ?? 'null').slice(0, 15)}`)
    }
    console.log(`Total partidos extraídos: ${partyCount}`)
    console.log(`participación: ${pairs.get('participación') ?? pairs.get('participacion') ?? 'null'}`)
  }
}

await sleep(2000)

// ── DIAGNÓSTICO 2: Brasil P361 parent ────────────────────────────────────────

console.log('\n=== DIAGNÓSTICO 2: Brasil 2022 Wikidata relationships ===\n')

const r1 = await sparql(`SELECT ?parent ?parentLabel ?esSlug ?enSlug ?date ?typeLabel WHERE {
  wd:Q83975602 wdt:P361 ?parent .
  OPTIONAL { ?esA schema:about ?parent ; schema:isPartOf <https://es.wikipedia.org/> ; schema:name ?esSlug . }
  OPTIONAL { ?enA schema:about ?parent ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enSlug . }
  OPTIONAL { ?parent wdt:P585 ?date . }
  OPTIONAL { ?parent wdt:P31 ?t . ?t rdfs:label ?typeLabel . FILTER(LANG(?typeLabel)='en') }
  SERVICE wikibase:label { bd:serviceParam wikibase:language 'es,en'. }
}`)

console.log('Q83975602 (presidential item) P361 = "part of":')
for (const b of r1.results.bindings) {
  console.log(' QID:', b.parent?.value?.split('/').pop(), '|', b.parentLabel?.value)
  console.log('  type:', b.typeLabel?.value)
  console.log('  date:', b.date?.value?.slice(0, 10))
  console.log('  esSlug:', b.esSlug?.value ?? 'NONE')
  console.log('  enSlug:', b.enSlug?.value ?? 'NONE')
}

await sleep(2000)

// Also check: what does the general query (Q40231 + prec>=10) return for Brazil?
const r2 = await sparql(`SELECT ?election ?electionLabel ?date ?esSlug ?enSlug WHERE {
  { SELECT DISTINCT ?election ?date WHERE {
      ?election wdt:P31 ?t ; wdt:P1001 wd:Q155 ;
                p:P585 ?ds . ?ds psv:P585 ?dv .
                ?dv wikibase:timeValue ?date ; wikibase:timePrecision ?prec .
      ?t wdt:P279* wd:Q40231 .
      FILTER(?t NOT IN (wd:Q1128324, wd:Q6508670)) FILTER(?date < NOW()) FILTER(?prec >= 10)
    } ORDER BY DESC(?date) LIMIT 5 }
  OPTIONAL { ?esA schema:about ?election ; schema:isPartOf <https://es.wikipedia.org/> ; schema:name ?esSlug . }
  OPTIONAL { ?enA schema:about ?election ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enSlug . }
  FILTER(BOUND(?esSlug) || BOUND(?enSlug))
  SERVICE wikibase:label { bd:serviceParam wikibase:language 'es,en'. }
} ORDER BY DESC(?date) LIMIT 3`)

console.log('\nBrasil via Q40231 general query (for comparison):')
for (const b of r2.results.bindings) {
  console.log(' ', b.date?.value?.slice(0, 10), b.electionLabel?.value)
  console.log('   esSlug:', b.esSlug?.value ?? 'NONE', '| enSlug:', b.enSlug?.value ?? 'NONE')
}

console.log('\nDone.')
