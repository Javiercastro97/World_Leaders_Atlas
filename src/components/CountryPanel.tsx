import type { CSSProperties } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { useWikidataCountry } from '../hooks/useWikidataCountry'
import { useWikidataElection } from '../hooks/useWikidataElection'
import HeadOfGovernmentCard from './HeadOfGovernmentCard'
import PartyCard from './PartyCard'
import ElectionChart, { getPrimaryMetric } from './ElectionChart'
import type { CountryMeta, ElectionData, ElectionFallback } from '../types/atlas'

interface Props {
  meta: CountryMeta | null
  numericId: string
  noStagger?: boolean
  onClose: () => void
}

function blockStyle(delay: number, noStagger: boolean): CSSProperties {
  return noStagger
    ? { animationDelay: '0ms', animationDuration: '200ms' }
    : { animationDelay: `${delay}ms` }
}

const WIKIDATA_BASE = 'https://www.wikidata.org/wiki/'

const S = {
  rule: {
    border: 'none',
    borderTop: '1px solid var(--rule)',
    margin: 0,
  },
  footerText: {
    fontFamily: 'var(--font-ui)',
    fontSize: '11px',
    color: 'var(--mute)',
    margin: 0,
    lineHeight: 1.6,
  },
  footerLink: {
    color: 'var(--mute)',
    textDecoration: 'underline',
  },
  errorBox: {
    padding: '16px',
    background: 'var(--rule)',
    borderRadius: '4px',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--ink-soft)',
  },
  retryBtn: {
    marginTop: '10px',
    background: 'none',
    border: '1px solid var(--ink-soft)',
    borderRadius: '3px',
    padding: '5px 12px',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    cursor: 'pointer',
    color: 'var(--ink-soft)',
  },
  noDataText: {
    fontFamily: 'var(--font-editorial)',
    fontSize: '14px',
    fontStyle: 'italic',
    color: 'var(--ink-3)',
    lineHeight: 1.5,
    margin: 0,
  },
  // ── Election section ──────────────────────────────────────────────────────
  electionSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  sectionLabel: {
    fontFamily: 'var(--font-ui)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--mute)',
    margin: 0,
  },
  electionNote: {
    fontFamily: 'var(--font-editorial)',
    fontSize: '14px',
    fontStyle: 'italic',
    color: 'var(--ink-3)',
    lineHeight: 1.5,
    margin: 0,
  },
  electionReason: {
    fontFamily: 'var(--font-ui)',
    fontSize: '11.5px',
    color: 'var(--ink-4)',
    lineHeight: 1.5,
    margin: '6px 0 0',
  },
  electionMeta: {
    fontFamily: 'var(--font-ui)',
    fontSize: '11px',
    color: 'var(--mute)',
    margin: 0,
    lineHeight: 1.6,
  },
  electionLink: {
    color: 'var(--mute)',
    textDecoration: 'underline',
    marginLeft: '4px',
  },
  roundDivider: {
    border: 'none',
    borderTop: '1px solid var(--rule)',
    margin: '18px 0',
  },
  dragHandle: {
    width: '36px',
    height: '4px',
    background: 'var(--ink-4)',
    borderRadius: '2px',
    margin: '8px auto 6px',
    cursor: 'grab',
    touchAction: 'none' as const,
    flexShrink: 0,
  },
}

// ── Election section sub-component ───────────────────────────────────────────

