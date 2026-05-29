import { useState } from 'react'
import type { Leader } from '../types/atlas'

const S = {
  root: {
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-start',
  },
  photo: {
    width: '96px',
    height: '96px',
    objectFit: 'cover' as const,
    borderRadius: '4px',
    flexShrink: 0,
    display: 'block',
  },
  photoPlaceholder: {
    width: '96px',
    height: '96px',
    background: 'var(--rule)',
    borderRadius: '4px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSkeleton: {
    width: '96px',
    height: '96px',
    borderRadius: '4px',
    flexShrink: 0,
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
    fontSize: '26px',
    fontWeight: 500,
    color: 'var(--ink)',
    margin: '0 0 4px',
    lineHeight: 1.15,
  },
  role: {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--ink-soft)',
    margin: '0 0 4px',
  },
  since: {
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
  },
}

interface Props {
  leader: Leader | null
  loading: boolean
}

export default function HeadOfGovernmentCard({ leader, loading }: Props) {
  const [imgError, setImgError] = useState(false)

  if (loading) {
    return (
      <div style={S.root}>
        <div style={S.photoSkeleton} className="shimmer" />
        <div style={S.info}>
          <div style={{ ...S.photoSkeleton, width: '80px', height: '10px', borderRadius: '2px', marginBottom: '10px' }} className="shimmer" />
          <div style={{ ...S.photoSkeleton, width: '180px', height: '22px', borderRadius: '2px', marginBottom: '8px' }} className="shimmer" />
          <div style={{ ...S.photoSkeleton, width: '140px', height: '12px', borderRadius: '2px' }} className="shimmer" />
        </div>
      </div>
    )
  }

  if (!leader) {
    return (
      <p style={S.mutedText}>Sin datos del jefe de gobierno en Wikidata.</p>
    )
  }

  const showImage = leader.imageUrl && !imgError

  return (
    <div style={S.root}>
      {showImage ? (
        <img
          src={`${leader.imageUrl}?width=192`}
          alt={leader.name}
          style={S.photo}
          onError={() => setImgError(true)}
        />
      ) : (
        <div style={S.photoPlaceholder}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)', textAlign: 'center', padding: '4px' }}>
            Sin imagen
          </span>
        </div>
      )}

      <div style={S.info}>
        <p style={S.label}>Jefe de Gobierno</p>
        <h2 style={S.name}>{leader.name}</h2>
        {leader.role && <p style={S.role}>{leader.role}</p>}
        {leader.since && (
          <p style={S.since}>En el cargo desde {leader.since}</p>
        )}
      </div>
    </div>
  )
}
