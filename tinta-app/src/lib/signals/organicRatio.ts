import type { TintaEvent } from '@/types'

/**
 * Organic Writing Ratio — chars typed via keyboard / final document length.
 * Higher = more organically written. Returns a 0–1 float (capped at 1.0).
 */
export function computeOrganicRatio(events: TintaEvent[]): number {
  let charsKeystroke = 0
  let finalDocLength = 0

  for (const ev of events) {
    if (ev.event_type === 'keystroke') {
      const p = ev.payload as { is_delete_key?: boolean } | null
      if (!p?.is_delete_key) charsKeystroke += 1
    }
    if (ev.doc_length_after !== null && ev.doc_length_after !== undefined) {
      finalDocLength = ev.doc_length_after
    }
  }

  if (finalDocLength === 0) return 1.0
  return Math.min(1, charsKeystroke / finalDocLength)
}