function ElectionSection({ qid }: { qid: string }) {
  const { loading, data } = useWikidataElection(qid)

  if (loading) {
    return (
      <section style={S.electionSection}>
        <p style={S.sectionLabel}>ELECCIONES</p>
        <p style={{ ...S.electionMeta, fontStyle: 'italic' }}>Cargando…</p>
      </section>
    )
  }

  if (!data) return null

  // ── Fallback variants ─────────────────────────────────────────────────────
  if (data.source === 'fallback') {
    const fb = data as ElectionFallback
    const msg =
      fb.variant === 'no-elections'
        ? 'Sistema sin elecciones generales directas.'
        : fb.variant === 'no-wikipedia'
        ? 'Datos electorales no disponibles en Wikipedia.'
        : 'No se encontraron elecciones recientes en Wikidata.'

    return (
      <section style={S.electionSection}>
        {fb.variant !== 'no-elections' && (
          <p style={S.sectionLabel}>ELECCIONES</p>
        )}
        <p style={S.electionNote}>{msg}</p>
        {fb.variant === 'no-elections' && fb.reason && (
          <p style={S.electionReason}>{fb.reason}</p>
        )}
        {fb.url && (
          <p style={S.electionMeta}>
            <a href={fb.url} target="_blank" rel="noopener noreferrer" style={S.electionLink}>
              Más información →
            </a>
          </p>
        )}
      </section>
    )
  }

  const ed = data as ElectionData
  const canGraph = getPrimaryMetric(ed.parties) !== null
  const hasSecondRound = ed.secondRound !== null && getPrimaryMetric(ed.secondRound) !== null

  const typeLabel =
    ed.electionType === 'presidential' ? 'PRESIDENCIALES' :
    ed.electionType === 'legislative'  ? 'LEGISLATIVAS'   :
    ed.electionType === 'general'      ? 'GENERALES'      :
    'ELECCIONES'

  const sectionTitle    = ed.year ? `${typeLabel} · ${ed.year}` : typeLabel
  const firstRoundLabel = hasSecondRound
    ? (ed.year ? `PRIMERA VUELTA · ${ed.year}` : 'PRIMERA VUELTA')
    : sectionTitle
  const secondRoundLabel = ed.year ? `SEGUNDA VUELTA · ${ed.year}` : 'SEGUNDA VUELTA'

  return (
    <section style={S.electionSection}>
      <p style={S.sectionLabel}>{firstRoundLabel}</p>

      {canGraph ? (
        <ElectionChart
          parties={ed.parties}
          electionType={ed.electionType}
          turnout={ed.turnout ?? null}
          wikipediaUrl={ed.wikipediaUrl}
        />
      ) : (
        <p style={S.electionNote}>
          Datos parciales no graficables.
          {ed.wikipediaUrl && (
            <a href={ed.wikipediaUrl} target="_blank" rel="noopener noreferrer" style={S.electionLink}>
              Ver en Wikipedia →
            </a>
          )}
        </p>
      )}

      {hasSecondRound && (
        <>
          <hr style={S.roundDivider} />
          <p style={S.sectionLabel}>{secondRoundLabel}</p>
          <ElectionChart
            parties={ed.secondRound!}
            electionType={ed.electionType}
            turnout={ed.turnoutSecondRound}
            wikipediaUrl={ed.wikipediaUrl}
          />
        </>
      )}

      {ed.isIncomplete && (
        <p style={S.electionMeta}>
          Mostrando solo los principales partidos representados en el infobox de Wikipedia.
        </p>
      )}
    </section>
  )
}

// ── Panel content ─────────────────────────────────────────────────────────────

