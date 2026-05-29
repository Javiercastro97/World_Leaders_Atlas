// Test script for the new color resolution pipeline (Part 1 + Part 2)
// Run: node scripts/test-colors-v2.mjs

const TIMEOUT_MS = 8000

function withTimeout(outer) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  return outer ? AbortSignal.any([outer, timeout]) : timeout
}

function normalizeHex(raw) {
  const s = raw.trim().replace(/&#35;/g, '#')
  const h = s.startsWith('#') ? s : `#${s}`
  if (!/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(h)) return null
  if (h.toUpperCase() === '#F8F9FA') return null
  return h
}

// ── Wikipedia fetch ──────────────────────────────────────────────────────────

async function fetchWikitext(slug, lang) {
  const title = slug.replaceAll('_', ' ')
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=${encodeURIComponent(title)}&origin=*&rvsection=0`
  const res = await fetch(url, { headers: { 'User-Agent': 'AtlasPolitico/1.0' }, signal: withTimeout() })
  const data = await res.json()
  const pages = Object.values(data.query?.pages ?? {})
  if (!pages.length) return null
  const page = pages[0]
  return page.revisions?.[0]?.slots?.main?.['*'] ?? null
}

// ── Switch template parser ───────────────────────────────────────────────────

function parseSwitchTemplate(raw) {
  const map = new Map()
  const text = raw.replace(/<!--[\s\S]*?-->/g, '')
  const parts = text.split('|')
  const pending = []
  for (const part of parts) {
    const s = part.trim()
    if (!s) continue
    if (s.startsWith('{') || /^[}\s]+$/.test(s) || s.startsWith('#switch') ||
        s.startsWith('includeonly') || s.startsWith('/includeonly') ||
        s.startsWith('noinclude') || s.startsWith('/noinclude')) {
      pending.length = 0; continue
    }
    const hexMatch = s.match(/^([^=<{}\n]+?)\s*=\s*<nowiki>(#[0-9A-Fa-f]{3,6})<\/nowiki>/)
    if (hexMatch) {
      const name = hexMatch[1].trim(), hex = hexMatch[2]
      if (name) { pending.push(name); for (const a of pending) map.set(a, hex) }
      pending.length = 0
    } else {
      const cleaned = s.replace(/[{}[\]<>]/g, '').trim()
      if (cleaned && cleaned.length < 100 && !cleaned.startsWith('#') && !cleaned.includes('='))
        pending.push(cleaned)
      else pending.length = 0
    }
  }
  return map
}

// ── Election infobox parser ──────────────────────────────────────────────────

function extractBlock(wikitext, start) {
  let depth = 0, i = start, end = -1
  while (i < wikitext.length) {
    if (wikitext[i] === '{' && wikitext[i+1] === '{') { depth++; i += 2 }
    else if (wikitext[i] === '}' && wikitext[i+1] === '}') {
      depth--; if (depth === 0) { end = i + 2; break } i += 2
    } else i++
  }
  return end > 0 ? wikitext.slice(start, end) : wikitext.slice(start, start+4000)
}

function findTemplate(wikitext, ...names) {
  for (const name of names.filter(Boolean)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\{\\{\\s*${escaped}`, 'i')
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

function parseColor(raw) {
  if (!raw) return null
  const s = raw.trim()
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(s) ? s : null
}

function parseColorTemplateArg(raw) {
  if (!raw) return null
  const m = raw.trim().match(/^\{\{\s*[Cc]olor[ _]pol[ií]tico\s*\|\s*([^|}]+?)\s*\}\}$/)
  return m ? m[1] : null
}

function parseParties(wikitext, lang) {
  const block = lang === 'es'
    ? findTemplate(wikitext, 'Ficha de elección', 'Ficha_de_elección', 'Ficha de elecciones', 'Ficha_de_elecciones', 'Ficha de Elección')
    : findTemplate(wikitext, 'Infobox election', 'Infobox Election')
  if (!block) return null
  const pairs = parsePairs(block)
  const parties = []
  for (let n = 1; n <= 30; n++) {
    const nameRaw = lang === 'es'
      ? (pairs.get(`partido${n}`) ?? pairs.get(`candidato${n}`))
      : (pairs.get(`party${n}`) ?? pairs.get(`candidate${n}`))
    if (nameRaw === undefined || nameRaw === '') break
    const name = stripMarkup(nameRaw)
    if (!name) continue
    const colorRaw = lang === 'es'
      ? (pairs.get(`color_partido${n}`) ?? pairs.get(`color${n}`))
      : (pairs.get(`color${n}`) ?? pairs.get(`colour${n}`))
    const colorHex = parseColor(colorRaw)
    const colorTemplateArg = colorHex === null ? parseColorTemplateArg(colorRaw) : null
    parties.push({ name, colorHex, colorTemplateArg })
  }
  return parties.length >= 2 ? { parties, templateLang: lang } : null
}

// ── expandtemplates ──────────────────────────────────────────────────────────

