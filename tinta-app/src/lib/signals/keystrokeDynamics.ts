// Inter-Keystroke Interval (IKI) analysis for typing rhythm anomaly detection.

export interface IKIWindow {
  startIndex:     number
  endIndex:       number
  mean:           number   // average IKI in ms
  stddev:         number   // standard deviation
  cv:             number   // coefficient of variation (stddev/mean) — lower = more uniform
  keystrokeCount: number
  flagged:        boolean  // true if CV < 0.35 (suspiciously robotic)
}

export interface KeystrokeDynamicsResult {
  overallMean:       number
  overallStddev:     number
  overallCV:         number
  windows:           IKIWindow[]
  roboticWindowCount:number
  totalWindows:      number
  roboticRatio:      number   // roboticWindowCount / totalWindows
  ikiBurstPattern:   boolean  // true if pattern matches read-then-type
  burstPatternCount: number   // how many read-then-type bursts detected
  score:             number   // 0–1, higher = more human-like
}

// ─── Main analysis function ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function analyzeKeystrokeDynamics(events: any[]): KeystrokeDynamicsResult {
  const EMPTY: KeystrokeDynamicsResult = {
    overallMean: 0, overallStddev: 0, overallCV: 0,
    windows: [], roboticWindowCount: 0, totalWindows: 0,
    roboticRatio: 0, ikiBurstPattern: false, burstPatternCount: 0,
    score: 1.0,
  }

  // Filter productive keystrokes (not delete key, not paste)
  const keystrokes = events
    .filter(e => e.event_type === 'keystroke' && !e.payload?.is_delete_key)
    .sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp)

  if (keystrokes.length < 20) return EMPTY

  // ── Inter-keystroke intervals ─────────────────────────────────────────────
  const ikis: number[] = []
  for (let i = 1; i < keystrokes.length; i++) {
    const interval = keystrokes[i].timestamp - keystrokes[i - 1].timestamp
    if (interval < 30_000) ikis.push(interval) // ignore pauses > 30s
  }

  if (ikis.length === 0) return EMPTY

  // ── Overall statistics ────────────────────────────────────────────────────
  const mean       = ikis.reduce((a, b) => a + b, 0) / ikis.length
  const variance   = ikis.reduce((a, b) => a + (b - mean) ** 2, 0) / ikis.length
  const stddev     = Math.sqrt(variance)
  const overallCV  = mean > 0 ? stddev / mean : 0

  // ── Sliding-window analysis (size: 50, step: 25) ─────────────────────────
  const WINDOW_SIZE = 50
  const STEP        = 25
  const windows: IKIWindow[] = []

  for (let i = 0; i + WINDOW_SIZE <= ikis.length; i += STEP) {
    const slice  = ikis.slice(i, i + WINDOW_SIZE)
    const wMean  = slice.reduce((a, b) => a + b, 0) / slice.length
    const wVar   = slice.reduce((a, b) => a + (b - wMean) ** 2, 0) / slice.length
    const wStddev = Math.sqrt(wVar)
    const wCV    = wMean > 0 ? wStddev / wMean : 0

    windows.push({
      startIndex:     i,
      endIndex:       i + WINDOW_SIZE,
      mean:           wMean,
      stddev:         wStddev,
      cv:             wCV,
      keystrokeCount: WINDOW_SIZE,
      flagged:        wCV < 0.35 && wMean < 300,  // suspiciously robotic
    })
  }

  const roboticWindowCount = windows.filter(w => w.flagged).length

  // ── Read-then-type burst detection ────────────────────────────────────────
  const windowEvents = events
    .filter(e => e.event_type === 'keystroke' || e.event_type === 'window_hidden')
    .sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp)

  let burstPatternCount = 0

  for (let i = 0; i < windowEvents.length - 1; i++) {
    const ev = windowEvents[i]
    if (ev.event_type !== 'window_hidden') continue

    const hiddenDuration = ev.payload?.duration_before_return_ms || 0
    // Tab was away 15 s – 5 min (consistent with reading AI output)
    if (hiddenDuration < 15_000 || hiddenDuration > 300_000) continue

    // Collect up to 50 keystrokes following this event
    const burstKS = windowEvents
      .slice(i + 1)
      .filter((e: { event_type: string }) => e.event_type === 'keystroke')
      .slice(0, 50)

    if (burstKS.length < 30) continue

    const burstDuration =
      burstKS[burstKS.length - 1].timestamp - burstKS[0].timestamp

    const burstIKIs: number[] = []
    for (let j = 1; j < burstKS.length; j++) {
      burstIKIs.push(burstKS[j].timestamp - burstKS[j - 1].timestamp)
    }

    const bMean = burstIKIs.reduce((a, b) => a + b, 0) / burstIKIs.length
    const bVar  = burstIKIs.reduce((a, b) => a + (b - bMean) ** 2, 0) / burstIKIs.length
    const bCV   = bMean > 0 ? Math.sqrt(bVar) / bMean : 0

    // Fast uniform typing right after tab switch = suspicious
    if (burstDuration < 45_000 && bCV < 0.4) burstPatternCount++
  }

  // ── Score (0–1, higher = more human) ──────────────────────────────────────
  const roboticPenalty = (roboticWindowCount / Math.max(windows.length, 1)) * 0.6
  const burstPenalty   = Math.min(burstPatternCount * 0.15, 0.4)
  const score          = Math.max(0, 1 - roboticPenalty - burstPenalty)

  return {
    overallMean:       mean,
    overallStddev:     stddev,
    overallCV,
    windows,
    roboticWindowCount,
    totalWindows:      windows.length,
    roboticRatio:      roboticWindowCount / Math.max(windows.length, 1),
    ikiBurstPattern:   burstPatternCount > 0,
    burstPatternCount,
    score,
  }
}

// ─── Display helper ───────────────────────────────────────────────────────────

export function formatDynamicsScore(result: KeystrokeDynamicsResult): {
  label:  string
  color:  string
  detail: string
} {
  if (result.totalWindows === 0) {
    return { label: 'Insufficient data', color: '#B9B6AD', detail: 'Need more typing to analyze' }
  }
  if (result.score >= 0.8) {
    return {
      label:  'Natural',
      color:  '#16a34a',
      detail: `Typing rhythm is organic (CV: ${result.overallCV.toFixed(2)})`,
    }
  }
  if (result.score >= 0.6) {
    return { label: 'Mostly natural', color: '#2D4E71', detail: 'Minor uniformity detected' }
  }
  if (result.score >= 0.4) {
    return {
      label:  'Somewhat uniform',
      color:  '#f59e0b',
      detail: `${result.roboticWindowCount} uniform windows detected`,
    }
  }
  return {
    label:  'Highly uniform',
    color:  '#ef4444',
    detail: `${result.roboticWindowCount}/${result.totalWindows} windows flagged${
      result.burstPatternCount > 0 ? `, ${result.burstPatternCount} read-type bursts` : ''
    }`,
  }
}
