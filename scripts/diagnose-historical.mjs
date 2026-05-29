const E = 'https://query.wikidata.org/sparql'
const H = { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AtlasPolitico/1.0' }

// Query 1: confirm Alto Volta and Belarus RSS have P576
const Q1 = `
SELECT ?country ?countryLabel ?iso3 ?dissolved WHERE {
  VALUES ?country { wd:Q265 wd:Q192180 }
  ?country wdt:P298 ?iso3 .
  OPTIONAL { ?country wdt:P576 ?dissolved }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}`

// Query 2: all entities with P298 + P299 + P576 (historical states in the dataset)
const Q2 = `
SELECT ?country ?countryLabel ?iso3 ?numericCode ?dissolved WHERE {
  ?country wdt:P298 ?iso3 ;
           wdt:P299 ?numericCode ;
           wdt:P576 ?dissolved .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY ?numericCode`

async function run(label, query) {
  const r = await fetch(`${E}?query=${encodeURIComponent(query)}&format=json`, { headers: H })
  const d = await r.json()
  console.log(`\n${'─'.repeat(70)}`)
  console.log(label)
  console.log('─'.repeat(70))
  const rows = d.results.bindings
  if (rows.length === 0) { console.log('(sin resultados)'); return }
  for (const b of rows) {
    const qid       = b.country?.value?.split('/entity/')[1] ?? '?'
    const label2    = b.countryLabel?.value ?? '(sin label)'
    const iso3      = b.iso3?.value ?? '?'
    const numeric   = b.numericCode?.value ?? '?'
    const dissolved = b.dissolved?.value?.slice(0, 10) ?? '(sin P576)'
    console.log(`  ${qid.padEnd(10)} | ${label2.padEnd(45)} | ISO3: ${iso3} | num: ${numeric.padEnd(4)} | disuelta: ${dissolved}`)
  }
  console.log(`\nTotal: ${rows.length} entradas`)
}

await run('QUERY 1 — Confirmación Q265 (Alto Volta) y Q192180 (RSS Bielorrusia)', Q1)
await run('QUERY 2 — Todas las entidades históricas con P298+P299+P576', Q2)
