// Diagnóstico: ver TODOS los claims P35 y P6 activos/históricos para Venezuela y China
const ENDPOINT = 'https://query.wikidata.org/sparql'
const HEADERS = {
  'Accept': 'application/sparql-results+json',
  'User-Agent': 'AtlasPolitico/1.0',
}

async function run(label, query) {
  process.stdout.write(`\n${'─'.repeat(60)}\n${label}\n${'─'.repeat(60)}\n`)
  const res = await fetch(
    `${ENDPOINT}?query=${encodeURIComponent(query)}&format=json`,
    { headers: HEADERS }
  )
  if (!res.ok) { process.stdout.write(`ERROR ${res.status}\n`); return }
  const data = await res.json()
  const rows = data.results.bindings
  if (rows.length === 0) { process.stdout.write('(sin resultados)\n'); return }
  for (const r of rows) {
    const id    = r.leader?.value?.split('/entity/')[1] ?? '?'
    const name  = r.leaderLabel?.value ?? '(sin label)'
    const start = r.start?.value?.slice(0,10) ?? '—'
    const end   = r.end?.value?.slice(0,10)   ?? 'ACTIVO'
    process.stdout.write(`  ${id.padEnd(12)} | ${name.padEnd(30)} | inicio: ${start} | fin: ${end}\n`)
  }
}

const VEN_P35 = `
SELECT ?leader ?leaderLabel ?start ?end WHERE {
  wd:Q717 p:P35 ?s .
  ?s ps:P35 ?leader .
  OPTIONAL { ?s pq:P580 ?start }
  OPTIONAL { ?s pq:P582 ?end }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
} ORDER BY DESC(?start)`

const VEN_P6 = `
SELECT ?leader ?leaderLabel ?start ?end WHERE {
  wd:Q717 p:P6 ?s .
  ?s ps:P6 ?leader .
  OPTIONAL { ?s pq:P580 ?start }
  OPTIONAL { ?s pq:P582 ?end }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
} ORDER BY DESC(?start)`

const CHN_P35 = `
SELECT ?leader ?leaderLabel ?start ?end WHERE {
  wd:Q148 p:P35 ?s .
  ?s ps:P35 ?leader .
  OPTIONAL { ?s pq:P580 ?start }
  OPTIONAL { ?s pq:P582 ?end }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
} ORDER BY DESC(?start)`

const CHN_P6 = `
SELECT ?leader ?leaderLabel ?start ?end WHERE {
  wd:Q148 p:P6 ?s .
  ?s ps:P6 ?leader .
  OPTIONAL { ?s pq:P580 ?start }
  OPTIONAL { ?s pq:P582 ?end }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
} ORDER BY DESC(?start)`

await run('Venezuela (Q717) — P35 (jefe de estado)', VEN_P35)
await run('Venezuela (Q717) — P6  (jefe de gobierno)', VEN_P6)
await run('China      (Q148) — P35 (jefe de estado)', CHN_P35)
await run('China      (Q148) — P6  (jefe de gobierno)', CHN_P6)
