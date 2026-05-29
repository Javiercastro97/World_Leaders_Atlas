import codesRaw from '../data/country-codes.json'
import type { CountryMeta } from '../types/atlas'

type RawEntry = { qid: string; iso3: string; name: string; nameEn: string }

const codes = codesRaw as Record<string, RawEntry>

export function getCountryByNumericId(numericId: string): CountryMeta | null {
  return codes[numericId] ?? null
}

export function getAllCountries(): Array<CountryMeta & { numeric: string }> {
  return Object.entries(codes).map(([numeric, entry]) => ({ ...entry, numeric }))
}
