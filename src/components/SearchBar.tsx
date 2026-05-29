import { useState, useRef, useEffect } from 'react'
import { getAllCountries } from '../lib/countryMap'

const ALL = getAllCountries()

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const S = {
  wrapper: {
    position: 'fixed' as const,
    top: '110px',
    left: '32px',
    width: '272px',
    zIndex: 40,
    fontFamily: 'var(--font-ui)',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    background: 'transparent',
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    padding: '10px 4px 10px 8px',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    letterSpacing: '0.005em',
    color: 'var(--ink-2)',
    minWidth: 0,
  },
  kbd: {
    fontFamily: 'var(--font-ui)',
    fontSize: '10px',
    color: 'var(--ink-4)',
    background: 'var(--paper-2)',
    padding: '2px 6px',
    borderRadius: '2px' as const,
    lineHeight: 1,
    marginRight: '8px',
    flexShrink: 0,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 8px',
    color: 'var(--ink-4)',
    fontSize: '16px',
    lineHeight: 1,
    flexShrink: 0,
  },
  list: {
    margin: '4px 0 0',
    padding: '6px 0',
    listStyle: 'none',
    background: '#FBF8F1',
    border: '1px solid var(--rule)',
    boxShadow: '0 1px 2px rgba(26,26,26,0.04), 0 8px 24px -12px rgba(26,26,26,0.18)',
    maxHeight: '320px',
    overflowY: 'auto' as const,
  },
  item: {
    padding: '8px 14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    transition: 'background 80ms',
  },
  itemActive: {
    background: 'var(--paper-2)',
  },
  itemName: {
    fontSize: '13px',
    color: 'var(--ink)',
    lineHeight: 1.3,
  },
  itemIso: {
    fontSize: '10.5px',
    letterSpacing: '0.1em',
    color: 'var(--ink-4)',
    fontVariantNumeric: 'tabular-nums' as const,
    fontFeatureSettings: '"tnum"' as const,
    flexShrink: 0,
    marginLeft: '8px',
  },
}

interface Props {
  onSelect: (numericId: string) => void
}

export default function SearchBar({ onSelect }: Props) {
  const [query,     setQuery]     = useState('')
  const [focused,   setFocused]   = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLUListElement>(null)

  const q = normalize(query.trim())
  const results = q.length < 2
    ? []
    : ALL.filter(c =>
        normalize(c.name).includes(q) ||
        normalize(c.nameEn).includes(q) ||
        normalize(c.iso3).includes(q)
      ).slice(0, 8)

  const isOpen  = focused && results.length > 0
  const showKbd = !query && !focused

  function select(numeric: string) {
    onSelect(numeric)
    setQuery('')
    setActiveIdx(-1)
    inputRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setQuery('')
      setActiveIdx(-1)
      inputRef.current?.blur()
      return
    }
    if (!isOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      select(results[activeIdx].numeric)
    }
  }

  useEffect(() => { setActiveIdx(-1) }, [q])

  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const el = listRef.current.children[activeIdx] as HTMLElement | undefined
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx])

  return (
    <div style={S.wrapper} role="search">
      <div
        style={S.inputRow}
        className={`sb-input-row${focused ? ' is-focused' : ''}`}
      >
        <input
          ref={inputRef}
          id="atlas-search"
          type="search"
          placeholder="Buscar país"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
          style={S.input}
          aria-label="Buscar país"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-expanded={isOpen}
          autoComplete="off"
          spellCheck={false}
        />
        {showKbd && (
          <kbd style={S.kbd} aria-hidden="true">/</kbd>
        )}
        {query && (
          <button
            style={S.clearBtn}
            onMouseDown={e => { e.preventDefault(); setQuery(''); inputRef.current?.focus() }}
            aria-label="Limpiar búsqueda"
            tabIndex={-1}
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          id="search-results"
          style={S.list}
          role="listbox"
          aria-label="Resultados de búsqueda"
        >
          {results.map((c, i) => (
            <li
              key={c.numeric}
              className="sb-result-item"
              style={{
                ...S.item,
                ...(i === activeIdx ? S.itemActive : {}),
                animationDelay: `${i * 30}ms`,
              }}
              onMouseDown={() => select(c.numeric)}
              onMouseEnter={() => setActiveIdx(i)}
              role="option"
              aria-selected={i === activeIdx}
            >
              <span style={S.itemName}>{c.name}</span>
              <span style={S.itemIso}>{c.iso3}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
