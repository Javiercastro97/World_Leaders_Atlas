// Diagnostic: simulate parser on Brazil 2022 with redirect
// Run: node scripts/diag-brazil-parser.mjs

async function fetchS0(slug, lang) {
  const title = slug.replaceAll('_', ' ')
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&rvsection=0&redirects=1&titles=${encodeURIComponent(title)}`
  const r = await fetch(url, { headers: { 'User-Agent': 'AtlasPolitico/1.0' } })
  const d = await r.json()
  const pages = Object.values(d.query?.pages ?? {})
  return pages[0]?.revisions?.[0]?.slots?.main?.['*'] ?? null
}

function extractBlock(wikitext, start) {
  let depth = 0, i = start, end = -1
  while (i < wikitext.length) {
    if (wikitext[i] === '{' && wikitext[i+1] === '{') { depth++; i += 2 }
    else if (wikitext[i] === '}' && wikitext[i+1] === '}') {
      depth--
      if (depth === 0) { end = i+2; break }
      i += 2
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

function parsePct(raw) {
  if (!raw) return null
  const s = stripMarkup(raw).replace(/[^\d.,]/g, '').replace(',', '.')
  if (!s) return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

const wt = await fetchS0('2022 Brazilian presidential election', 'en')
console.log('Wikitext length (section 0, redirects=1):', wt?.length ?? 'null')

if (wt) {
  const block = findTemplate(wt, 'Infobox election', 'Infobox Election')
  if (!block) { console.log('NO BLOCK FOUND'); process.exit(1) }
  console.log('Block length:', block.length)

  const pairs = parsePairs(block)
  console.log('Total parsed pairs:', pairs.size)

  console.log('\nCandidate/party/percentage fields:')
  for (let n = 1; n <= 8; n++) {
    const cand = pairs.get('candidate' + n)
    const party = pairs.get('party' + n)
    const pct = pairs.get('percentage' + n)
    const votes = pairs.get('popular_vote' + n)
    if (!cand && !party) break
    console.log(` ${n}: candidate=${JSON.stringify(cand?.slice(0, 55))} | party=${JSON.stringify(party?.slice(0, 40))} | pct=${JSON.stringify(pct)} | votes=${JSON.stringify(votes?.slice(0, 20))}`)
  }

  console.log('\nturnout field:', pairs.get('turnout'))
  console.log('election_date field:', pairs.get('election_date'))

  const pct1 = parsePct(pairs.get('percentage1'))
  const pct2 = parsePct(pairs.get('percentage2'))
  console.log('\nparsePct(percentage1):', pct1, ' | parsePct(percentage2):', pct2)
  console.log('Would produce', pct1 !== null || pct2 !== null ? 'VALID chart' : 'NO chart (all null)')
}
