import type { TintaEvent, Session, PasteEvent, AnomalySeverity } from '@/types'
import { computeRevisionDepth } from './revisionDepth'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnomalyFlagResult {
  flag_type:        string
  flag_description: string
  severity:         AnomalySeverity
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RETURN_WINDOW_MS = 10_000
const BURST_THRESHOLD  = 50

function countCorrelatedTabSwitches(events: TintaEvent[]): number {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
  let count = 0

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].event_type !== 'window_visible') continue
    const returnTs = sorted[i].timestamp
    let burst = 0

    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].timestamp > returnTs + RETURN_WINDOW_MS) break
      const ev = sorted[j]
      if (ev.event_type === 'keystroke') {
        const p = ev.payload as { is_delete_key?: boolean } | null
        if (!p?.is_delete_key) burst++
      } else if (ev.event_type === 'paste') {
        const p = ev.payload as { pasted_char_count?: number } | null
        burst += p?.pasted_char_count ?? 0
      }
    }
    if (burst >= BURST_THRESHOLD) count++
  }

  return count
}

// Compute inter-keystroke intervals for consecutive keystrokes
function getIKIs(events: TintaEvent[]): number[] {
  const keystrokes = events
    .filter(ev => ev.event_type === 'keystroke')
    .sort((a, b) => a.timestamp - b.timestamp)

  const ikis: number[] = []
  for (let i = 1; i < keystrokes.length; i++) {
    const gap = keystrokes[i].timestamp - keystrokes[i - 1].timestamp
    if (gap < 5_000) ikis.push(gap) // ignore gaps > 5s (pauses between bursts)
  }
  return ikis
}

function stddev(values: number[]): number {
  if (values.length < 2) return Infinity
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// ─── Anomaly Detection ────────────────────────────────────────────────────────

export function detectAnomalies(
  events:      TintaEvent[],
  sessions:    Session[],
  pasteEvents: PasteEvent[],
  currentLES?: number,
  previousLES?: number
): AnomalyFlagResult[] {
  const flags: AnomalyFlagResult[] = []

  // ── Signal A: Correlated tab-switch pattern ─────────────────────────────────
  const correlatedSwitches = countCorrelatedTabSwitches(events)
  if (correlatedSwitches >= 3) {
    flags.push({
      flag_type:        'correlated_tab_switch',
      flag_description: `Pola baca-ketik berulang terdeteksi (${correlatedSwitches} kali dalam sesi ini)`,
      severity:         'medium',
    })
  }

  // ── Signal B: IKI uniformity ────────────────────────────────────────────────
  // Only run if there's a previous LES baseline (≥ 2 prior tasks)
  if (previousLES !== undefined) {
    const ikis = getIKIs(events)
    if (ikis.length >= 100) {
      // Check each 100-keystroke window
      for (let i = 0; i + 100 <= ikis.length; i += 50) {
        const window = ikis.slice(i, i + 100)
        if (stddev(window) < 50) {
          flags.push({
            flag_type:        'iki_uniformity',
            flag_description: 'IKI terlalu merata — pola mengetik tidak seperti biasanya',
            severity:         'medium',
          })
          break // flag once per submission
        }
      }
    }
  }

  // ── Signal C: Session duration vs output ratio ──────────────────────────────
  for (const session of sessions) {
    const activeMinutes = session.duration_active_ms / 60_000
    if (session.net_chars_added >= 2000 && activeMinutes <= 10) {
      flags.push({
        flag_type:        'velocity_output_ratio',
        flag_description: `Durasi sesi terlalu singkat untuk jumlah output (${session.net_chars_added} karakter dalam ${Math.round(activeMinutes)} menit)`,
        severity:         'high',
      })
    }
  }

  // ── Signal D: Zero revision ─────────────────────────────────────────────────
  const finalDocLength = sessions.length > 0
    ? Math.max(...sessions.map(s => s.final_doc_length))
    : 0

  if (finalDocLength >= 500) {
    const revDepth = computeRevisionDepth(events)
    if (revDepth < 0.03) {
      flags.push({
        flag_type:        'zero_revision',
        flag_description: 'Revisi sangat minim untuk panjang dokumen ini',
        severity:         'high',
      })
    }
  }

  // ── Signal E: Historical LES drop ──────────────────────────────────────────
  if (previousLES !== undefined && currentLES !== undefined && currentLES < previousLES - 25) {
    flags.push({
      flag_type:        'les_drop',
      flag_description: `Score jauh di bawah historis (avg ${Math.round(previousLES)})`,
      severity:         'medium',
    })
  }

  return flags
}
