const E = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0' }
async function sparql(q) {
  const r = await fetch(`${E}?query=${encodeURIComponent(q)}&format=json`, { headers: H })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()).results.bindings
}
function sep(t) { console.log(`\n${'═'.repeat(70)}\n${t}\n${'═'.repeat(70)}`) }

// Buscar elecciones con P710 que tengan datos numéricos, para cualquier país
// ¿Existe alguien con datos en Capa A?
sep('¿Qué elecciones en Wikidata SÍ tienen P710 con votos/% estructurados?')
const sampleQ = `
SELECT DISTINCT ?election ?electionLabel ?country ?countryLabel ?date WHERE {
  ?election p:P710 ?stmt .
  ?stmt pq:P1111 ?votes .
  ?election wdt:P585 ?date .
  OPTIONAL { ?election wdt:P17 ?country }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?date)
LIMIT 20`
const sample = await sparql(sampleQ)
console.log(`  ${sample.length} elecciones con P710+P1111 (votos) en Wikidata`)
for (const b of sample) {
  const qid   = b.election?.value?.split('/entity/')[1]?.padEnd(14)
  const date  = b.date?.value?.slice(0,10)
  const lbl   = b.electionLabel?.value?.slice(0,40)?.padEnd(40)
  const cntry = b.countryLabel?.value ?? '?'
  console.log(`  ${qid} ${date}  ${lbl}  [${cntry}]`)
}

// España: elecciones históricas con P710
sep('Elecciones históricas de España — ¿cuáles tienen P710 con datos?')
const espHistQ = `
SELECT ?election ?electionLabel ?date ?hasData WHERE {
  ?election wdt:P31 ?type ;
            wdt:P17 wd:Q29 ;
            wdt:P1001 wd:Q29 ;
            wdt:P585 ?date .
  ?type wdt:P279* wd:Q40231 .
  FILTER(?date < NOW())
  BIND(EXISTS { ?election p:P710 ?s . ?s pq:P1111 ?v } AS ?hasData)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?date)
LIMIT 15`
const espHist = await sparql(espHistQ)
for (const b of espHist) {
  const qid  = b.election?.value?.split('/entity/')[1]?.padEnd(14)
  const date = b.date?.value?.slice(0,10)
  const lbl  = b.electionLabel?.value?.slice(0,45)?.padEnd(45)
  const has  = b.hasData?.value === 'true' ? '✓ P710+votos' : '✗ sin datos'
  console.log(`  ${qid} ${date}  ${lbl}  ${has}`)
}

// Francia: ¿tiene alguna elección con datos? Se mencionó en el brief
sep('Elecciones de Francia (Q142) con P710+votos')
const fraQ = `
SELECT ?election ?electionLabel ?date WHERE {
  ?election wdt:P31 ?type ;
            wdt:P17 wd:Q142 ;
            wdt:P1001 wd:Q142 ;
            wdt:P585 ?date .
  ?type wdt:P279* wd:Q40231 .
  ?election p:P710 ?s . ?s pq:P1111 ?v .
  FILTER(?date < NOW())
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?date)
LIMIT 5`
const fra = await sparql(fraQ)
if (!fra.length) console.log('  (ninguna — Francia también va por Capa B)')
else fra.forEach(b => console.log(`  ${b.election?.value?.split('/entity/')[1]?.padEnd(14)} ${b.date?.value?.slice(0,10)}  "${b.electionLabel?.value}"`))

// Alemania: igual
sep('Elecciones de Alemania (Q183) con P710+votos')
const deQ = `
SELECT ?election ?electionLabel ?date WHERE {
  ?election wdt:P31 ?type ;
            wdt:P17 wd:Q183 ;
            wdt:P1001 wd:Q183 ;
            wdt:P585 ?date .
  ?type wdt:P279* wd:Q40231 .
  ?election p:P710 ?s . ?s pq:P1111 ?v .
  FILTER(?date < NOW())
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(?date)
LIMIT 5`
const de = await sparql(deQ)
if (!de.length) console.log('  (ninguna)')
else de.forEach(b => console.log(`  ${b.election?.value?.split('/entity/')[1]?.padEnd(14)} ${b.date?.value?.slice(0,10)}  "${b.electionLabel?.value}"`))

// Muestra global: ¿cuántas elecciones totales tienen datos P710 vs cuántas no?
sep('Muestra global: ratio de elecciones con datos P710+pct vs sin datos (últimos 10 años)')
const ratioQ = `
SELECT (COUNT(DISTINCT ?election) AS ?total) WHERE {
  ?election wdt:P31 ?type ;
            wdt:P585 ?date .
  ?type wdt:P279* wd:Q40231 .
  FILTER(?date > "2015-01-01"^^xsd:dateTime && ?date < NOW())
}`
const ratioWith = `
SELECT (COUNT(DISTINCT ?election) AS ?total) WHERE {
  ?election wdt:P31 ?type ;
            wdt:P585 ?date .
  ?type wdt:P279* wd:Q40231 .
  FILTER(?date > "2015-01-01"^^xsd:dateTime && ?date < NOW())
  ?election p:P710 ?s . ?s pq:P1107 ?pct .
}`
const [rTotal, rWith] = await Promise.all([sparql(ratioQ), sparql(ratioWith)])
console.log(`  Elecciones 2015-2025 totales: ${rTotal[0]?.total?.value ?? '?'}`)
console.log(`  Con P710+% (Capa A viable):   ${rWith[0]?.total?.value ?? '?'}`)
