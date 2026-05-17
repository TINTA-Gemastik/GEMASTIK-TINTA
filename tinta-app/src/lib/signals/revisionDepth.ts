import type { TintaEvent } from '@/types'

/**
 * Revision Depth — chars_deleted / chars_ever_produced (keystrokes + paste chars).
 * 0% = suspicious (nothing ever deleted). 15–40% is healthy.
 * Returns a 0–1 float.
 */
export function computeRevisionDepth(events: TintaEvent[]): number {
  let charsDeleted  = 0
  let charsProduced = 0

  for (const ev of events) {
    if (ev.event_type === 'delete') {
      const p = ev.payload as { deleted_char_count?: number } | null
      charsDeleted += p?.deleted_char_count ?? 1
    } else if (ev.event_type === 'keystroke') {
      const p = ev.payload as { is_delete_key?: boolean } | null
      if (!p?.is_delete_key) charsProduced += 1
    } else if (ev.event_type === 'paste') {
      const p = ev.payload as { pasted_char_count?: number } | null
      charsProduced += p?.pasted_char_count ?? 0
    }
  }

  if (charsProduced === 0) return 0
  return Math.min(1, charsDeleted / charsProduced)
}
