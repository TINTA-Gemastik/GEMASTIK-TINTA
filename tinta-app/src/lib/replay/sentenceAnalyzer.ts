import type { TintaEvent } from '@/types'

type ReplayEvent = Pick<
  TintaEvent,
  'event_type' | 'timestamp' | 'cursor_position' | 'doc_length_before' | 'doc_length_after' | 'payload'
>

export interface SentenceAnalysis {
  sentence:          string
  startIndex:        number
  endIndex:          number
  firstTypedAt:      number
  lastModifiedAt:    number
  revisionCount:     number
  totalCharsModified: number
  aiLikelihood?:     number
}

// Split text into sentences on ". ", "? ", "! ", and ".\n" boundaries.
// Returns [{text, start, end}] with inclusive [start, end] character indices.
function splitIntoSentences(text: string): Array<{ text: string; start: number; end: number }> {
  const results: Array<{ text: string; start: number; end: number }> = []
  // Split on sentence-ending punctuation followed by space or newline
  const regex = /[.?!](?:\s|$)/g
  let lastEnd = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const end = match.index + match[0].length
    const sentence = text.slice(lastEnd, end).trim()
    if (sentence.length > 0) {
      results.push({
        text:  sentence,
        start: lastEnd,
        end:   end - 1,
      })
    }
    lastEnd = end
  }

  // Trailing text without terminator
  if (lastEnd < text.length) {
    const sentence = text.slice(lastEnd).trim()
    if (sentence.length > 0) {
      results.push({
        text:  sentence,
        start: lastEnd,
        end:   text.length - 1,
      })
    }
  }

  return results
}

export function analyzeSentences(
  events:    ReplayEvent[],
  finalText: string
): SentenceAnalysis[] {
  const segments = splitIntoSentences(finalText)
  if (segments.length === 0 || events.length === 0) return []

  // Compute a rough running cursor window for each event
  // We only look at events whose cursor_position falls within each sentence's range
  const relevantEvents = events.filter(
    e => ['keystroke', 'paste', 'delete', 'undo', 'redo'].includes(e.event_type)
  )

  return segments.map(seg => {
    const sentenceEvents = relevantEvents.filter(e => {
      const pos = e.cursor_position ?? 0
      return pos >= seg.start && pos <= seg.end + 1
    })

    if (sentenceEvents.length === 0) {
      return {
        sentence:          seg.text,
        startIndex:        seg.start,
        endIndex:          seg.end,
        firstTypedAt:      events[0]?.timestamp ?? 0,
        lastModifiedAt:    events[0]?.timestamp ?? 0,
        revisionCount:     0,
        totalCharsModified: 0,
      }
    }

    const timestamps      = sentenceEvents.map(e => e.timestamp)
    const firstTypedAt    = Math.min(...timestamps)
    const lastModifiedAt  = Math.max(...timestamps)

    // Count revisions: distinct delete/undo events touching this sentence
    const revisionEvents = sentenceEvents.filter(
      e => e.event_type === 'delete' || e.event_type === 'undo'
    )
    const revisionCount = revisionEvents.length

    // Total chars modified: sum of chars added and removed
    let totalCharsModified = 0
    for (const e of sentenceEvents) {
      const p = (e.payload ?? {}) as Record<string, unknown>
      if (e.event_type === 'keystroke') totalCharsModified += 1
      else if (e.event_type === 'paste') totalCharsModified += (p.pasted_char_count as number | undefined) ?? 0
      else if (e.event_type === 'delete') totalCharsModified += (p.deleted_char_count as number | undefined) ?? 0
    }

    return {
      sentence:          seg.text,
      startIndex:        seg.start,
      endIndex:          seg.end,
      firstTypedAt,
      lastModifiedAt,
      revisionCount,
      totalCharsModified,
    }
  })
}
