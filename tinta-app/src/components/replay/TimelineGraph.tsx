'use client'

import {
  ComposedChart, Line, Scatter, XAxis, YAxis,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { TimelinePoint } from '@/lib/replay/reconstructor'
import type { PasteEvent, AnomalyFlag, Session } from '@/types'

// ─── Session color palette ────────────────────────────────────────────────────

const SESSION_COLORS = ['#2D4E71', '#4a7fa5', '#AABED6', '#1e3a56', '#7aafd4']

// ─── Paste dot color ─────────────────────────────────────────────────────────

function pasteColor(declared: string | null, aiLikelihood: number | null): string {
  if (!declared || declared === '') {
    if ((aiLikelihood ?? 0) > 0.6) return '#ef4444'  // red — undeclared + high AI
    return '#f59e0b'                                   // amber — undeclared
  }
  if (declared === 'citation') return '#16a34a'        // green — declared citation
  return '#2D4E71'                                     // blue — own text / notes
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TimelineGraphProps {
  timeline:         TimelinePoint[]
  pasteEvents:      PasteEvent[]
  sessions:         Session[]
  anomalyFlags?:    AnomalyFlag[]
  currentTimestamp: number
  onSeek:           (timestamp: number) => void
}

// ─── Data preparation ─────────────────────────────────────────────────────────

function buildChartData(timeline: TimelinePoint[], sessions: Session[]) {
  const sessionCount = Math.max(1, sessions.length)

  // Build one row per timeline point
  return timeline.map(pt => {
    const row: Record<string, number | undefined> & {
      timestamp: number; wordCount: number; sessionIndex: number
    } = {
      timestamp:    pt.timestamp,
      wordCount:    Math.round(pt.docLength / 5.5),
      sessionIndex: pt.sessionIndex,
    }
    // Set s<n> = wordCount for the session this point belongs to, undefined for others
    for (let i = 1; i <= sessionCount; i++) {
      row[`s${i}`] = pt.sessionIndex === i ? Math.round(pt.docLength / 5.5) : undefined
    }
    return row
  })
}

function buildPasteScatterData(
  timeline:    TimelinePoint[],
  pasteEvents: PasteEvent[]
): Array<{ timestamp: number; wordCount: number; color: string; pasteId: string }> {
  // Match timeline paste points to pasteEvents to get declared_type + ai_likelihood
  const pasteMap = new Map(pasteEvents.map(p => [p.timestamp, p]))

  return timeline
    .filter(pt => pt.isPaste)
    .map(pt => {
      const pe  = pasteMap.get(pt.timestamp)
      const col = pasteColor(
        pe?.declared_type ?? pt.pasteType,
        pe?.ai_likelihood ?? null
      )
      return {
        timestamp: pt.timestamp,
        wordCount: Math.round(pt.docLength / 5.5),
        color:     col,
        pasteId:   pe?.id ?? String(pt.timestamp),
      }
    })
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Record<string, unknown> }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as { timestamp: number; wordCount: number; sessionIndex: number }
  const time = new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="bg-white border border-[#B9B6AD]/30 rounded-xl px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-[#111111]">Session {d.sessionIndex}</p>
      <p className="text-[#B9B6AD]">{time} · {d.wordCount} words</p>
    </div>
  )
}

// ─── Custom paste dot shape ───────────────────────────────────────────────────

function PasteDot(props: {
  cx?: number; cy?: number;
  payload?: { color: string }
}) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload) return null
  return (
    <circle
      cx={cx}
      cy={cy - 6}
      r={4}
      fill={payload.color}
      stroke="white"
      strokeWidth={1.5}
    />
  )
}

// ─── TimelineGraph component ──────────────────────────────────────────────────

export function TimelineGraph({
  timeline,
  pasteEvents,
  sessions,
  anomalyFlags,
  currentTimestamp,
  onSeek,
}: TimelineGraphProps) {
  const sessionCount = Math.max(1, sessions.length)
  const chartData    = buildChartData(timeline, sessions)
  const pasteData    = buildPasteScatterData(timeline, pasteEvents)

  // Anomaly timestamps for red triangle markers
  const anomalyTimestamps = (anomalyFlags ?? []).map(f => new Date(f.created_at).getTime())

  // X domain
  const timestamps  = timeline.map(p => p.timestamp)
  const xMin        = timestamps.length ? Math.min(...timestamps) : 0
  const xMax        = timestamps.length ? Math.max(...timestamps) : 1

  const handleClick = (data: unknown) => {
    const d = data as { activePayload?: Array<{ payload: { timestamp: number } }> }
    if (d?.activePayload?.[0]?.payload?.timestamp) {
      onSeek(d.activePayload[0].payload.timestamp)
    }
  }

  const formatXTick = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="w-full bg-white border-t border-[#B9B6AD]/20" style={{ height: 100 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
          onClick={handleClick}
          style={{ cursor: 'crosshair' }}
        >
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={[xMin, xMax]}
            tickFormatter={formatXTick}
            tick={{ fontSize: 9, fill: '#B9B6AD' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            scale="linear"
          />
          <YAxis
            label={{ value: 'Words', angle: -90, position: 'insideLeft', fontSize: 9, fill: '#B9B6AD', dx: 12 }}
            tick={{ fontSize: 9, fill: '#B9B6AD' }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* One line per session, different colors, gaps between sessions */}
          {Array.from({ length: sessionCount }, (_, i) => (
            <Line
              key={`s${i + 1}`}
              dataKey={`s${i + 1}`}
              stroke={SESSION_COLORS[i % SESSION_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}

          {/* Paste event dots */}
          <Scatter
            data={pasteData}
            dataKey="wordCount"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            shape={PasteDot as any}
            isAnimationActive={false}
          />

          {/* Current playback position */}
          {currentTimestamp > 0 && (
            <ReferenceLine
              x={currentTimestamp}
              stroke="#2D4E71"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* Anomaly markers */}
          {anomalyTimestamps.map(ts => (
            <ReferenceLine
              key={ts}
              x={ts}
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
