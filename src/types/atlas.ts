export interface CountryMeta {
  qid: string
  iso3: string
  name: string
  nameEn: string
}

export interface Leader {
  qid: string
  name: string
  role: string | null
  imageUrl: string | null
  since: string | null
}

export interface Party {
  qid: string
  name: string
  logoUrl: string | null
  color: string | null
  ideology: string | null
  founded: string | null
}

export interface CountryData {
  leader: Leader | null
  party: Party | null
  fetchedAt: Date
}

// ── Elections ─────────────────────────────────────────────────────────────────

export type ElectionTypeToShow = 'presidential' | 'legislative' | 'general' | 'none'

export interface ElectionParty {
  name: string
  colorHex: string | null
  /** Argument inside {{Color político|XXX}} if the color field used that template (not a hex) */
  colorTemplateArg: string | null
  /** Wikilink destination from the partido name field, e.g. [[Destino|Display]] → "Destino" */
  linkTarget: string | null
  /** Candidate or party leader name; null when the field is absent in the infobox */
  candidate: string | null
  votes: number | null
  pct: number | null
  seats: number | null
}

export interface ElectionData {
  /** 'wikipedia' = Capa B (current). 'wikidata' = Capa A (future — reserved for when P710+% data exists) */
  source: 'wikipedia' | 'wikidata'
  /** Which Wikipedia template family produced this data ('es' = Ficha de elección, 'en' = Infobox election) */
  templateLang: 'es' | 'en'
  electionQid: string
  electionLabel: string
  year: number | null
  turnout: number | null
  parties: ElectionParty[]
  /** Second-round candidates with second-round pct/votes; null when no second round exists */
  secondRound: ElectionParty[] | null
  turnoutSecondRound: number | null
  /** True when total known vote share is below 95% — triggers editorial note in UI */
  isIncomplete: boolean
  /** Link to the Wikipedia election article (for "see full results" affordance) */
  wikipediaUrl: string
  /** Election type from electoral-systems.json — drives chart header and candidate display */
  electionType: ElectionTypeToShow
}

export type ElectionFallbackVariant =
  | 'no-elections'   // country has no competitive elections (override list)
  | 'no-wikipedia'   // Wikipedia article exists but infobox couldn't be parsed
  | 'no-data'        // no election item found in Wikidata at all

export interface ElectionFallback {
  source: 'fallback'
  variant: ElectionFallbackVariant
  reason: string
  url: string | null
}
