// Verify Parte 3: candidate extraction from both template families
// Run: node scripts/verify-parte3-candidates.mjs

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchWT(slug, lang) {
  const title = slug.replaceAll('_', ' ')
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&rvsection=0&redirects=1&titles=${encodeURIComponent(title)}`
  const r = await fetch(url, { headers: { 'User-Agent': 'AtlasPolitico/1.0' }, signal: AbortSignal.timeout(15000) })
  const d = await r.json()
  const pages = Object.values(d.query?.pages ?? {})
  return pages[0]?.revisions?.[0]?.slots?.main?.['*'] ?? null
}

function extractBlock(wt, start) {
  let depth = 0, i = start, end = -1
  while (i < wt.length) {
    if (wt[i] === '{' && wt[i+1] === '{') { depth++; i += 2 }
    else if (wt[i] === '}' && wt[i+1] === '}') { depth--; if (depth === 0) { end = i+2; break }; i += 2 }
    else i++
  }
  return end > 0 ? wt.slice(start, end) : wt.slice(start, start+4000)
}

function findTemplate(wt, ...names) {
  for (const name of names) {
    const re = new RegExp('\\{\\{\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const m = wt.match(re)
    if (!m) continue
    return extractBlock(wt, wt.indexOf(m[0]))
  }
  return null
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

function parseParties(block, lang) {
  const pairs = parsePairs(block)
  const partyKey = lang === 'es' ? 'partido' : 'party'
  const candKey  = lang === 'es' ? 'candidato' : 'candidate'
  const pctKey   = lang === 'es' ? 'porcentaje' : 'percentage'
  const parties = []
  for (let n = 1; n <= 30; n++) {
    const partyRaw = pairs.get(`${partyKey}${n}`)
    const candRaw  = pairs.get(`${candKey}${n}`)
    const nameRaw  = partyRaw ?? candRaw
    if (nameRaw === undefined || nameRaw === '') break
    const name = stripMarkup(nameRaw)
    if (!name) continue
    const candidate = (partyRaw !== undefined && partyRaw !== '' && candRaw !== undefined && candRaw !== '')
      ? stripMarkup(candRaw) || null
      : null
    const pct = parseFloat(stripMarkup(pairs.get(`${pctKey}${n}`) ?? '').replace(',', '.')) || null
    parties.push({ name, candidate, pct })
  }
  return parties
}

async function test(label, slug, lang) {
  await sleep(1500)
  const wt = await fetchWT(slug, lang)
  if (!wt) { console.log(`${label}: NO WIKITEXT`); return }
  const block = findTemplate(wt,
    'Ficha de elección', 'Ficha_de_elección', 'Ficha de elecciones',
    'Infobox election', 'Infobox Election'
  )
  if (!block) { console.log(`${label}: NO TEMPLATE FOUND`); return }
  const parties = parseParties(block, lang)
  console.log(`\n${label} (${lang}):`)
  for (const p of parties.slice(0, 6)) {
    const cand = p.candidate ? `← "${p.candidate}"` : '(sin candidato)'
    console.log(`  ${(p.pct ?? '?').toString().padStart(6)} %  ${p.name.slice(0,30).padEnd(30)}  ${cand}`)
  }
}

console.log('=== Verificación extracción de candidatos (Parte 3) ===')

await test('EE.UU. 2024',   'Elecciones presidenciales de Estados Unidos de 2024', 'es')
await test('Brasil 2022',   'Elecciones generales de Brasil de 2022',               'es')
await test('México 2024',   'Elecciones presidenciales de México de 2024',          'es')
await test('Argentina 2023','Elecciones presidenciales de Argentina de 2023',       'es')
await test('Francia 2022',  'Elecciones presidenciales de Francia de 2022',         'es')
await test('España 2023',   'Elecciones generales de España de 2023',               'es')
await test('UK 2024 (en)',  'United Kingdom general election, 2024',                'en')

console.log('\nDone.')
