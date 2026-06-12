import { useState, useRef, useEffect } from 'react'
import WorldMap from './components/WorldMap'
import CountryPanel from './components/CountryPanel'
import SearchBar from './components/SearchBar'
import Masthead from './components/Masthead'
import { getCountryByNumericId } from './lib/countryMap'

export default function App() {
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [noStagger,   setNoStagger]   = useState(false)
  const lastOpenedAt = useRef<number>(0)

  const meta = selectedId ? getCountryByNumericId(selectedId) : null

  function handleSelect(id: string) {
    setSelectedId(prev => {
      if (prev === id) return null
      const now = Date.now()
      const isQuick = now - lastOpenedAt.current < 800
      lastOpenedAt.current = now
      setNoStagger(isQuick)
      return id
    })
  }

  function handleClose() {
    setSelectedId(null)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      document.getElementById('atlas-search')?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div
      style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}
      data-panel-open={selectedId !== null ? 'true' : 'false'}
    >
      <Masthead />
      <WorldMap selectedId={selectedId} onSelect={handleSelect} />
      <SearchBar onSelect={handleSelect} />

      {selectedId !== null && (
        <CountryPanel
          key={selectedId}
          meta={meta}
          numericId={selectedId}
          noStagger={noStagger}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
