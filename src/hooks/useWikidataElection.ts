import { useEffect, useState } from 'react'
import { querySparql, type SparqlValue } from '../lib/sparql'
import { fetchWikitext } from '../lib/wikipedia'
import { detectElectionInfobox, type ElectionParseResult } from '../lib/electionParser'
import { resolvePartyColors } from '../lib/wikipediaColors'
import type { ElectionData, ElectionFallback, ElectionParty, ElectionTypeToShow } from '../types/atlas'
import electoralSystems from '../data/electoral-systems.json'

// Neutral gray palette for parties without a hex color in the infobox.
// Ordered darkest → lightest; #C9C9C9 is reserved for the "Otros" bar.
const NEUTRAL_GRAYS = [
  '#2A2A2A', '#3F3F3F', '#545454', '#6B6B6B',
  '#828282', '#9A9A9A', '#B2B2B2', '#C9C9C9',
]

export const OTROS_COLOR = '#C9C9C9'

// ── SPARQL queries ────────────────────────────────────────────────────────────
// LIMIT 5 in the inner subSELECT + FILTER BOUND in the outer query ensures we
// pick the most recent election that actually has a Wikipedia article.
//
// Date precision filter (wikibase:timePrecision >= 10):
// Wikidata pre-creates future election items with year-only dates (precision=9,
// stored as Jan 1 of that year). These pass FILTER(?date < NOW()) even when the
// actual election hasn't happened yet. Requiring at least month precision (10)
// excludes those placeholder items while keeping all real past elections.

function innerWhere(qid: string, typeFilter: string): string {
  return `
      ?election wdt:P31 ?type ;
                wdt:P1001 wd:${qid} ;
                p:P585 ?dateStmt .
      ?dateStmt psv:P585 ?dateV .
      ?dateV wikibase:timeValue ?date ;
             wikibase:timePrecision ?prec .
      ${typeFilter}
      FILTER(?type NOT IN (wd:Q1128324, wd:Q6508670))
      FILTER(?date < NOW())
      FILTER(?prec >= 10)`
}

function outerSelect(innerWhere: string): string {
  return `
SELECT ?election ?electionLabel ?date ?esSlug ?enSlug WHERE {
  {
    SELECT DISTINCT ?election ?date WHERE {${innerWhere}
    }
    ORDER BY DESC(?date)
    LIMIT 5
  }
  OPTIONAL {
    ?esArticle schema:about ?election ;
               schema:isPartOf <https://es.wikipedia.org/> ;
               schema:name ?esSlug .
  }
  OPTIONAL {
    ?enArticle schema:about ?election ;
               schema:isPartOf <https://en.wikipedia.org/> ;
               schema:name ?enSlug .
  }
  FILTER(BOUND(?esSlug) || BOUND(?enSlug))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(BOUND(?esSlug)) DESC(?date)
LIMIT 1`.trim()
}

// Presidential variant: when the presidential sub-election item (e.g. Q83975602
// for Brazil 2022) has no Wikipedia sitelinks, fall back to the parent general
// election item via P361 ("part of"). COALESCE prefers the direct sitelink and
// only uses the parent's if the direct one is absent.
function outerSelectPresidential(innerWhereClause: string): string {
  return `
SELECT ?election ?electionLabel ?date ?esSlug ?enSlug WHERE {
  {
    SELECT DISTINCT ?election ?date WHERE {${innerWhereClause}
    }
    ORDER BY DESC(?date)
    LIMIT 5
  }
  OPTIONAL {
    ?esArticle schema:about ?election ;
               schema:isPartOf <https://es.wikipedia.org/> ;
               schema:name ?esSlugDirect .
  }
  OPTIONAL {
    ?enArticle schema:about ?election ;
               schema:isPartOf <https://en.wikipedia.org/> ;
               schema:name ?enSlugDirect .
  }
  OPTIONAL {
    ?election wdt:P361 ?parentEs .
    ?esArticleP schema:about ?parentEs ;
                schema:isPartOf <https://es.wikipedia.org/> ;
                schema:name ?esSlugParent .
  }
  OPTIONAL {
    ?election wdt:P361 ?parentEn .
    ?enArticleP schema:about ?parentEn ;
                schema:isPartOf <https://en.wikipedia.org/> ;
                schema:name ?enSlugParent .
  }
  BIND(COALESCE(?esSlugDirect, ?esSlugParent) AS ?esSlug)
  BIND(COALESCE(?enSlugDirect, ?enSlugParent) AS ?enSlug)
  FILTER(BOUND(?esSlug) || BOUND(?enSlug))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
ORDER BY DESC(BOUND(?esSlug)) DESC(?date)
LIMIT 1`.trim()
}