function PanelContent({ qid, meta, noStagger }: { qid: string; meta: CountryMeta; noStagger: boolean }) {
  const { loading, error, data } = useWikidataCountry(qid)
  const fetchedDate = data?.fetchedAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

  if (error) {
    return (
      <div className="panel-content">
        <div style={S.errorBox}>
          {error}
          <br />
          <button style={S.retryBtn} onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="panel-content">
        <div className="p-block" style={blockStyle(240, noStagger)}>
          <HeadOfGovernmentCard leader={data?.leader ?? null} loading={loading} />
        </div>
        <hr style={S.rule} />
        <div className="p-block" style={blockStyle(360, noStagger)}>
          <PartyCard party={data?.party ?? null} loading={loading} />
        </div>
        <hr style={S.rule} />
        <div className="p-block" style={blockStyle(480, noStagger)}>
          <ElectionSection qid={qid} />
        </div>
      </div>

      <footer style={blockStyle(600, noStagger)} className="p-block panel-footer">
        <p style={S.footerText}>
          Fuente · <a
            href={`${WIKIDATA_BASE}${meta.qid}`}
            target="_blank"
            rel="noopener noreferrer"
            style={S.footerLink}
          >Wikidata</a>
          {fetchedDate && ` · revisado ${fetchedDate}`}
        </p>
      </footer>
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CountryPanel({ meta, numericId, noStagger = false, onClose }: Props) {
  const isMobile      = useIsMobile()
  const [snapPoint, setSnapPoint] = useState<'full' | 'peek'>('full')
  const [entered, setEntered]     = useState(false)
  const panelRef      = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const snapPointRef  = useRef<'full' | 'peek'>('full')
  const onCloseRef    = useRef(onClose)
  const isClosingRef  = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const mountedRef    = useRef(true)
  onCloseRef.current = onClose  // keep current without useEffect

  // Cancel any pending close timer on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current)
    }
  }, [])

  // Mount animation: panel starts off-screen, slides in after first paint
  useEffect(() => {
    if (!isMobile) return
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [isMobile])

  // Slide panel off-screen then call onClose — used by fling and button X (mobile).
  // Only refs accessed internally: safe to call from stale-closure touch handlers.
  function animatedClose() {
    if (!panelRef.current || isClosingRef.current) return
    isClosingRef.current = true
    panelRef.current.style.transition = 'transform 250ms cubic-bezier(0.4, 0, 1, 1)'
    panelRef.current.style.transform  = 'translateY(100vh)'
    closeTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) onCloseRef.current()
    }, 260)
  }

  // Touch drag — passive:false required for preventDefault().
  // Stale closure: mutable state via refs; drag workspace vars (startY,
  // baseTranslateY, currentDragY, lastY, lastTimestamp) live in the closure
  // shared by all three handlers within one gesture.
  // animatedClose accesses only refs → safe to call from this stale closure.
  useEffect(() => {
    if (!isMobile || !dragHandleRef.current || !panelRef.current) return

    const handleEl = dragHandleRef.current
    const panelEl  = panelRef.current

    let startY         = 0
    let baseTranslateY = 0
    let currentDragY   = 0
    let lastY          = 0
    let lastTimestamp  = 0

    function snapToPx(snap: 'full' | 'peek'): number {
      return snap === 'full' ? 0 : window.innerHeight * 0.5
    }

    function onTouchStart(e: TouchEvent) {
      if (isClosingRef.current) return  // don't interrupt close animation
      e.preventDefault()
      startY         = e.touches[0].clientY
      baseTranslateY = snapToPx(snapPointRef.current)
      currentDragY   = baseTranslateY
      lastY          = startY
      lastTimestamp  = Date.now()
      panelEl.style.transition = 'none'
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      const delta = e.touches[0].clientY - startY
      currentDragY = Math.max(0, Math.min(window.innerHeight * 0.9, baseTranslateY + delta))
      panelEl.style.transform = `translateY(${currentDragY}px)`
      lastY         = e.touches[0].clientY
      lastTimestamp = Date.now()
    }

    function onTouchEnd(e: TouchEvent) {
      const now    = Date.now()
      const dt     = now - lastTimestamp
      const finalY = e.changedTouches[0].clientY
      // Only trust velocity if last touchmove was recent (guards against stale data)
      const velocity = dt > 0 && dt < 100 ? (finalY - lastY) / dt : 0

      if (velocity > 1.2 || currentDragY > window.innerHeight * 0.6) {
        animatedClose()
      } else {
        const newSnap: 'full' | 'peek' = currentDragY < window.innerHeight * 0.25 ? 'full' : 'peek'
        snapPointRef.current = newSnap
        panelEl.style.transition = ''
        setSnapPoint(newSnap)
        setEntered(true)
      }
    }

    handleEl.addEventListener('touchstart', onTouchStart, { passive: false })
    handleEl.addEventListener('touchmove',  onTouchMove,  { passive: false })
    handleEl.addEventListener('touchend',   onTouchEnd)

    return () => {
      handleEl.removeEventListener('touchstart', onTouchStart)
      handleEl.removeEventListener('touchmove',  onTouchMove)
      handleEl.removeEventListener('touchend',   onTouchEnd)
    }
  }, [isMobile])

  function getMobileTransform(): string {
    if (!entered) return 'translateY(100%)'
    return snapPoint === 'full' ? 'translateY(0)' : 'translateY(50vh)'
  }

  const displayName = meta?.name ?? `Territorio ${numericId}`

  return (
    <div
      ref={panelRef}
      style={isMobile ? { transform: getMobileTransform() } : undefined}
      className="panel-overlay"
      role="complementary"
      aria-label={`Panel de ${displayName}`}
    >
      {isMobile && <div ref={dragHandleRef} style={S.dragHandle} aria-hidden="true" />}

      <header style={blockStyle(120, noStagger)} className="p-block panel-header">
        <h1 className="panel-country-name">{displayName}</h1>
        <button
          className="panel-close-btn"
          onClick={isMobile ? animatedClose : onClose}
          aria-label="Cerrar panel"
          title="Cerrar"
        >
          ×
        </button>
      </header>

      {meta === null ? (
        <div className="panel-content">
          <div className="p-block" style={blockStyle(240, noStagger)}>
            <p style={S.noDataText}>
              Datos no disponibles para este territorio.
              Este área puede corresponder a una dependencia, territorio disputado
              o zona no reconocida con cobertura limitada en Wikidata.
            </p>
          </div>
        </div>
      ) : (
        <PanelContent qid={meta.qid} meta={meta} noStagger={noStagger} />
      )}
    </div>
  )
}
