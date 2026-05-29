// Fetch Wikipedia wikitext and examine infobox structure for 3 elections
const articles = [
  {
    lang: 'es',
    slug: 'Elecciones_generales_de_España_de_2023',
    label: 'España 2023 (es.wikipedia)',
  },
  {
    lang: 'en',
    slug: '2024_United_Kingdom_general_election',
    label: 'UK 2024 (en.wikipedia)',
  },
  {
    lang: 'sq',
    slug: 'Zgjedhjet_parlamentare_në_Shqipëri_2025',
    label: 'Albania 2025 (sq.wikipedia)',
  },
]

function sep(t) { console.log(`\n${'═'.repeat(70)}\n${t}\n${'═'.repeat(70)}`) }

for (const { lang, slug, label } of articles) {
  sep(label)

  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=${encodeURIComponent(slug.replaceAll('_',' '))}&origin=*`

  let wikitext = null
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'AtlasPolitico/1.0' } })
    if (!r.ok) { console.log(`  ERROR HTTP ${r.status}`); continue }
    const d = await r.json()
    const pages = Object.values(d.query?.pages ?? {})
    if (!pages.length || pages[0].missing !== undefined) { console.log('  (artículo no encontrado)'); continue }
    wikitext = pages[0]?.revisions?.[0]?.slots?.main?.['*'] ?? null
    if (!wikitext) { console.log('  (wikitext vacío)'); continue }
  } catch (e) {
    console.log(`  FETCH ERROR: ${e.message}`)
    continue
  }

  console.log(`  Wikitext total: ${wikitext.length.toLocaleString()} caracteres`)

  // Find the infobox block
  const infoboxMatch = wikitext.match(/\{\{[Ii]nfobox[^\n]*/g)
  if (!infoboxMatch) {
    console.log('  ⚠ No se encontró ningún {{Infobox ...')
    // Show first 500 chars to see what templates exist
    const templates = [...wikitext.matchAll(/\{\{([^\n|}{]{1,60})/g)]
      .slice(0, 15)
      .map(m => m[1].trim())
    console.log('  Plantillas encontradas (primeras 15):')
    templates.forEach(t => console.log(`    {{${t}`))
    continue
  }

  console.log(`\n  Infobox encontrado: "${infoboxMatch[0].slice(0, 80)}"`)

  // Extract the full infobox block (balanced braces)
  const infoboxStart = wikitext.indexOf(infoboxMatch[0])
  let depth = 0, i = infoboxStart, end = -1
  while (i < wikitext.length) {
    if (wikitext[i] === '{' && wikitext[i+1] === '{') { depth++; i += 2 }
    else if (wikitext[i] === '}' && wikitext[i+1] === '}') {
      depth--
      if (depth === 0) { end = i + 2; break }
      i += 2
    } else { i++ }
  }

  const infoblock = end > 0 ? wikitext.slice(infoboxStart, end) : wikitext.slice(infoboxStart, infoboxStart + 3000)
  console.log(`  Longitud del bloque infobox: ${infoblock.length} caracteres`)

  // Extract all key=value pairs
  const lines = infoblock.split('\n')
  const pairs = []
  for (const line of lines) {
    const m = line.match(/^\s*\|\s*([a-zA-Z_0-9]+)\s*=\s*(.*)/)
    if (m) pairs.push({ key: m[1], val: m[2].trim().slice(0, 80) })
  }

  console.log(`\n  ${pairs.length} pares clave=valor encontrados`)

  // Show the template name
  const templateName = infoboxMatch[0].replace('{{', '').replace('|', '').trim()
  console.log(`  Nombre plantilla: "${templateName}"`)

  // Categorize keys
  const partyKeys = pairs.filter(p => /party|partido|candidate|cand|parti/i.test(p.key))
  const voteKeys  = pairs.filter(p => /vote|vot|votos/i.test(p.key))
  const pctKeys   = pairs.filter(p => /pct|percent|porce|%/i.test(p.key))
  const seatKeys  = pairs.filter(p => /seat|esc|asiento|scaun|mandat/i.test(p.key))
  const otherKeys = pairs.filter(p => !/party|partido|candidate|cand|parti|vote|vot|votos|pct|percent|porce|seat|esc|asiento|scaun|mandat/i.test(p.key))

  console.log(`\n  CLAVES DE PARTIDO (${partyKeys.length}):`)
  partyKeys.slice(0, 8).forEach(p => console.log(`    | ${p.key.padEnd(25)} = ${p.val.slice(0, 60)}`))
  if (partyKeys.length > 8) console.log(`    ... y ${partyKeys.length - 8} más`)

  console.log(`\n  CLAVES DE VOTOS (${voteKeys.length}):`)
  voteKeys.slice(0, 8).forEach(p => console.log(`    | ${p.key.padEnd(25)} = ${p.val.slice(0, 60)}`))
  if (voteKeys.length > 8) console.log(`    ... y ${voteKeys.length - 8} más`)

  console.log(`\n  CLAVES DE % (${pctKeys.length}):`)
  pctKeys.slice(0, 8).forEach(p => console.log(`    | ${p.key.padEnd(25)} = ${p.val.slice(0, 60)}`))
  if (pctKeys.length > 8) console.log(`    ... y ${pctKeys.length - 8} más`)

  console.log(`\n  CLAVES DE ESCAÑOS (${seatKeys.length}):`)
  seatKeys.slice(0, 8).forEach(p => console.log(`    | ${p.key.padEnd(25)} = ${p.val.slice(0, 60)}`))
  if (seatKeys.length > 8) console.log(`    ... y ${seatKeys.length - 8} más`)

  console.log(`\n  OTRAS CLAVES RELEVANTES (${otherKeys.length}):`)
  otherKeys.slice(0, 10).forEach(p => console.log(`    | ${p.key.padEnd(25)} = ${p.val.slice(0, 60)}`))

  // Show first 3 "entries" (party1/votes1/pct1 pattern)
  console.log('\n  PRIMERAS 3 ENTRADAS (partido + datos):')
  for (let n = 1; n <= 3; n++) {
    const entry = pairs.filter(p => p.key.endsWith(String(n)) || p.key.endsWith(`_${n}`))
    if (entry.length) {
      console.log(`    Entrada ${n}:`)
      entry.forEach(p => console.log(`      | ${p.key.padEnd(25)} = ${p.val.slice(0, 60)}`))
    }
  }
}
