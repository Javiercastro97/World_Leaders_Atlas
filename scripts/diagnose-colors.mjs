// Diagnostic script: run electionParser on real Wikipedia wikitext and show
// colorHex before and after assignColors.
// Run: node scripts/diagnose-colors.mjs

const NEUTRAL_GRAYS = [
  '#2A2A2A', '#3F3F3F', '#545454', '#6B6B6B',
  '#828282', '#9A9A9A', '#B2B2B2', '#C9C9C9',
]

// ── Inline parser (mirrors electionParser.ts exactly) ─────────────────────────

function extractBlock(wikitext, start) {
  let depth = 0, i = start, end = -1
  while (i < wikitext.length) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') { depth++; i += 2 }
    else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--
      if (depth === 0) { end = i + 2; break }
      i += 2
    } else { i++ }
  }
  return end > 0 ? wikitext.slice(start, end) : wikitext.slice(start, start + 4000)
}

function findTemplate(wikitext, ...names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\{\\{\\s*${escaped}`, 'i')
    const match = wikitext.match(re)
    if (!match) continue
    const start = wikitext.indexOf(match[0])
    return extractBlock(wikitext, start)
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
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/\{\{efn[^}]*\}\}/gi, '')
    .replace(/\{\{[^|}]+\|[^}]*\}\}/g, '')
    .replace(/'{2,3}/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .trim()
}

function parseVotes(raw) {
  if (!raw) return null
  const s = stripMarkup(raw).replace(/[^\d]/g, '')
  if (!s) return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function parsePct(raw) {
  if (!raw) return null
  const s = stripMarkup(raw).replace(/[^\d.,]/g, '').replace(',', '.')
  if (!s) return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function parseSeats(raw) {
  if (!raw) return null
  const s = stripMarkup(raw).replace(/[^\d]/g, '')
  if (!s) return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function parseColor(raw) {
  if (!raw) return null
  const s = raw.trim()
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(s)) return s
  return null
}

function parseFichaDeEleccion(wikitext) {
  const block = findTemplate(
    wikitext,
    'Ficha de elección', 'Ficha_de_elección',
    'Ficha de elecciones', 'Ficha_de_elecciones',
    'Ficha de Elección',
  )
  if (!block) return null
  const pairs = parsePairs(block)
  const parties = []
  for (let n = 1; n <= 30; n++) {
    const nameRaw = pairs.get(`partido${n}`) ?? pairs.get(`candidato${n}`)
    if (nameRaw === undefined || nameRaw === '') break
    const name = stripMarkup(nameRaw)
    if (!name) continue
    const colorHex = parseColor(pairs.get(`color_partido${n}`) ?? pairs.get(`color${n}`))
    const votes  = parseVotes(pairs.get(`votos${n}`))
    const pct    = parsePct(pairs.get(`porcentaje${n}`))
    const seats  = parseSeats(pairs.get(`diputados${n}`) ?? pairs.get(`escaños${n}`) ?? pairs.get(`escanos${n}`) ?? pairs.get(`senadores${n}`))
    if (votes === null && pct === null && seats === null) continue
    parties.push({ name, colorHex, votes, pct, seats })
  }
  if (parties.length < 2) return null
  return { parties }
}

function assignColors(parties) {
  let grayIdx = 0
  return parties.map(p => ({
    ...p,
    colorHex: p.colorHex ?? NEUTRAL_GRAYS[grayIdx++ % (NEUTRAL_GRAYS.length - 1)],
  }))
}

// ── Fetch wikitext from es.wikipedia ─────────────────────────────────────────

async function fetchWikitext(slug) {
  const url = `https://es.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=${encodeURIComponent(slug)}&origin=*`
  const res = await fetch(url, { headers: { 'User-Agent': 'DiagnosticScript/1.0' } })
  const data = await res.json()
  const pages = Object.values(data.query?.pages ?? {})
  if (!pages.length) return null
  const page = pages[0]
  return page.revisions?.[0]?.slots?.main?.['*'] ?? null
}

// ── Run test ──────────────────────────────────────────────────────────────────

async function test(label, slug) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`TEST: ${label}`)
  console.log(`SLUG: ${slug}`)
  console.log('='.repeat(60))

  const wikitext = await fetchWikitext(slug)
  if (!wikitext) { console.log('ERROR: no wikitext fetched'); return }
  console.log(`Wikitext length: ${wikitext.length} chars`)

  const templateName = wikitext.match(/\{\{\s*Ficha de elecci[oó]n/i)?.[0] ?? '(not found)'
  console.log(`Template found: ${templateName}`)

  const result = parseFichaDeEleccion(wikitext)
  if (!result) { console.log('PARSE FAILED: parseFichaDeEleccion returned null'); return }

  console.log(`\nParties BEFORE assignColors (${result.parties.length} total):`)
  console.log('  #  | colorHex (raw) | name')
  console.log('  ---+----------------+--------------------')
  result.parties.forEach((p, i) => {
    console.log(`  ${String(i+1).padStart(2)} | ${(p.colorHex ?? 'null').padEnd(14)} | ${p.name}`)
  })

  const after = assignColors(result.parties)
  console.log(`\nParties AFTER assignColors:`)
  console.log('  #  | before         | after          | name')
  console.log('  ---+----------------+----------------+--------------------')
  result.parties.forEach((p, i) => {
    const changed = (p.colorHex ?? 'null') !== after[i].colorHex ? ' ← CHANGED' : ''
    console.log(`  ${String(i+1).padStart(2)} | ${(p.colorHex ?? 'null').padEnd(14)} | ${after[i].colorHex.padEnd(14)} | ${p.name}${changed}`)
  })
}

await test('UK 2024 (es.wikipedia)', 'Elecciones_generales_del_Reino_Unido_de_2024')
await test('Argentina 2023 (es.wikipedia)', 'Elecciones_presidenciales_de_Argentina_de_2023')

console.log('\nDone.')
