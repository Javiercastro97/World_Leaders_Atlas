// In-memory cache keyed by "lang:slug"
const _cache = new Map<string, string>()

const RETRY_DELAYS = [500, 1500, 4500]
const TIMEOUT_MS   = 8_000

function isTransient(status: number): boolean {
  return status >= 500
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    const id = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
  })
}

function withTimeout(outer?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  return outer ? AbortSignal.any([outer, timeout]) : timeout
}

/**
 * Fetch raw wikitext for a Wikipedia article (section 0 only — lead section
 * contains the election infobox and is ~10× smaller than the full article).
 * @param slug  Article title (spaces or underscores both accepted)
 * @param lang  'es' | 'en'  — only these two are used in this project
 */
export async function fetchWikitext(
  slug: string,
  lang: 'es' | 'en',
  signal?: AbortSignal,
): Promise<string | null> {
  const cacheKey = `${lang}:${slug}`
  if (_cache.has(cacheKey)) return _cache.get(cacheKey)!

  // Wikipedia API accepts spaces; normalise underscores → spaces
  const title = slug.replaceAll('_', ' ')
  const url =
    `https://${lang}.wikipedia.org/w/api.php` +
    `?action=query&prop=revisions&rvprop=content&rvslots=main` +
    `&format=json&titles=${encodeURIComponent(title)}&origin=*&rvsection=0&redirects=1`

  let lastError: Error = new Error('No attempts made')

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AtlasPolitico/1.0' },
        signal: withTimeout(signal),
      })

      if (!res.ok) {
        if (!isTransient(res.status)) return null  // 4xx → article not found
        lastError = new Error(`Wikipedia ${res.status}: ${res.statusText}`)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await res.json() as any
        const pages = Object.values(data.query?.pages ?? {}) as Record<string, unknown>[]
        if (!pages.length) return null

        const page = pages[0] as { missing?: string; revisions?: { slots?: { main?: { '*'?: string } } }[] }
        if (page.missing !== undefined) return null

        const wikitext = page.revisions?.[0]?.slots?.main?.['*'] ?? null
        if (wikitext) _cache.set(cacheKey, wikitext)
        return wikitext
      }
    } catch (err) {
      const name = (err as Error).name
      if (name === 'AbortError') throw err
      // TimeoutError and network errors are transient — retry
      if (name === 'TimeoutError' || err instanceof TypeError) {
        lastError = err as Error
      } else {
        return null  // unexpected error, don't retry
      }
    }

    if (attempt < RETRY_DELAYS.length) {
      await sleep(RETRY_DELAYS[attempt], signal)
    }
  }

  console.warn(`[wikipedia] ${lang}:${slug} failed after retries (last: ${lastError.message})`)
  return null
}
