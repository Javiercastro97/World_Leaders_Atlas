const ENDPOINT = 'https://query.wikidata.org/sparql'

const HEADERS = {
  'Accept': 'application/sparql-results+json',
  // Sin este User-Agent Wikidata devuelve 403
  'User-Agent': 'AtlasPolitico/1.0',
  'Content-Type': 'application/x-www-form-urlencoded',
}

// Tipos del protocolo SPARQL JSON
export interface SparqlValue {
  type: 'uri' | 'literal' | 'bnode'
  value: string
  datatype?: string
  'xml:lang'?: string
}

export interface SparqlResponse<T extends Record<string, SparqlValue>> {
  results: {
    bindings: Partial<T>[]
  }
}

// Cache en memoria: clave = texto de la query
const _cache = new Map<string, SparqlResponse<Record<string, SparqlValue>>>()

// TODO (Paso 8): implementar throttle real (~5 req/s) con cola de promesas.
// Por ahora el volumen de queries es bajo (una por click de país) y no lo necesitamos.

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

export async function querySparql<T extends Record<string, SparqlValue>>(
  sparql: string,
  signal?: AbortSignal,
): Promise<SparqlResponse<T>> {
  const cached = _cache.get(sparql)
  if (cached) return cached as SparqlResponse<T>

  let lastError: Error = new Error('No attempts made')

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: HEADERS,
        body: `query=${encodeURIComponent(sparql)}`,
        signal: withTimeout(signal),
      })

      if (!res.ok) {
        if (!isTransient(res.status)) {
          // 4xx errors are our fault — don't retry
          throw new Error(`Wikidata ${res.status}: ${res.statusText}`)
        }
        lastError = new Error(`Wikidata ${res.status}: ${res.statusText}`)
      } else {
        const data = (await res.json()) as SparqlResponse<T>
        _cache.set(sparql, data as SparqlResponse<Record<string, SparqlValue>>)
        return data
      }
    } catch (err) {
      const name = (err as Error).name
      if (name === 'AbortError') throw err
      // TimeoutError and network errors are transient — retry
      if (name === 'TimeoutError' || err instanceof TypeError) {
        lastError = err as Error
      } else {
        // Non-transient error thrown explicitly above — propagate immediately
        throw err
      }
    }

    if (attempt < RETRY_DELAYS.length) {
      await sleep(RETRY_DELAYS[attempt], signal)
    }
  }

  throw lastError
}
