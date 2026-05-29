// Resolves party colors from two sources depending on template language:
//
//   'es' → Plantilla:Color político (es.wikipedia)
//          One #switch download per session; looked up by colorTemplateArg.
//
//   'en' → Template:Party color via action=expandtemplates (en.wikipedia)
//          One API call per party name, results cached per session.

import { fetchWikitext } from './wikipedia'
import type { ElectionParty } from '../types/atlas'

const TIMEOUT_MS = 8_000

function withTimeout(outer?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  return outer ? AbortSignal.any([outer, timeout]) : timeout
}

function normalizeHex(raw: string): string | null {
  const s = raw.trim().replace(/&#35;/g, '#')  // decode HTML entity for #
  const h = s.startsWith('#') ? s : `#${s}`
  if (!/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(h)) return null
  // #F8F9FA is the "not found" default from Module:Political party — treat as null
  if (h.toUpperCase() === '#F8F9FA') return null
  return h
}

// ── Caches ────────────────────────────────────────────────────────────────────

// Parsed es switch template (loaded once per session)
const _switchMap = new Map<string, Map<string, string>>()   // 'es' → Map<name, hex>
// expandtemplates results: "en:partyName" → hex  ('' = confirmed not found)
const _expandCache = new Map<string, string>()

// ── Part 1: Spanish #switch template ─────────────────────────────────────────

function parseSwitchTemplate(raw: string): Map<string, string> {
  const map = new Map<string, string>()

  // Section headers like ==== España ==== live inside <!-- --> comments — strip them.
  // Each entry is then either:
  //   | Name = <nowiki>#HEX</nowiki>   (direct entry)
  //   | Name                           (alias: shares value with next direct entry)
  const text = raw.replace(/<!--[\s\S]*?-->/g, '')

  const parts = text.split('|')
  const pending: string[] = []   // aliases waiting for a hex value

  for (const part of parts) {
    const s = part.trim()
    if (!s) continue

    // Skip template plumbing: {{, #switch, includeonly, closing }}
    if (
      s.startsWith('{') ||
      /^[}\s]+$/.test(s) ||
      s.startsWith('#switch') ||
      s.startsWith('includeonly') ||
      s.startsWith('/includeonly') ||
      s.startsWith('noinclude') ||
      s.startsWith('/noinclude')
    ) {
      pending.length = 0
      continue
    }

    // Direct entry: "Party name = <nowiki>#XXXXXX</nowiki>"
    const hexMatch = s.match(/^([^=<{}\n]+?)\s*=\s*<nowiki>(#[0-9A-Fa-f]{3,6})<\/nowiki>/)
    if (hexMatch) {
      const name = hexMatch[1].trim()
      const hex  = hexMatch[2]
      if (name) {
        pending.push(name)
        for (const alias of pending) map.set(alias, hex)
      }
      pending.length = 0
    } else {
      // Alias candidate: plain text, no assignment
      const cleaned = s.replace(/[{}[\]<>]/g, '').trim()
      if (cleaned && cleaned.length < 100 && !cleaned.startsWith('#') && !cleaned.includes('=')) {
        pending.push(cleaned)
      } else {
        pending.length = 0
      }
    }
  }

  return map
}

async function loadSwitchMap(signal: AbortSignal): Promise<Map<string, string>> {
  if (_switchMap.has('es')) return _switchMap.get('es')!

  const wikitext = await fetchWikitext('Plantilla:Color_político', 'es', signal)
  if (!wikitext) {
    console.warn('[colors] ⚠ failed to fetch Plantilla:Color_político')
    return new Map()
  }

  const map = parseSwitchTemplate(wikitext)
  console.log(`[colors] es switch template loaded: ${map.size} entries`)

  const critical = [
    'PP', 'PSOE', 'Vox', 'Sumar',
    'Partido Popular', 'Partido Socialista Obrero Español',
    'Partido Laborista (Reino Unido)', 'Partido Conservador (Reino Unido)',
  ]
  const missing = critical.filter(n => !map.has(n))
  if (missing.length) {
    console.warn('[colors] ⚠ critical parties missing from switch:', missing)
  } else {
    console.log('[colors] ✓ all 8 critical parties found')
  }

  _switchMap.set('es', map)
  return map
}

async function resolveColorsViaSwitch(
  parties: ElectionParty[],
  signal: AbortSignal,
): Promise<ElectionParty[]> {
  const map = await loadSwitchMap(signal)
  if (!map.size) return parties

  const needColor = parties.filter(p => p.colorHex === null && p.colorTemplateArg !== null)
  let hits = 0

  const updated = parties.map(p => {
    if (p.colorHex !== null || p.colorTemplateArg === null) return p
    const hex = map.get(p.colorTemplateArg)
    if (hex) { hits++; return { ...p, colorHex: hex } }
    return p
  })

  console.log(`[colors] switch resolved: ${hits}/${needColor.length}`)
  if (hits > 0) {
    const examples = updated
      .filter(p => p.colorHex !== null)
      .slice(0, 4)
      .map(p => `${p.name} → ${p.colorHex}`)
      .join(', ')
    console.log(`[colors] examples: ${examples}`)
  }

  return updated
}

// ── Part 2: English expandtemplates ──────────────────────────────────────────

async function expandPartyColor(name: string, signal: AbortSignal): Promise<string | null> {
  const cacheKey = `en:${name}`
  if (_expandCache.has(cacheKey)) {
    const cached = _expandCache.get(cacheKey)!
    return cached || null   // '' stored as sentinel for "not found"
  }

  const text = `{{Party color|${name}}}`
  const url =
    `https://en.wikipedia.org/w/api.php` +
    `?action=expandtemplates&text=${encodeURIComponent(text)}` +
    `&prop=wikitext&format=json&origin=*`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AtlasPolitico/1.0' },
      signal: withTimeout(signal),
    })
    if (!res.ok) { _expandCache.set(cacheKey, ''); return null }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any
    const raw = (data.expandtemplates?.wikitext ?? '').trim()
    const hex = normalizeHex(raw)
    _expandCache.set(cacheKey, hex ?? '')
    return hex
  } catch {
    return null   // timeout / network error / abort — non-fatal
  }
}

async function resolveColorsViaExpandTemplates(
  parties: ElectionParty[],
  signal: AbortSignal,
): Promise<ElectionParty[]> {
  const unresolved = parties
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.colorHex === null && p.name !== '')

  if (!unresolved.length) return parties

  console.log(`[colors] expandtemplates: resolving ${unresolved.length} parties`)

  const results = await Promise.all(
    unresolved.map(async ({ p, i }) => ({ i, hex: await expandPartyColor(p.name, signal) }))
  )

  const colorMap = new Map(results.filter(r => r.hex).map(r => [r.i, r.hex!]))
  console.log(`[colors] expandtemplates resolved: ${colorMap.size}/${unresolved.length}`)

  return parties.map((p, i) => {
    const hex = colorMap.get(i)
    return hex ? { ...p, colorHex: hex } : p
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function resolvePartyColors(
  parties: ElectionParty[],
  lang: 'es' | 'en',
  signal: AbortSignal,
): Promise<ElectionParty[]> {
  try {
    return lang === 'es'
      ? await resolveColorsViaSwitch(parties, signal)
      : await resolveColorsViaExpandTemplates(parties, signal)
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    console.warn('[colors] resolvePartyColors failed unexpectedly, returning parties unchanged:', err)
    return parties
  }
}
