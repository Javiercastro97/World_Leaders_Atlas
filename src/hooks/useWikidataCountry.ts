import { useEffect, useState } from 'react'
import { querySparql } from '../lib/sparql'
import type { SparqlValue } from '../lib/sparql'
import type { Leader, Party, CountryData } from '../types/atlas'
import stateOverrides from '../data/heads-of-state-override.json'

type Binding = Record<string, SparqlValue>

// Variables con nombres simples para compatibilidad garantizada con el label service de Wikibase.
// gov = P6 (jefe de gobierno)  |  stt = P35 (jefe de estado)
function buildQuery(qid: string): string {
  return `
SELECT
  ?gov ?govLabel ?govImage ?govSince ?govPos ?govPosLabel
  ?govParty ?govPartyLabel ?govPartyLogo ?govPartyColor ?govPartyFounded ?govIdeology ?govIdeologyLabel
  ?stt ?sttLabel ?sttImage ?sttSince ?sttPos ?sttPosLabel
  ?sttParty ?sttPartyLabel ?sttPartyLogo ?sttPartyColor ?sttPartyFounded ?sttIdeology ?sttIdeologyLabel
  ?allGovForms
WHERE {
  OPTIONAL {
    wd:${qid} p:P6 ?govStmt .
    ?govStmt ps:P6 ?gov .
    FILTER NOT EXISTS { ?govStmt pq:P582 ?govEnd }
    ?gov wdt:P31 wd:Q5 .
    OPTIONAL { ?govStmt pq:P580 ?govSince }
    OPTIONAL { ?gov wdt:P18 ?govImage }
    OPTIONAL {
      ?gov p:P39 ?govPosStmt .
      ?govPosStmt ps:P39 ?govPos .
      FILTER NOT EXISTS { ?govPosStmt pq:P582 ?govPosEnd }
      ?govPos wdt:P1001 wd:${qid} .
    }
    OPTIONAL {
      ?gov p:P102 ?govPartyStmt .
      ?govPartyStmt ps:P102 ?govParty .
      FILTER NOT EXISTS { ?govPartyStmt pq:P582 ?govPartyEnd }
      OPTIONAL { ?govParty wdt:P154 ?govPartyLogo }
      OPTIONAL { ?govParty wdt:P465 ?govPartyColor }
      OPTIONAL { ?govParty wdt:P571 ?govPartyFounded }
      OPTIONAL { ?govParty wdt:P1142 ?govIdeology }
    }
  }
  OPTIONAL {
    wd:${qid} p:P35 ?sttStmt .
    ?sttStmt ps:P35 ?stt .
    FILTER NOT EXISTS { ?sttStmt pq:P582 ?sttEnd }
    ?stt wdt:P31 wd:Q5 .
    OPTIONAL { ?sttStmt pq:P580 ?sttSince }
    OPTIONAL { ?stt wdt:P18 ?sttImage }
    OPTIONAL {
      ?stt p:P39 ?sttPosStmt .
      ?sttPosStmt ps:P39 ?sttPos .
      FILTER NOT EXISTS { ?sttPosStmt pq:P582 ?sttPosEnd }
      ?sttPos wdt:P1001 wd:${qid} .
    }
    OPTIONAL {
      ?stt p:P102 ?sttPartyStmt .
      ?sttPartyStmt ps:P102 ?sttParty .
      FILTER NOT EXISTS { ?sttPartyStmt pq:P582 ?sttPartyEnd }
      OPTIONAL { ?sttParty wdt:P154 ?sttPartyLogo }
      OPTIONAL { ?sttParty wdt:P465 ?sttPartyColor }
      OPTIONAL { ?sttParty wdt:P571 ?sttPartyFounded }
      OPTIONAL { ?sttParty wdt:P1142 ?sttIdeology }
    }
  }
  {
    SELECT (GROUP_CONCAT(DISTINCT ?cgLabel; SEPARATOR=" | ") AS ?allGovForms)
    WHERE {
      OPTIONAL {
        wd:${qid} wdt:P122 ?cg .
        ?cg rdfs:label ?cgLabel .
        FILTER(LANG(?cgLabel) IN ("es","en"))
      }
    }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en,de,fr,mul". }
}
LIMIT 1`.trim()
}