// General election query — Q40231 = public election (broad subclass).
function buildElectionQuery(qid: string): string {
  return outerSelect(innerWhere(qid, '?type wdt:P279* wd:Q40231 .'))
}

// Presidential election query — Q858439 = presidential election (with subclasses).
// Uses outerSelectPresidential to resolve sitelinks via P361 parent when the
// presidential sub-election item has no direct Wikipedia article.
function buildPresidentialElectionQuery(qid: string): string {
  return outerSelectPresidential(innerWhere(qid, '?type wdt:P279* wd:Q858439 .'))
}

// Legislative election query — Q2618461 = legislative election (with subclasses).
// Note: Q40222 is NOT parliamentary election — Q2618461 is the correct Wikidata class.
function buildLegislativeElectionQuery(qid: string): string {
  return outerSelect(innerWhere(qid, '?type wdt:P279* wd:Q2618461 .'))
}

// ── Data assembly ─────────────────────────────────────────────────────────────

function assignColors(parties: ElectionParty[]): ElectionParty[] {
  let grayIdx = 0
  return parties.map(p => ({
    ...p,
    // Cycle through the 7 darker grays (index 0-6); index 7 (#C9C9C9) is reserved for "Otros"
    colorHex: p.colorHex ?? NEUTRAL_GRAYS[grayIdx++ % (NEUTRAL_GRAYS.length - 1)],
  }))
}

