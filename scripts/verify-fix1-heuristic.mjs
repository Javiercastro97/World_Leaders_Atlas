// Verification: Fix 1 (redirects=1) + composite-infobox heuristic
// Simulates the full fetch→parse pipeline for 7 countries.
// Run: node scripts/verify-fix1-heuristic.mjs

async function fetchWT(slug, lang) {
  const title = slug.replaceAll('_', ' ')
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&rvsection=0&redirects=1&titles=${encodeURIComponent(title)}`
  const r = await fetch(url, { headers: { 'User-Agent': 'AtlasPolitico/1.0' }, signal: AbortSignal.timeout(15000) })
  const d = await r.json()
  const pages = Object.values(d.query?.pages ?? {})
  return pages[0]?.revisions?.[0]?.slots?.main?.['*'] ?? null
}

function extractBlock(wikitext, start) {
  let depth = 0, i = start, end = -1
  while (i < wikitext.length) {
    if (wikitext[i] === '{' && wikitext[i+1] === '{') { depth++; i += 2 }
    else if (wikitext[i] === '}' && wikitext[i+1] === '}') {
      depth--; if (depth === 0) { end = i+2; break }; i += 2
    } else i++
  }
  return end > 0 ? wikitext.slice(start, end) : wikitext.slice(start, start+4000)
}

function findTemplate(wikitext, ...names) {
  for (const name of names) {
    const re = new RegExp('\\{\\{\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const match = wikitext.match(re)
    if (!match) continue
    return extractBlock(wikitext, wikitext.indexOf(match[0]))
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

function parsePct(raw) {
  if (!raw) return null
  const s = stripMarkup(raw).replace(/[^\d.,]/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function parseInfoboxElection(wikitext, isPresidential = false) {
  const block = findTemplate(wikitext, 'Infobox election', 'Infobox Election')
  if (!block) return null
  const pairs = parsePairs(block)
  const parties = []
  for (let n = 1; n <= 30; n++) {
    const nameRaw = pairs.get(`party${n}`) ?? pairs.get(`candidate${n}`)
    if (nameRaw === undefined || nameRaw === '') break
    const name = stripMarkup(nameRaw)
    if (!name) continue
    const pct = parsePct(pairs.get(`percentage${n}`))
    const votes = pairs.get(`popular_vote${n}`)
    const seats = pairs.get(`seats${n}`)
    if (pct === null && !votes && !seats) continue
    parties.push({ name, pct })
  }
  // Composite-infobox heuristic
  if (isPresidential) {
    let partyCount = 0, partyWithCandCount = 0
    for (let n = 1; n <= 30; n++) {
      const hasParty = (pairs.get(`party${n}`) ?? '') !== ''
      if (!hasParty) break
      partyCount++
      if ((pairs.get(`candidate${n}`) ?? '') !== '') partyWithCandCount++
    }
    if (partyCount >= 4 && partyWithCandCount / partyCount < 0.5) {
      return { result: null, heuristicFired: true, partyCount, partyWithCandCount }
    }
  }
  return { result: parties.length >= 2 ? parties : null, heuristicFired: false }
}

function parseFichaDeEleccion(wikitext) {
  const block = findTemplate(wikitext, 'Ficha de elección', 'Ficha_de_elección', 'Ficha de elecciones', 'Ficha de Elección')
  if (!block) return null
  const pairs = parsePairs(block)
  const parties = []
  for (let n = 1; n <= 30; n++) {
    const nameRaw = pairs.get(`partido${n}`) ?? pairs.get(`candidato${n}`)
    if (nameRaw === undefined || nameRaw === '') break
    const name = stripMarkup(nameRaw)
    const pct = parsePct(pairs.get(`porcentaje${n}`))
    const votes = pairs.get(`votos${n}`)
    if (pct === null && !votes) continue
    parties.push({ name, pct })
  }
  return parties.length >= 2 ? parties : null
}

function detectElectionInfobox(wikitext, lang, isPresidential = false) {
  if (lang === 'es') {
    const es = parseFichaDeEleccion(wikitext)
    if (es) return { source: 'es-ficha', parties: es, heuristicFired: false }
    const en = parseInfoboxElection(wikitext, isPresidential)
    return en?.result ? { source: 'en-infobox-fallback', parties: en.result, heuristicFired: en.heuristicFired } : { source: null, parties: null, heuristicFired: en?.heuristicFired ?? false }
  }
  const en = parseInfoboxElection(wikitext, isPresidential)
  if (en?.result) return { source: 'en-infobox', parties: en.result, heuristicFired: en.heuristicFired }
  if (en?.heuristicFired) return { source: null, parties: null, heuristicFired: true }
  const es = parseFichaDeEleccion(wikitext)
  return { source: es ? 'es-ficha-fallback' : null, parties: es, heuristicFired: false }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function test(label, esSlug, enSlug, isPresidential) {
  await sleep(1500)
  // Try es.wikipedia first (mirrors hook Capa B-1 → B-2)
  let wt = null, lang = null
  if (esSlug) { wt = await fetchWT(esSlug, 'es'); lang = 'es' }
  if (!wt && enSlug) { wt = await fetchWT(enSlug, 'en'); lang = 'en' }
  if (!wt) { console.log(label.padEnd(12), '→ NO WIKITEXT'); return }

  const { source, parties, heuristicFired } = detectElectionInfobox(wt, lang, isPresidential)

  if (heuristicFired) {
    console.log(label.padEnd(12), `→ [C-b] HEURÍSTICA disparada (infobox compuesto) → fallback editorial`)
    return
  }
  if (!source || !parties) {
    console.log(label.padEnd(12), `→ [C-b] no infobox parseable → fallback editorial`)
    return
  }

  const ratio = isPresidential ? (() => {
    // count candidate/party ratio just for display
    const block = findTemplate(wt, 'Infobox election', 'Ficha de elección', 'Ficha_de_elección', 'Ficha de elecciones', 'Ficha de Elección', 'Infobox Election')
    if (!block) return 'N/A'
    const pairs = parsePairs(block)
    let pc = 0, cc = 0
    for (let n = 1; n <= 30; n++) {
      if ((pairs.get(`partido${n}`) ?? pairs.get(`party${n}`) ?? '') === '') break
      pc++
      if ((pairs.get(`candidato${n}`) ?? pairs.get(`candidate${n}`) ?? '') !== '') cc++
    }
    return pc ? `${cc}/${pc}` : 'N/A'
  })() : null

  const topParties = parties.slice(0, 3).map(p => `${p.name.slice(0,20)}(${p.pct ?? '?'}%)`).join(', ')
  const ratioStr = ratio ? ` ratio=${ratio}` : ''
  console.log(label.padEnd(12), `→ [B-${lang === 'es' ? '1' : '2'} ${source}]  ${parties.length} partidos${ratioStr}: ${topParties}`)
}

console.log('=== Verificación Fix1 + Heurística ===\n')

// Países presidenciales
await test('EE.UU.',    'Elecciones presidenciales de Estados Unidos de 2024', null,                                       true)
await test('Argentina', 'Elecciones presidenciales de Argentina de 2023',      '2023 Argentine general election',          true)
await test('México',    'Elecciones presidenciales de México de 2024',          null,                                       true)
await test('Francia',   'Elecciones presidenciales de Francia de 2022',         '2022 French presidential election',        true)
await test('Brasil',    null,                                                   '2022 Brazilian presidential election',     true)

// Sin cambio esperado
await test('España',    'Elecciones generales de España de 2023',               null,                                       false)
await test('UK',        null,                                                   'United Kingdom general election, 2024',    false)
await test('Alemania',  'Elecciones federales de Alemania de 2025',             null,                                       false)

console.log('\nDone.')