// Sistema donde el jefe de ESTADO (P35) es el líder real:
//   - presidencial / semipresidencial (Rusia, EE.UU., Francia, Venezuela…)
//   - república popular / socialista de partido único (China, Cuba, Vietnam…)
// Todo lo demás (parlamentario, monarquía) → usar P6 (jefe de gobierno)
// Exported so useWikidataElection can reuse the same detection logic.
export function isExecutiveHeadOfState(govFormLabel: string): boolean {
  const l = govFormLabel.toLowerCase()
  return /presidencial|presidential|semi.?presidential|semi.?presidencial/.test(l)
      || /\bpopular\b/.test(l)
      || /socialista|socialist/.test(l)
      || /comunista|communist/.test(l)
      || /\bjunta\b/.test(l)
}

function toHttps(url: string): string {
  return url.startsWith('http:') ? 'https:' + url.slice(5) : url
}

function parseDate(val: string | undefined, chars: 4 | 10): string | null {
  if (!val) return null
  return val.replace(/^\+/, '').slice(0, chars) || null
}

function buildLeader(b: Partial<Binding>, prefix: 'gov' | 'stt'): Leader | null {
  const entity = b[prefix]
  if (!entity) return null
  return {
    qid:      entity.value.split('/entity/')[1] ?? '',
    name:     b[`${prefix}Label`]?.value ?? '',
    role:     b[`${prefix}PosLabel`]?.value ?? null,
    imageUrl: b[`${prefix}Image`] ? toHttps(b[`${prefix}Image`]!.value) : null,
    since:    parseDate(b[`${prefix}Since`]?.value, 10),
  }
}

function buildParty(b: Partial<Binding>, prefix: 'gov' | 'stt'): Party | null {
  const partyEntity = b[`${prefix}Party`]
  if (!partyEntity) return null
  return {
    qid:      partyEntity.value.split('/entity/')[1],
    name:     b[`${prefix}PartyLabel`]?.value ?? '',
    logoUrl:  b[`${prefix}PartyLogo`] ? toHttps(b[`${prefix}PartyLogo`]!.value) : null,
    color:    b[`${prefix}PartyColor`]?.value ?? null,
    ideology: b[`${prefix}IdeologyLabel`]?.value ?? null,
    founded:  parseDate(b[`${prefix}PartyFounded`]?.value, 4),
  }
}

export interface WikidataCountryState {
  loading: boolean
  error: string | null
  data: CountryData | null
}

export function useWikidataCountry(qid: string | null): WikidataCountryState {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CountryData | null>(null)

  useEffect(() => {
    if (!qid) {
      setData(null)
      setError(null)
      return
    }

    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    setData(null)

    querySparql<Binding>(buildQuery(qid), ctrl.signal)
      .then(result => {
        const b = result.results.bindings[0]

        if (!b) {
          setData({ leader: null, party: null, fetchedAt: new Date() })
          return
        }

        const allGovForms = b.allGovForms?.value ?? ''
        const override = stateOverrides[qid as keyof typeof stateOverrides]
        const useStt = !!b.stt && (!b.gov || override?.preferState === true || isExecutiveHeadOfState(allGovForms))
        const prefix = useStt ? 'stt' : 'gov'

        const leader = buildLeader(b, prefix)
        const party  = buildParty(b, prefix)

        setData({ leader, party, fetchedAt: new Date() })
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError')
          setError('Error al conectar con Wikidata. Inténtalo de nuevo.')
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })

    return () => ctrl.abort()
  }, [qid])

  return { loading, error, data }
}
