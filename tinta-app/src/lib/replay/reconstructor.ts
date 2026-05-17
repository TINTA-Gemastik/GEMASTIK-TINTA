import type { TintaEvent, Session } from '@/types'

// ─── Shared event shape (accepts both TintaEvent and TintaEventInsert) ────────

type ReplayEvent = Pick<
  TintaEvent,
  'event_type' | 'timestamp' | 'session_id' | 'cursor_position' | 'doc_length_before' | 'doc_length_after' | 'payload'
>

// ─── TimelinePoint ────────────────────────────────────────────────────────────

export interface TimelinePoint {
  timestamp:    number
  docLength:    number
  eventType:    string
  sessionId:    string
  sessionIndex: number       // 1-based
  isPaste:      boolean
  pasteType:    string | null
  isAnomaly:    boolean
}

// ─── reconstructAtTimestamp ───────────────────────────────────────────────────

export function reconstructAtTimestamp(
  events:          ReplayEvent[],
  targetTimestamp: number
): string {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
  let doc = ''

  for (const e of sorted) {
    if (e.timestamp > targetTimestamp) break
    const p = (e.payload ?? {}) as Record<string, unknown>
    const pos = e.cursor_position ?? doc.length

    switch (e.event_type) {
      case 'keystroke': {
        const key           = p.key as string | undefined
        const isDeleteKey   = p.is_delete_key as boolean | undefined
        if (!key || isDeleteKey) break
        // Only insert printable characters
        if (key === 'Enter') {
          doc = doc.slice(0, pos) + '\n' + doc.slice(pos)
        } else if (key.length === 1) {
          doc = doc.slice(0, pos) + key + doc.slice(pos)
        }
        break
      }
      case 'paste': {
        const text = (p.pasted_text as string | undefined) ?? ''
        doc = doc.slice(0, pos) + text + doc.slice(pos)
        break
      }
      case 'delete': {
        const count = (p.deleted_char_count as number | undefined) ?? 0
        if (count > 0) {
          const start = Math.max(0, pos - count)
          doc = doc.slice(0, start) + doc.slice(pos)
        }
        break
      }
      case 'undo': {
        // Approximate: trim/pad to doc_length_before
        const targetLen = e.doc_length_before ?? doc.length
        if (targetLen < doc.length) {
          doc = doc.slice(0, targetLen)
        }
        break
      }
    }
  }

  return doc
}

// ─── buildDocumentTimeline ────────────────────────────────────────────────────

export function buildDocumentTimeline(
  events:   ReplayEvent[],
  sessions: Session[]
): TimelinePoint[] {
  if (events.length === 0) return []

  // Build session index map: session_id → 1-based index (sorted by started_at)
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  )
  const sessionIndexMap = new Map<string, number>()
  sortedSessions.forEach((s, i) => sessionIndexMap.set(s.id, i + 1))

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const points: TimelinePoint[] = []

  for (const e of sorted) {
    // Only include events that change document length
    const docLen = e.doc_length_after ?? e.doc_length_before ?? 0
    const p      = (e.payload ?? {}) as Record<string, unknown>
    const isPaste = e.event_type === 'paste'

    points.push({
      timestamp:    e.timestamp,
      docLength:    docLen,
      eventType:    e.event_type,
      sessionId:    e.session_id,
      sessionIndex: sessionIndexMap.get(e.session_id) ?? 1,
      isPaste,
      pasteType:    isPaste ? ((p.declared_type as string | null) ?? null) : null,
      isAnomaly:    false,
    })
  }

  return points
}

// ─── getReplayDurationMs ──────────────────────────────────────────────────────

export function getReplayDurationMs(events: ReplayEvent[]): number {
  if (events.length < 2) return 0
  const timestamps = events.map(e => e.timestamp)
  return Math.max(...timestamps) - Math.min(...timestamps)
}
