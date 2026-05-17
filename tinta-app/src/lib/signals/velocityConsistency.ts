import type { TintaEvent } from '@/types'

const WINDOW_MS = 30_000 // 30-second rolling windows

/**
 * Writing Velocity Consistency — measures how uniform typing speed is across the session.
 * Computes chars-per-minute in 30-second windows, then coefficient of variation (stddev/mean).
 * Low CV = consistent = higher score. Returns a 0–1 float.
 */
export function computeVelocityConsistency(events: TintaEvent[]): number {
  // Collect productive keystroke and paste events with timestamps
  const typed = events.filter(
    ev =>
      (ev.event_type === 'keystroke' &&
        !(ev.payload as { is_delete_key?: boolean } | null)?.is_delete_key) ||
      ev.event_type === 'paste'
  )

  if (typed.length < 10) return 0.8 // too few events to judge; give benefit of the doubt

  const timestamps = typed.map(ev => ev.timestamp).sort((a, b) => a - b)
  const firstTs    = timestamps[0]
  const lastTs     = timestamps[timestamps.length - 1]
  const totalMs    = lastTs - firstTs
  if (totalMs < WINDOW_MS * 2) return 0.8 // session too short to have multiple windows

  // Build 30-second bucket counts
  const numWindows = Math.floor(totalMs / WINDOW_MS)
  const buckets    = new Array<number>(numWindows).fill(0)

  for (const ev of typed) {
    const idx = Math.min(
      Math.floor((ev.timestamp - firstTs) / WINDOW_MS),
      numWindows - 1
    )
    // For paste, add pasted_char_count worth of "chars"
    if (ev.event_type === 'paste') {
      const p = ev.payload as { pasted_char_count?: number } | null
      buckets[idx] += p?.pasted_char_count ?? 1
    } else {
      buckets[idx] += 1
    }
  }

  // Convert to chars-per-minute
  const cpms = buckets.map(count => (count / WINDOW_MS) * 60_000)

  const mean   = cpms.reduce((a, b) => a + b, 0) / cpms.length
  if (mean === 0) return 0.5

  const variance = cpms.reduce((acc, v) => acc + (v - mean) ** 2, 0) / cpms.length
  const stddev   = Math.sqrt(variance)
  const cv       = stddev / mean

  // Map CV to score
  if (cv < 0.5) return 1.0
  if (cv <= 1.0) return 1.0 - ((cv - 0.5) / 0.5) * 0.5  // 1.0 → 0.5
  if (cv <= 2.0) return 0.5 - ((cv - 1.0) / 1.0) * 0.4  // 0.5 → 0.1
  return 0.1
}