function buildElectionData(
  parsed: ElectionParseResult,
  electionQid: string,
  electionLabel: string,
  year: number | null,
  wikipediaUrl: string,
  electionType: ElectionTypeToShow,
): ElectionData {
  const parties = assignColors(parsed.parties)

  const hasPct       = parties.some(p => p.pct !== null)
  const totalPct     = hasPct ? parties.reduce((s, p) => s + (p.pct ?? 0), 0) : null
  const isIncomplete = totalPct !== null && totalPct < 95

  // Inherit second-round colors from the colored first-round parties (matched by name)
  let secondRound: ElectionParty[] | null = null
  if (parsed.secondRound && parsed.secondRound.length >= 2) {
    const colorMap = new Map(parties.map(p => [p.name, p.colorHex]))
    secondRound = parsed.secondRound.map(p => ({
      ...p,
      colorHex: colorMap.get(p.name) ?? p.colorHex,
    }))
  }

  return {
    source: 'wikipedia',
    templateLang: parsed.templateLang,
    electionQid,
    electionLabel,
    year: year ?? parsed.year,
    turnout: parsed.turnout,
    parties,
    secondRound,
    turnoutSecondRound: parsed.turnoutSecondRound,
    isIncomplete,
    wikipediaUrl,
    electionType,
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface ElectionState {
  loading: boolean
  error: string | null
  data: ElectionData | ElectionFallback | null
}

export function useWikidataElection(countryQid: string | null): ElectionState {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [data,    setData]    = useState<ElectionData | ElectionFallback | null>(null)

  useEffect(() => {
    if (!countryQid) {
      setData(null); setError(null); return
    }

    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    setData(null)

    void (async () => {
      try {
        // ── Capa C-a: electoral-systems.json lookup ───────────────────────────
        const entry = (electoralSystems as Record<string, { electionTypeToShow: ElectionTypeToShow; note: string }>)[countryQid]

        if (!entry) {
          console.warn(`[election] ${countryQid} sin clasificar en electoral-systems.json — usando query genérica`)
        }

        const electionType: ElectionTypeToShow = entry?.electionTypeToShow ?? 'general'

        if (electionType === 'none') {
          setData({
            source:  'fallback',
            variant: 'no-elections',
            reason:  entry!.note,
            url:     null,
          })
          return
        }

        // ── Wikidata: locate most recent election by type ─────────────────────
        const buildTypedQuery =
          electionType === 'presidential' ? buildPresidentialElectionQuery :
          electionType === 'legislative'  ? buildLegislativeElectionQuery  :
                                            buildElectionQuery

        let res = await querySparql<Record<string, SparqlValue>>(
          buildTypedQuery(countryQid),
          ctrl.signal,
        )

        console.log(`[election] ${countryQid}: type=${electionType} result=${res.results.bindings[0]?.election?.value ?? 'none'}`)

        // Fallback cascade: typed query returned nothing → retry with general query
        if (!res.results.bindings[0]?.election && electionType !== 'general' && !ctrl.signal.aborted) {
          console.warn(`[election] ${countryQid}: ${electionType} query empty — retrying with general`)
          res = await querySparql<Record<string, SparqlValue>>(
            buildElectionQuery(countryQid),
            ctrl.signal,
          )
        }

        const b = res.results.bindings[0]

        if (!b?.election) {
          setData({
            source:  'fallback',
            variant: 'no-data',
            reason:  'No se encontraron elecciones recientes en Wikidata.',
            url:     null,
          })
          return
        }

        const electionQid   = b.election.value.split('/entity/')[1]
        const electionLabel = b.electionLabel?.value ?? ''
        const dateStr       = b.date?.value ?? ''
        const year          = dateStr ? parseInt(dateStr.replace(/^\+/, '').slice(0, 4), 10) : null
        const esSlug        = b.esSlug?.value ?? null
        const enSlug        = b.enSlug?.value ?? null

        const esWikiUrl = esSlug
          ? `https://es.wikipedia.org/wiki/${esSlug.replaceAll(' ', '_')}`
          : null
        const enWikiUrl = enSlug
          ? `https://en.wikipedia.org/wiki/${enSlug.replaceAll(' ', '_')}`
          : null
        const fallbackUrl = esWikiUrl ?? enWikiUrl ?? null

        const isPresidential = electionType === 'presidential'

        // ── Capa B-1: es.wikipedia (preferred) ───────────────────────────────
        if (esSlug && !ctrl.signal.aborted) {
          const wikitext = await fetchWikitext(esSlug, 'es', ctrl.signal)
          if (wikitext) {
            const parsed = detectElectionInfobox(wikitext, 'es', isPresidential)
            if (parsed) {
              // Show chart immediately with gray fallback colors
              setData(buildElectionData(parsed, electionQid, electionLabel, year, esWikiUrl ?? '', electionType))
              // Resolve colors in background — update silently when ready
              resolvePartyColors(parsed.parties, parsed.templateLang, ctrl.signal).then(coloredParties => {
                if (ctrl.signal.aborted) return
                setData(buildElectionData({ ...parsed, parties: coloredParties }, electionQid, electionLabel, year, esWikiUrl ?? '', electionType))
              }).catch(() => { /* non-fatal */ })
              return
            }
          }
        }

        // ── Capa B-2: en.wikipedia (fallback) ────────────────────────────────
        if (enSlug && !ctrl.signal.aborted) {
          const wikitext = await fetchWikitext(enSlug, 'en', ctrl.signal)
          if (wikitext) {
            const parsed = detectElectionInfobox(wikitext, 'en', isPresidential)
            if (parsed) {
              // Show chart immediately with gray fallback colors
              setData(buildElectionData(parsed, electionQid, electionLabel, year, enWikiUrl ?? '', electionType))
              // Resolve colors in background — update silently when ready
              resolvePartyColors(parsed.parties, parsed.templateLang, ctrl.signal).then(coloredParties => {
                if (ctrl.signal.aborted) return
                setData(buildElectionData({ ...parsed, parties: coloredParties }, electionQid, electionLabel, year, enWikiUrl ?? '', electionType))
              }).catch(() => { /* non-fatal */ })
              return
            }
          }
        }

        // ── Capa C-b: Wikipedia article exists but infobox not parseable ──────
        console.warn(`[election] ${countryQid}: falling back to no-wikipedia (${fallbackUrl ?? 'no URL'})`)
        setData({
          source:  'fallback',
          variant: 'no-wikipedia',
          reason:  'No se pudo extraer el infobox de resultados de Wikipedia.',
          url:     fallbackUrl,
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError')
          setError('Error al obtener datos electorales.')
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    })()

    return () => ctrl.abort()
  }, [countryQid])

  return { loading, error, data }
}
