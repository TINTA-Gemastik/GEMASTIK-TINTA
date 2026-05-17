import type { TintaEvent } from '@/types'

const RETURN_WINDOW_MS = 10_000 // 10 seconds after window_visible
const BURST_THRESHOLD  = 50     // chars typed in that window = burst

/**
 * Tab Switch Score — penalises the correlated read-copy-type pattern:
 * window_hidden → window_visible → keystroke burst ≥ 50 chars within 10 seconds.
 * Returns a 0–1 float (1.0 = no correlated switches).
 */
export function computeTabSwitchScore(events: TintaEvent[]): number {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)

  let correlatedCount = 0

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]
    if (ev.event_type !== 'window_visible') continue

    const returnTs = ev.timestamp

    // Count chars typed within 10 seconds of returning
    let burstChars = 0
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j]
      if (next.timestamp > returnTs + RETURN_WINDOW_MS) break
      if (next.event_type === 'keystroke') {
        const p = next.payload as { is_delete_key?: boolean } | null
        if (!p?.is_delete_key) burstChars += 1
      } else if (next.event_type === 'paste') {
        const p = next.payload as { pasted_char_count?: number } | null
        burstChars += p?.pasted_char_count ?? 0
      }
    }

    if (burstChars >= BURST_THRESHOLD) correlatedCount++
  }

  if (correlatedCount === 0)    return 1.0
  if (correlatedCount <= 2)     return 0.7
  if (correlatedCount <= 4)     return 0.4
  return 0.1
}
