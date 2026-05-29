// Election infobox parser for two Wikipedia template families:
//   es.wikipedia → {{Ficha de elección}}
//   en.wikipedia → {{Infobox election}}
// Only these two languages are supported (architectural decision: es preferred, en as fallback).

import type { ElectionParty } from '../types/atlas'

export interface ElectionParseResult {
  year: number | null
  turnout: number | null
  parties: ElectionParty[]
  secondRound: ElectionParty[] | null
  turnoutSecondRound: number | null
  templateLang: 'es' | 'en'
}

// ── Block extraction ──────────────────────────────────────────────────────────

/** Extract a balanced {{ ... }} block starting at `start` in `wikitext`. */
function extractBlock(wikitext: string, start: number): string {
  let depth = 0
  let i = start
  let end = -1
  while (i < wikitext.length) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') { depth++; i += 2 }
    else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--
      if (depth === 0) { end = i + 2; break }
      i += 2
    } else { i++ }
  }
  // Fallback: return first 4000 chars if braces are unbalanced
  return end > 0 ? wikitext.slice(start, end) : wikitext.slice(start, start + 4000)
}

/** Find the first matching template (case-insensitive) and return its full block, or null. */
function findTemplate(wikitext: string, ...names: string[]): string | null {
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

/**
 * Split a template field value at inline ' |key=' separators that lie outside
 * wikilinks ([[...]]) and template calls ({{...}}).
 * Returns an array: first element = primary value; subsequent elements = 'key=value'
 * strings for each extra inline field on the same line.
 *
 * Some infoboxes (e.g. India 2024) pack multiple fields on one line:
 *   |partido1=[[BJP]] |líder1=[[Narendra Modi]]
 *   |color1=#FF9933 |imagen1=File:...
 * A plain split-by-newline parser reads the entire trailing content as part of the
 * first field's value, producing corrupt data. This function handles that case.
 */
function splitInlineFields(raw: string): string[] {
  const parts: string[] = []
  let cur = ''
  let linkD = 0  // depth inside [[...]]
  let tmplD = 0  // depth inside {{...}}
  let i = 0
  while (i < raw.length) {
    if (raw[i] === '[' && raw[i + 1] === '[') { linkD++; cur += '[['; i += 2; continue }
    if (raw[i] === ']' && raw[i + 1] === ']') { if (linkD > 0) linkD--; cur += ']]'; i += 2; continue }
    if (raw[i] === '{' && raw[i + 1] === '{') { tmplD++; cur += '{{'; i += 2; continue }
    if (raw[i] === '}' && raw[i + 1] === '}') { if (tmplD > 0) tmplD--; cur += '}}'; i += 2; continue }
    // Inline field separator: space + | + word chars + = , only at depth 0
    if (linkD === 0 && tmplD === 0 && raw[i] === ' ' && raw[i + 1] === '|') {
      if (/^[\wÀ-ɏ]+\s*=/.test(raw.slice(i + 2))) {
        parts.push(cur.trim())
        cur = ''
        i += 2
        continue
      }
    }
    cur += raw[i]; i++
  }
  parts.push(cur.trim())
  return parts
}

/**
 * Parse key=value pairs from a template block, one per line.
 * Also handles multiple pairs on a single line (inline format used by some
 * infoboxes), via splitInlineFields.
 */
function parsePairs(block: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*\|\s*([\wÀ-ɏ]+)\s*=\s*(.*)/)
    if (!m) continue
    const segs = splitInlineFields(m[2])
    map.set(m[1].trim(), segs[0])
    // Additional inline key=value pairs on the same line
    for (let s = 1; s < segs.length; s++) {
      const eq = segs[s].indexOf('=')
      if (eq > 0) {
        const key = segs[s].slice(0, eq).trimEnd()
        const val = segs[s].slice(eq + 1).trimStart()
        if (/^[\wÀ-ɏ]+$/.test(key)) map.set(key, val)
      }
    }
  }
  return map
}

// ── Markup stripping ──────────────────────────────────────────────────────────

function stripMarkup(raw: string): string {
  return raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')     // <ref>...</ref>
    .replace(/<ref[^>]*\/>/gi, '')                    // <ref ... />
    .replace(/\{\{efn[^}]*\}\}/gi, '')               // {{efn|...}}
    .replace(/\{\{[^|}]+\|[^}]*\}\}/g, '')           // {{template|arg}} → ''
    .replace(/'{2,3}/g, '')                           // ''' ''
    .replace(/<br\s*\/?>/gi, ' ')                     // <br/>
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')      // [[target|display]] → display
    .replace(/\[\[([^\]]+)\]\]/g, '$1')               // [[target]] → target
    .trim()
}

// ── Value parsers ─────────────────────────────────────────────────────────────

