import type { Session } from '@/types'

function toDateKey(isoString: string): string {
  return isoString.slice(0, 10) // 'YYYY-MM-DD'
}

/**
 * Session Distribution — rewards writing spread across multiple days.
 * 1 session = 0.1, 2 = 0.4, 3+ sessions across 2+ days = 0.7,
 * 4+ sessions across 3+ days = 1.0. Returns a 0–1 float.
 */
export function computeSessionDistribution(sessions: Session[]): number {
  const n = sessions.length
  if (n === 0) return 0
  if (n === 1) return 0.1

  const distinctDays = new Set(sessions.map(s => toDateKey(s.started_at))).size

  if (n >= 4 && distinctDays >= 3) return 1.0
  if (n >= 3 && distinctDays >= 2) return 0.7
  if (n >= 2)                       return 0.4
  return 0.1
}
