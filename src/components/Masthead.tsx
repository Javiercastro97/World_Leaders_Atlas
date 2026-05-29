const S = {
  wrapper: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    zIndex: 30,
    pointerEvents: 'none' as const,
  },
  inner: {
    pointerEvents: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  rule: {
    width: '38px',
    height: '2px',
    background: 'var(--ink)',
    marginBottom: '8px',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-editorial)',
    fontSize: '22px',
    fontWeight: 500,
    letterSpacing: '-0.01em',
    lineHeight: 1.1,
    color: 'var(--ink)',
    margin: 0,
  },
  subtitle: {
    fontFamily: 'var(--font-ui)',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    color: 'var(--ink-3)',
    marginTop: '4px',
  },
}

export default function Masthead() {
  return (
    <div style={S.wrapper} className="masthead">
      <div style={S.inner}>
        <div style={S.rule} aria-hidden="true" />
        <h1 style={S.title}>Atlas Electoral Mundial</h1>
        <p style={S.subtitle}>Líderes, partidos y elecciones del mundo · actualizado en vivo</p>
      </div>
    </div>
  )
}
