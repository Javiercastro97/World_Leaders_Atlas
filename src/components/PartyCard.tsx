import { useState } from 'react'
import type { Party } from '../types/atlas'

const S = {
  root: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
  },
  logo: {
    width: '40px',
    height: '40px',
    objectFit: 'contain' as const,
    flexShrink: 0,
    display: 'block',
  },
  logoPlaceholder: {
    width: '40px',
    height: '40px',
    background: 'var(--rule)',
    borderRadius: '4px',
    flexShrink: 0,
  },
  colorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '6px',
  },
  info: { flex: 1, minWidth: 0 },
  label: {
    fontFamily: 'var(--font-ui)',
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--mute)',
    margin: '0 0 6px',
  },
  name: {
    fontFamily: 'var(--font-editorial)',
    fontSize: '18px',
    fontWeight: 500,
    color: 'var(--ink)',
    margin: '0 0 4px',
    lineHeight: 1.2,
  },
  meta: {
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    color: 'var(--mute)',
    margin: 0,
  },
  mutedText: {
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    color: 'var(--mute)',
    fontStyle: 'italic',
    margin: 0,
  },
  skeleton: {
    borderRadius: '2px',
  },
}

interface Props {
  party: Party | null
  loading: boolean
}

export default function PartyCard({ party, loading }: Props) {
  const [logoError, setLogoError] = useState(false)

  if (loading) {
    return (
      <div style={S.root}>
        <div style={{ ...S.logoPlaceholder, ...S.skeleton }} className="shimmer" />
        <div style={S.info}>
          <div style={{ ...S.skeleton, width: '60px', height: '10px', marginBottom: '8px' }} className="shimmer" />
          <div style={{ ...S.skeleton, width: '160px', height: '16px', marginBottom: '6px' }} className="shimmer" />
          <div style={{ ...S.skeleton, width: '100px', height: '11px' }} className="shimmer" />
        </div>
      </div>
    )
  }

  if (!party) {
    return <p style={S.mutedText}>Afiliación partidaria no disponible en Wikidata.</p>
  }

  const metaParts = [party.ideology, party.founded ? `fund. ${party.founded}` : null].filter(Boolean)

  const showLogo = party.logoUrl && !logoError

  return (
    <div style={S.root}>
      {showLogo ? (
        <img
          src={`${party.logoUrl}?width=80`}
          alt={`Logo ${party.name}`}
          style={S.logo}
          onError={() => setLogoError(true)}
        />
      ) : party.color ? (
        <div style={{ ...S.colorDot, background: `#${party.color}` }} />
      ) : (
        <div style={S.logoPlaceholder} />
      )}

      <div style={S.info}>
        <p style={S.label}>Partido</p>
        <h3 style={S.name}>{party.name}</h3>
        {metaParts.length > 0 && (
          <p style={S.meta}>{metaParts.join(' · ')}</p>
        )}
      </div>
    </div>
  )
}