function parseVotes(raw: string | undefined): number | null {
  if (!raw) return null
  // Remove all non-digit characters (handles "7,760,694" and "7.760.694")
  const s = stripMarkup(raw).replace(/[^\d]/g, '')
  if (!s) return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function parsePct(raw: string | undefined): number | null {
  if (!raw) return null
  const s = stripMarkup(raw)
    .replace(/[^\d.,]/g, '')   // keep only digits and decimal separators
    .replace(',', '.')          // handle European decimal comma (e.g. "33,06")
  if (!s) return null
  const n = parseFloat(s)
  if (isNaN(n)) return null
  // Wikipedia always stores percentages in the 0-100 scale; return as-is.
  // (Do NOT multiply by 100 for n≤1 — small parties legitimately have <1% national share.)
  return n
}

function parseSeats(raw: string | undefined): number | null {
  if (!raw) return null
  const s = stripMarkup(raw).replace(/[^\d]/g, '')
  if (!s) return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function parseColor(raw: string | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  // Accept only bare hex codes; skip template calls like {{color político|PP}}
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(s)) return s
  return null
}

/** Extract the argument inside {{Color político|XXX}} (or lowercase / underscore variants). */
function parseColorTemplateArg(raw: string | undefined): string | null {
  if (!raw) return null
  const m = raw.trim().match(/^\{\{\s*[Cc]olor[ _]pol[ií]tico\s*\|\s*([^|}]+?)\s*\}\}$/)
  return m ? m[1] : null
}

/** Extract the wikilink destination from [[Destino|Display]] or [[Destino]]. */
function parseLinkTarget(raw: string | undefined): string | null {
  if (!raw) return null
  const m = raw.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/)
  return m ? m[1].trim() : null
}

function extractYear(raw: string | undefined): number | null {
  if (!raw) return null
  const m = raw.match(/\b(19|20)\d{2}\b/)
  return m ? parseInt(m[0], 10) : null
}

// ── Parsers ───────────────────────────────────────────────────────────────────

/**
 * Parse {{Ficha de elección}} — es.wikipedia template.
 * Key naming: partido1/votos1/porcentaje1/diputados1, turnout=participación
 */
export function parseFichaDeEleccion(wikitext: string): ElectionParseResult | null {
  const block = findTemplate(
    wikitext,
    'Ficha de elección',
    'Ficha_de_elección',
    'Ficha de elecciones',
    'Ficha_de_elecciones',
    'Ficha de Elección',
  )
  if (!block) return null

  const pairs = parsePairs(block)

  const year = extractYear(
    pairs.get('fecha_elección') ??
    pairs.get('fecha_eleccion') ??
    pairs.get('fecha') ??
    pairs.get('año'),
  )

  const turnout = parsePct(pairs.get('participación') ?? pairs.get('participacion'))

  const parties: ElectionParty[] = []
  for (let n = 1; n <= 30; n++) {
    const partyRaw     = pairs.get(`partido${n}`)
    const candidateRaw = pairs.get(`candidato${n}`) ?? pairs.get(`líder${n}`)
    const nameRaw = partyRaw ?? candidateRaw
    // First missing entry signals end of party list (Wikipedia convention: consecutive numbering)
    if (nameRaw === undefined || nameRaw === '') break

    const name = stripMarkup(nameRaw)
    if (!name) continue

    // candidate is extracted only when both partido and candidato fields are present;
    // if candidato is the only field, it is already used as the name above.
    const candidate = (partyRaw !== undefined && partyRaw !== '' && candidateRaw !== undefined && candidateRaw !== '')
      ? stripMarkup(candidateRaw) || null
      : null

    const colorRaw         = pairs.get(`color_partido${n}`) ?? pairs.get(`color${n}`)
    const colorHex         = parseColor(colorRaw)
    const colorTemplateArg = colorHex === null ? parseColorTemplateArg(colorRaw) : null
    const linkTarget       = parseLinkTarget(nameRaw)
    const votes    = parseVotes(pairs.get(`votos${n}`))
    const pct      = parsePct(pairs.get(`porcentaje${n}`))
    const seats    = parseSeats(
      pairs.get(`diputados${n}`) ??
      pairs.get(`escaños${n}`) ??
      pairs.get(`escanos${n}`) ??
      pairs.get(`senadores${n}`),
    )

    if (votes === null && pct === null && seats === null) continue
    parties.push({ name, candidate, colorHex, colorTemplateArg, linkTarget, votes, pct, seats })
  }

  if (parties.length < 2) return null

  // ── Second round (doble vuelta) ───────────────────────────────────────────
  // Fields: porcentaje2v1/porcentaje2v2 and votos2v1/votos2v2, indexed by the
  // same candidato{N} from the first round. Only present in presidential elections
  // with runoffs (France, Brazil, Argentina, etc.).
  let secondRound: ElectionParty[] | null = null
  const turnoutSecondRound = parsePct(pairs.get('participación2') ?? pairs.get('participacion2'))
  const sr: ElectionParty[] = []
  for (let n = 1; n <= parties.length; n++) {
    const pct2v  = parsePct(pairs.get(`porcentaje2v${n}`))
    const votes2v = parseVotes(pairs.get(`votos2v${n}`))
    if (pct2v === null && votes2v === null) continue
    // Inherit name, candidate, and colors from first-round party at same index
    const base = parties[n - 1]
    if (!base) continue
    sr.push({
      name:             base.name,
      candidate:        base.candidate,
      colorHex:         base.colorHex,
      colorTemplateArg: base.colorTemplateArg,
      linkTarget:       base.linkTarget,
      votes:            votes2v,
      pct:              pct2v,
      seats:            null,
    })
  }
  if (sr.length >= 2) secondRound = sr

  return { year, turnout, parties, secondRound, turnoutSecondRound, templateLang: 'es' }
}