async function expandPartyColor(name) {
  const text = `{{Party color|${name}}}`
  const url = `https://en.wikipedia.org/w/api.php?action=expandtemplates&text=${encodeURIComponent(text)}&prop=wikitext&format=json&origin=*`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'AtlasPolitico/1.0' }, signal: withTimeout() })
    if (!res.ok) return null
    const data = await res.json()
    return normalizeHex((data.expandtemplates?.wikitext ?? '').trim())
  } catch { return null }
}

// ── Switch map (loaded once) ─────────────────────────────────────────────────

let _switchMap = null

async function loadSwitch() {
  if (_switchMap) return _switchMap
  console.log('  [switch] downloading Plantilla:Color_politico...')
  const wt = await fetchWikitext('Plantilla:Color_político', 'es')
  if (!wt) { console.log('  [switch] FAILED to fetch template'); return new Map() }
  _switchMap = parseSwitchTemplate(wt)
  console.log(`  [switch] loaded ${_switchMap.size} entries from template (${(wt.length/1024).toFixed(1)} KB)`)

  const critical = ['PP', 'PSOE', 'Vox', 'Sumar', 'Partido Popular',
    'Partido Socialista Obrero Español',
    'Partido Laborista (Reino Unido)', 'Partido Conservador (Reino Unido)']
  const missing = critical.filter(n => !_switchMap.has(n))
  if (missing.length)
    console.log(`  [switch] WARNING missing critical: ${missing.join(', ')}`)
  else
    console.log('  [switch] all 8 critical parties confirmed present')

  return _switchMap
}

// ── Test runner ──────────────────────────────────────────────────────────────

async function testCountry(label, esSlug, enSlug) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`COUNTRY: ${label}`)
  const t0 = Date.now()

  let parsed = null, usedLang = null, usedSlug = null

  if (esSlug) {
    const wt = await fetchWikitext(esSlug, 'es')
    if (wt) {
      parsed = parseParties(wt, 'es')
      if (parsed) { usedLang = 'es'; usedSlug = esSlug }
    }
  }
  if (!parsed && enSlug) {
    const wt = await fetchWikitext(enSlug, 'en')
    if (wt) {
      parsed = parseParties(wt, 'en')
      if (parsed) { usedLang = 'en'; usedSlug = enSlug }
    }
  }

  if (!parsed) { console.log('  FAIL: no parseable infobox'); return }

  const { parties, templateLang } = parsed
  const direct = parties.filter(p => p.colorHex !== null).length
  const withArg = parties.filter(p => p.colorTemplateArg !== null).length
  console.log(`  source: ${usedLang}.wikipedia — ${usedSlug}`)
  console.log(`  templateLang: ${templateLang} | ${parties.length} parties | ${direct} direct hex | ${withArg} colorTemplateArg`)

  let resolved = [...parties]

  if (templateLang === 'es') {
    const map = await loadSwitch()
    let hits = 0
    const needColor = parties.filter(p => p.colorHex === null && p.colorTemplateArg !== null)
    resolved = parties.map(p => {
      if (p.colorHex !== null || !p.colorTemplateArg) return p
      const hex = map.get(p.colorTemplateArg)
      if (hex) { hits++; return { ...p, colorHex: hex } }
      return p
    })
    console.log(`  switch resolved: ${hits}/${needColor.length}`)
    const unresolved = resolved.filter(p => p.colorHex === null)
    if (unresolved.length) console.log(`  still gray: ${unresolved.map(p => p.name).join(', ')}`)
  } else {
    const toResolve = parties.filter(p => p.colorHex === null && p.name)
    const results = await Promise.all(toResolve.map(p => expandPartyColor(p.name).then(hex => [p.name, hex])))
    const colorMap = new Map(results.filter(([,h]) => h).map(([n,h]) => [n, h]))
    resolved = parties.map(p => ({ ...p, colorHex: p.colorHex ?? colorMap.get(p.name) ?? null }))
    console.log(`  expandtemplates resolved: ${colorMap.size}/${toResolve.length}`)
    const unresolved = resolved.filter(p => p.colorHex === null)
    if (unresolved.length) console.log(`  still gray: ${unresolved.map(p => p.name).join(', ')}`)
  }

  console.log(`  time: ${Date.now() - t0}ms`)
  console.log(`  final colors:`)
  resolved.slice(0, 10).forEach((p, i) => {
    const was = parties[i].colorHex
    const src = was !== null ? 'direct' : (p.colorHex ? 'resolved' : 'GRAY')
    console.log(`    ${String(i+1).padStart(2)}. ${(p.colorHex ?? 'null   ').padEnd(9)} [${src.padEnd(8)}] ${p.name}`)
  })
  if (resolved.length > 10) console.log(`    ... and ${resolved.length - 10} more`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('Cuba (Q241): [SKIPPED — caught by no-elections override before Wikipedia fetch]')

await testCountry('Espana 2023', 'Elecciones_generales_de_España_de_2023', null)
await testCountry('Argentina 2023', 'Elecciones_presidenciales_de_Argentina_de_2023', null)
await testCountry('UK 2024', 'Elecciones_generales_del_Reino_Unido_de_2024', '2024_United_Kingdom_general_election')
await testCountry('Albania 2021', 'Elecciones_parlamentarias_de_Albania_de_2021', 'Albanian_parliamentary_election,_2021')

console.log('\nDone.')
