import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip,
  LabelList, ResponsiveContainer,
} from 'recharts'
import type { ElectionParty, ElectionTypeToShow } from '../types/atlas'
import { OTROS_COLOR } from '../hooks/useWikidataElection'

// ── Types ─────────────────────────────────────────────────────────────────────

type Metric = 'pct' | 'seats' | 'votes'

interface ChartEntry {
  name: string
  value: number
  colorHex: string
  votes: number | null
  pct: number | null
  seats: number | null
  candidate: string | null
}

// ── Metric determination (exported for CountryPanel's null-check) ─────────────

export function getPrimaryMetric(parties: ElectionParty[]): Metric | null {
  const n = parties.length
  if (!n) return null
  const pctN   = parties.filter(p => p.pct   !== null).length
  const seatN  = parties.filter(p => p.seats !== null).length
  const votesN = parties.filter(p => p.votes !== null).length
  if (pctN   / n >= 0.8) return 'pct'
  if (seatN  / n >= 0.8) return 'seats'
  if (votesN / n >= 0.8) return 'votes'
  return null
}

// ── Luminance ─────────────────────────────────────────────────────────────────

function getLuminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length !== 6) return 1
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

// ── Number formatting ─────────────────────────────────────────────────────────

function fmtPct(n: number): string {
  const s = n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${s} %`
}

function fmtVotes(n: number): string {
  return n.toLocaleString('es-ES')
}

function formatLabel(value: number, metric: Metric): string {
  if (metric === 'pct')   return fmtPct(value)
  if (metric === 'seats') return String(value)
  return fmtVotes(value)
}

function unitLabel(metric: Metric): string {
  if (metric === 'pct')   return '%'
  if (metric === 'seats') return 'esc.'
  return 'votos'
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ── Custom Y-axis tick ────────────────────────────────────────────────────────

function YAxisTick(props: {
  x: number; y: number
  payload: { value: string }
  entries: ChartEntry[]
  isPresidential: boolean
}) {
  const { x, y, payload, entries, isPresidential } = props
  const entry = entries.find(e => e.name === payload.value)
  const showCandidate = isPresidential && !!entry?.candidate

  if (showCandidate) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={-4} textAnchor="end" fill="var(--ink-2)"
          fontSize={13} fontFamily="var(--font-ui)">
          {trunc(entry!.candidate!, 20)}
        </text>
        <text x={0} y={11} textAnchor="end" fill="var(--ink-3)"
          fontSize={11} fontFamily="var(--font-ui)">
          {trunc(payload.value, 22)}
        </text>
      </g>
    )
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={4} textAnchor="end" fill="var(--ink-2)"
        fontSize={11} fontFamily="var(--font-ui)">
        {trunc(payload.value, 17)}
      </text>
    </g>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, isPresidential }: {
  active?: boolean
  payload?: Array<{ payload: ChartEntry }>
  isPresidential?: boolean
}) {
  if (!active || !payload?.length) return null
  const e = payload[0].payload
  const parts: string[] = []
  if (e.votes !== null) parts.push(`${fmtVotes(e.votes)} votos`)
  if (e.pct   !== null) parts.push(fmtPct(e.pct))
  if (e.seats !== null) parts.push(`${e.seats} escaños`)

  // Presidential: "Candidate · Party" in title (existing behaviour for Brazil, France…)
  // Legislative/general: party name as title; leader shown as a subtle third line
  const title = (isPresidential && e.candidate) ? `${e.candidate} · ${e.name}` : e.name

  return (
    <div style={{
      background: 'var(--ink)',
      padding: '3px 8px',
      fontFamily: 'var(--font-ui)',
      fontSize: 10.5,
      maxWidth: 220,
      lineHeight: 1.6,
    }}>
      <strong style={{ color: '#FBF8F1', display: 'block' }}>{title}</strong>
      <span style={{ color: '#FBF8F1', opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
        {parts.join(' · ')}
      </span>
      {!isPresidential && e.candidate && (
        <span style={{ color: '#FBF8F1', opacity: 0.55, display: 'block', fontSize: 10 }}>
          {e.candidate}
        </span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  parties: ElectionParty[]
  electionType: ElectionTypeToShow
  turnout?: number | null
  wikipediaUrl?: string | null
}

export default function ElectionChart({ parties: inputParties, electionType, turnout, wikipediaUrl }: Props) {
  const metric = getPrimaryMetric(inputParties)
  if (!metric) return null

  const isPresidential = electionType === 'presidential'

  const getValue = (p: ElectionParty): number => {
    if (metric === 'pct')   return p.pct   ?? 0
    if (metric === 'seats') return p.seats ?? 0
    return p.votes ?? 0
  }

  const sorted = [...inputParties].sort((a, b) => getValue(b) - getValue(a))

  const top  = sorted.slice(0, 8)
  const rest = sorted.slice(8)

  const chartData: ChartEntry[] = top.map(p => ({
    name:      p.name,
    value:     getValue(p),
    colorHex:  p.colorHex ?? OTROS_COLOR,
    votes:     p.votes,
    pct:       p.pct,
    seats:     p.seats,
    candidate: p.candidate ?? null,
  }))

  if (rest.length > 0) {
    const otrosValue = rest.reduce((s, p) => s + getValue(p), 0)
    const otrosRounded = metric === 'pct'
      ? Math.round(otrosValue * 100) / 100
      : Math.round(otrosValue)
    chartData.push({
      name:      'Otros',
      value:     otrosRounded,
      colorHex:  OTROS_COLOR,
      votes:     metric === 'votes' ? Math.round(otrosValue) : null,
      pct:       metric === 'pct'   ? otrosRounded           : null,
      seats:     metric === 'seats' ? Math.round(otrosValue) : null,
      candidate: null,
    })
  }

  const barHeight   = isPresidential ? 20 : 18
  const barGap      = isPresidential ? 12 : 10
  const yAxisWidth  = isPresidential ? 130 : 100
  const chartHeight = chartData.length * (barHeight + barGap) + 16

  const renderTick = (props: { x: number; y: number; payload: { value: string } }) => (
    <YAxisTick {...props} entries={chartData} isPresidential={isPresidential} />
  )

  // ── Custom label: inside dark bars, outside light bars ───────────────────────
  const renderLabel = (props: {
    x?: number; y?: number; width?: number; height?: number
    value?: number; index?: number
  }) => {
    const { x = 0, y = 0, width = 0, height = 0, value, index } = props
    if (value === undefined || index === undefined) return <g />
    const entry = chartData[index]
    if (!entry) return <g />

    const text = formatLabel(value, metric)
    const lum = getLuminance(entry.colorHex)
    const inside = lum <= 0.6 && width > 40

    const cx = inside ? x + width - 8 : x + width + 4
    const textAnchor = inside ? 'end' : 'start'
    const fill = inside ? '#FBF8F1' : 'var(--ink)'
    const cy = y + height / 2 + 1

    return (
      <text
        x={cx}
        y={cy}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        fill={fill}
        fontSize={11}
        fontFamily="var(--font-ui)"
        fontVariant="tabular-nums"
        className="bar-label"
      >
        {text}
      </text>
    )
  }

  const S = {
    footer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginTop: '6px',
      fontFamily: 'var(--font-ui)',
      fontSize: '11px',
      color: 'var(--mute)',
    },
    link: {
      color: 'var(--mute)',
      textDecoration: 'underline',
    },
  }

  return (
    <div style={{ width: '100%' }} aria-label={`Gráfico de resultados electorales — ${unitLabel(metric)}`}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 52, bottom: 4, left: 0 }}
          barSize={barHeight}
          barCategoryGap={barGap}
        >
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            axisLine={false}
            tickLine={false}
            tick={renderTick}
            interval={0}
          />
          <Tooltip
            content={<CustomTooltip isPresidential={isPresidential} />}
            cursor={{ fill: 'rgba(26,26,26,0.04)' }}
          />
          <Bar
            dataKey="value"
            isAnimationActive={true}
            animationBegin={0}
            animationDuration={700}
            animationEasing="ease-out"
            background={{ fill: 'var(--paper-2)' }}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.colorHex} />
            ))}
            <LabelList dataKey="value" content={renderLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {(turnout != null || wikipediaUrl) && (
        <div style={S.footer}>
          {turnout != null ? (
            <span>
              Participación ·{' '}
              {turnout.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
            </span>
          ) : (
            <span />
          )}
          {wikipediaUrl && (
            <a href={wikipediaUrl} target="_blank" rel="noopener noreferrer" style={S.link}>
              Wikipedia →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