/**
 * Parse {{Infobox election}} — en.wikipedia template.
 * Key naming: party1/popular_vote1/percentage1/seats1, turnout=turnout
 *
 * isPresidential: when true, activates composite-infobox guard. Some Wikipedia
 * articles cover multiple simultaneous elections (presidential + congressional)
 * in one nested {{Infobox election}} structure. In those articles parsePairs
 * collects fields from all nested modules, producing mismatched party/candidate
 * pairs. Guard: if ≥4 parties are found but fewer than 50% have a matching
 * candidate entry, this is a composite article — return null so the hook falls
 * through to the editorial fallback rather than showing wrong data.
 */
export function parseInfoboxElection(wikitext: string, isPresidential = false): ElectionParseResult | null {
  const block = findTemplate(wikitext, 'Infobox election', 'Infobox Election')
  if (!block) return null

  const pairs = parsePairs(block)

  const year = extractYear(pairs.get('election_date') ?? pairs.get('date'))

  const turnout = parsePct(pairs.get('turnout'))

  const parties: ElectionParty[] = []
  for (let n = 1; n <= 30; n++) {
    const partyRaw     = pairs.get(`party${n}`)
    const candidateRaw = pairs.get(`candidate${n}`) ?? pairs.get(`leader${n}`)
    const nameRaw = partyRaw ?? candidateRaw
    if (nameRaw === undefined || nameRaw === '') break

    const name = stripMarkup(nameRaw)
    if (!name) continue

    const candidate = (partyRaw !== undefined && partyRaw !== '' && candidateRaw !== undefined && candidateRaw !== '')
      ? stripMarkup(candidateRaw) || null
      : null

    const colorRaw         = pairs.get(`color${n}`) ?? pairs.get(`colour${n}`)
    const colorHex         = parseColor(colorRaw)
    const colorTemplateArg = colorHex === null ? parseColorTemplateArg(colorRaw) : null
    const linkTarget       = parseLinkTarget(nameRaw)
    const votes    = parseVotes(pairs.get(`popular_vote${n}`))
    const pct      = parsePct(pairs.get(`percentage${n}`))
    const seats    = parseSeats(pairs.get(`seats${n}`))

    if (votes === null && pct === null && seats === null) continue
    parties.push({ name, candidate, colorHex, colorTemplateArg, linkTarget, votes, pct, seats })
  }

  // Composite-infobox guard (presidential elections only).
  // Count party${n} entries that also have a candidate${n}. A ratio below 50%
  // with 4+ parties signals a mixed general/presidential composite article.
  if (isPresidential) {
    let partyCount = 0
    let partyWithCandCount = 0
    for (let n = 1; n <= 30; n++) {
      const hasParty = (pairs.get(`party${n}`) ?? '') !== ''
      if (!hasParty) break
      partyCount++
      if ((pairs.get(`candidate${n}`) ?? '') !== '') partyWithCandCount++
    }
    if (partyCount >= 4 && partyWithCandCount / partyCount < 0.5) return null
  }

  if (parties.length < 2) return null
  return { year, turnout, parties, secondRound: null, turnoutSecondRound: null, templateLang: 'en' }
}

/**
 * Orchestrator: try the correct parser for `lang` first, fall back to the other.
 * Returns null if neither parser finds ≥2 parties with numeric data.
 * isPresidential is forwarded to parseInfoboxElection for the composite-infobox guard.
 */
export function detectElectionInfobox(
  wikitext: string,
  lang: 'es' | 'en',
  isPresidential = false,
): ElectionParseResult | null {
  if (lang === 'es') {
    return parseFichaDeEleccion(wikitext) ?? parseInfoboxElection(wikitext, isPresidential)
  }
  return parseInfoboxElection(wikitext, isPresidential) ?? parseFichaDeEleccion(wikitext)
}
