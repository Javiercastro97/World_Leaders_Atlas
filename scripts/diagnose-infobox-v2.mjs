function sep(t) { console.log(`\n${'═'.repeat(70)}\n${t}\n${'═'.repeat(70)}`) }

async function fetchWikitext(lang, slug) {
  const title = slug.replaceAll('_', ' ')
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=${encodeURIComponent(title)}&origin=*`
  const r = await fetch(url, { headers: { 'User-Agent': 'AtlasPolitico/1.0' } })
  if (!r.ok) return null
  const d = await r.json()
  const pages = Object.values(d.query?.pages ?? {})
  if (!pages.length || pages[0].missing !== undefined) return null
  return pages[0]?.revisions?.[0]?.slots?.main?.['*'] ?? null
}

function extractInfoblock(wikitext, templateNames) {
  // Find any matching template
  for (const name of templateNames) {
    const re = new RegExp(`\\{\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`, 'i')
    const match = wikitext.match(re)
    if (!match) continue
    const start = wikitext.indexOf(match[0])
    let depth = 0, i = start, end = -1
    while (i < wikitext.length) {
      if (wikitext[i] === '{' && wikitext[i+1] === '{') { depth++; i += 2 }
      else if (wikitext[i] === '}' && wikitext[i+1] === '}') {
        depth--
        if (depth === 0) { end = i + 2; break }
        i += 2
      } else i++
    }
    return { name, block: end > 0 ? wikitext.slice(start, end) : wikitext.slice(start, start + 4000) }
  }
  return null
}

function analyzeInfoblock(block) {
  const lines = block.split('\n')
  const pairs = []
  for (const line of lines) {
    const m = line.match(/^\s*\|\s*([a-zA-ZáéíóúñÁÉÍÓÚÑ_0-9]+)\s*=\s*(.*)/)
    if (m) pairs.push({ key: m[1], val: m[2].trim().slice(0, 100) })
  }
  return pairs
}

// ─── ESPAÑA 2023 — Ficha de elección ─────────────────────────────────────────
sep('ESPAÑA 2023 — {{Ficha de elección}} en es.wikipedia')
const esWT = await fetchWikitext('es', 'Elecciones_generales_de_España_de_2023')
if (!esWT) { console.log('  (no encontrado)') }
else {
  const result = extractInfoblock(esWT, ['Ficha de elección', 'Ficha_de_elección', 'Infobox election', 'Ficha de elecciones'])
  if (!result) {
    // Show all template names
    const tpls = [...esWT.matchAll(/\{\{\s*([^\n|}{]{1,60})/g)].map(m => m[1].trim())
    const unique = [...new Set(tpls)].slice(0, 20)
    console.log('  Templates encontradas:'); unique.forEach(t => console.log(`    {{${t}`))
  } else {
    const pairs = analyzeInfoblock(result.block)
    console.log(`  Plantilla: "{{${result.name}}}}"`)
    console.log(`  Longitud bloque: ${result.block.length} chars, ${pairs.length} pares`)

    // Show all keys grouped
    const partyKeys = pairs.filter(p => /partido|party|cand/i.test(p.key))
    const voteKeys  = pairs.filter(p => /voto|vote|popular/i.test(p.key))
    const pctKeys   = pairs.filter(p => /porce|pct|percent/i.test(p.key))
    const seatKeys  = pairs.filter(p => /esca|seat/i.test(p.key))

    console.log(`\n  CLAVES PARTIDO (${partyKeys.length}):`)
    partyKeys.slice(0,8).forEach(p => console.log(`    | ${p.key.padEnd(25)} = ${p.val.slice(0,60)}`))

    console.log(`\n  CLAVES VOTOS (${voteKeys.length}):`)
    voteKeys.slice(0,8).forEach(p => console.log(`    | ${p.key.padEnd(25)} = ${p.val.slice(0,60)}`))

    console.log(`\n  CLAVES % (${pctKeys.length}):`)
    pctKeys.slice(0,8).forEach(p => console.log(`    | ${p.key.padEnd(25)} = ${p.val.slice(0,60)}`))

    console.log(`\n  CLAVES ESCAÑOS (${seatKeys.length}):`)
    seatKeys.slice(0,8).forEach(p => console.log(`    | ${p.key.padEnd(25)} = ${p.val.slice(0,60)}`))

    // First 3 numbered entries
    console.log('\n  PRIMERAS 3 ENTRADAS:')
    for (let n = 1; n <= 3; n++) {
      const entry = pairs.filter(p => p.key.match(new RegExp(`${n}$`)))
      if (entry.length) {
        console.log(`    Entrada ${n}:`)
        entry.forEach(p => console.log(`      | ${p.key.padEnd(25)} = ${p.val.slice(0,60)}`))
      }
    }
  }
}

// ─── ALBANIA 2025 — es.wikipedia ─────────────────────────────────────────────
sep('ALBANIA 2025 — es.wikipedia (slug correcto del sitelink)')
const albES = await fetchWikitext('es', 'Elecciones_parlamentarias_de_Albania_de_2025')
if (!albES) { console.log('  (es-wiki: no encontrado)') }
else {
  console.log(`  es-wiki encontrado, ${albES.length.toLocaleString()} chars`)
  const result = extractInfoblock(albES, ['Ficha de elección', 'Ficha_de_elección', 'Infobox election', 'Ficha de elecciones'])
  if (!result) {
    const tpls = [...albES.matchAll(/\{\{\s*([^\n|}{]{1,60})/g)].map(m => m[1].trim())
    const unique = [...new Set(tpls)].slice(0, 15)
    console.log('  Templates:'); unique.forEach(t => console.log(`    {{${t}`))
  } else {
    const pairs = analyzeInfoblock(result.block)
    console.log(`  Plantilla: "{{${result.name}}}}", ${pairs.length} pares`)
    pairs.slice(0, 20).forEach(p => console.log(`    | ${p.key.padEnd(25)} = ${p.val.slice(0,60)}`))
  }
}

// ─── ALBANIA 2025 — en.wikipedia ─────────────────────────────────────────────
sep('ALBANIA 2025 — en.wikipedia')
const albEN = await fetchWikitext('en', '2025_Albanian_parliamentary_election')
if (!albEN) { console.log('  (en-wiki: no encontrado)') }
else {
  console.log(`  en-wiki encontrado, ${albEN.length.toLocaleString()} chars`)
  const result = extractInfoblock(albEN, ['Infobox election'])
  if (!result) {
    const tpls = [...albEN.matchAll(/\{\{\s*([^\n|}{]{1,60})/g)].map(m => m[1].trim())
    const unique = [...new Set(tpls)].slice(0, 10)
    console.log('  Templates:'); unique.forEach(t => console.log(`    {{${t}`))
  } else {
    const pairs = analyzeInfoblock(result.block)
    console.log(`  Plantilla: "{{${result.name}}}}", ${pairs.length} pares`)
    const partyKeys = pairs.filter(p => /party|cand/i.test(p.key))
    const voteKeys  = pairs.filter(p => /vote|popular/i.test(p.key))
    const pctKeys   = pairs.filter(p => /percent/i.test(p.key))
    const seatKeys  = pairs.filter(p => /seat/i.test(p.key))
    console.log(`  Partidos:${partyKeys.length} Votos:${voteKeys.length} %:${pctKeys.length} Escaños:${seatKeys.length}`)
    console.log('\n  PRIMERAS 3 ENTRADAS:')
    for (let n = 1; n <= 3; n++) {
      const entry = pairs.filter(p => p.key.match(new RegExp(`${n}$`)))
      if (entry.length) {
        console.log(`    Entrada ${n}:`)
        entry.slice(0,6).forEach(p => console.log(`      | ${p.key.padEnd(25)} = ${p.val.slice(0,60)}`))
      }
    }
  }
}

// ─── Verificar cuántos partidos tiene UK 2024 en total ───────────────────────
sep('UK 2024 — cuántas entradas numeradas hay en el infobox')
const ukWT = await fetchWikitext('en', '2024_United_Kingdom_general_election')
if (ukWT) {
  const result = extractInfoblock(ukWT, ['Infobox election'])
  if (result) {
    const pairs = analyzeInfoblock(result.block)
    // Find max N in partyN, popular_voteN, percentageN
    let maxN = 0
    for (const { key } of pairs) {
      const m = key.match(/(\d+)$/)
      if (m) maxN = Math.max(maxN, parseInt(m[1]))
    }
    console.log(`  Máximo índice N encontrado: ${maxN} partidos/candidatos`)
    // List all partyN
    const partyEntries = pairs.filter(p => /^party\d+$/.test(p.key))
    partyEntries.forEach(p => console.log(`  | ${p.key.padEnd(15)} = ${p.val.slice(0,50)}`))
    // Check format of percentage values
    const pctEntries = pairs.filter(p => /^percentage\d+$/.test(p.key))
    console.log('\n  Formato de porcentajes:')
    pctEntries.slice(0,5).forEach(p => console.log(`  | ${p.key.padEnd(15)} = "${p.val.slice(0,40)}"`))
    // Check format of votes
    const voteEntries = pairs.filter(p => /^popular_vote\d+$/.test(p.key))
    console.log('\n  Formato de votos:')
    voteEntries.slice(0,5).forEach(p => console.log(`  | ${p.key.padEnd(15)} = "${p.val.slice(0,40)}"`))
  }
}
