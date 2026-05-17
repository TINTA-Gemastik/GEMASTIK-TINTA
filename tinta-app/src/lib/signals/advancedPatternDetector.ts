// Advanced Behavioral Pattern Detection
// Targets: "slow AI copying" — reading AI output and typing it character by character
//
// This is fundamentally different from IKI analysis (which measures keystroke speed).
// These signals work at PARAGRAPH and SENTENCE level patterns.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEvent = any

export interface TextSegment {
  text:            string
  startTime:       number
  endTime:         number
  durationMs:      number
  charCount:       number
  charsPerMinute:  number
  deletionsWithin: number   // chars deleted WITHIN this segment before moving on
  pauseBeforeMs:   number   // idle time before this burst started
  pauseAfterMs:    number   // idle time after this burst ended
}

export interface AdvancedPatternResult {
  // Signal 1: Burst regularity
  burstLengthCV:          number   // CV of burst char counts — low = regular (suspicious)
  burstLengthMean:        number
  burstRegularityScore:   number   // 0–1, higher = more suspicious

  // Signal 2: Within-phrase deletion rate
  withinPhraseDeleteRate:    number   // deletions mid-phrase / total chars — low = copying
  intraSegmentRevisionScore: number   // 0–1, higher = more suspicious

  // Signal 3: Inter-sentence pause variance
  pauseCV:              number   // CV of pauses between bursts — low = regular reading pace
  pauseMean:            number
  pauseRegularityScore: number   // 0–1

  // Signal 4: Forward linearity
  cursorBacktrackRate: number   // how often cursor moves significantly backward
  linearityScore:      number   // 0–1, higher = more suspicious (too linear)

  // Signal 5: Correlated tab-pause-burst triplet
  correlatedTriplets: number   // count of: pause(5-120s) → tab → return → burst(10-80 chars)
  tripletScore:        number  // 0–1

  // Combined
  combinedScore: number
  confidence:    'insufficient' | 'low' | 'medium' | 'high'
  flags:         string[]
}

const BURST_PAUSE_THRESHOLD_MS = 3000  // gap > 3s = new burst (thinking pause)
const MIN_BURST_CHARS          = 8     // ignore very short bursts (single words)

export function extractTextSegments(events: AnyEvent[]): TextSegment[] {
  const typingEvents = events
    .filter(e => e.event_type === 'keystroke' || e.event_type === 'delete')
    .sort((a: AnyEvent, b: AnyEvent) => a.timestamp - b.timestamp)

  if (typingEvents.length < 20) return []

  const segments: TextSegment[] = []
  let currentSegmentStart    = typingEvents[0].timestamp
  let currentSegmentChars    = 0
  let currentSegmentDeletions = 0
  let lastEventTime           = typingEvents[0].timestamp
  let lastSegmentEnd          = typingEvents[0].timestamp

  for (let i = 1; i < typingEvents.length; i++) {
    const event = typingEvents[i]
    const gap   = event.timestamp - lastEventTime

    if (gap > BURST_PAUSE_THRESHOLD_MS) {
      if (currentSegmentChars >= MIN_BURST_CHARS) {
        segments.push({
          text:            '',
          startTime:       currentSegmentStart,
          endTime:         lastEventTime,
          durationMs:      lastEventTime - currentSegmentStart,
          charCount:       currentSegmentChars,
          charsPerMinute:  currentSegmentChars / Math.max((lastEventTime - currentSegmentStart) / 60000, 0.001),
          deletionsWithin: currentSegmentDeletions,
          pauseBeforeMs:   currentSegmentStart - lastSegmentEnd,
          pauseAfterMs:    gap,
        })
        lastSegmentEnd = lastEventTime
      }
      currentSegmentStart     = event.timestamp
      currentSegmentChars     = 0
      currentSegmentDeletions = 0
    }

    if (event.event_type === 'keystroke' && !event.payload?.is_delete_key) {
      currentSegmentChars++
    } else if (event.event_type === 'delete' || event.payload?.is_delete_key) {
      currentSegmentDeletions++
    }

    lastEventTime = event.timestamp
  }

  if (currentSegmentChars >= MIN_BURST_CHARS) {
    segments.push({
      text:            '',
      startTime:       currentSegmentStart,
      endTime:         lastEventTime,
      durationMs:      lastEventTime - currentSegmentStart,
      charCount:       currentSegmentChars,
      charsPerMinute:  currentSegmentChars / Math.max((lastEventTime - currentSegmentStart) / 60000, 0.001),
      deletionsWithin: currentSegmentDeletions,
      pauseBeforeMs:   currentSegmentStart - lastSegmentEnd,
      pauseAfterMs:    0,
    })
  }

  return segments
}

function computeCV(values: number[]): number {
  if (values.length < 3) return 1
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean === 0) return 0
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
  return Math.sqrt(variance) / mean
}

export function analyzeAdvancedPatterns(events: AnyEvent[]): AdvancedPatternResult {
  const insufficient: AdvancedPatternResult = {
    burstLengthCV: 1, burstLengthMean: 0, burstRegularityScore: 0,
    withinPhraseDeleteRate: 0.5, intraSegmentRevisionScore: 0,
    pauseCV: 1, pauseMean: 0, pauseRegularityScore: 0,
    cursorBacktrackRate: 0.5, linearityScore: 0,
    correlatedTriplets: 0, tripletScore: 0,
    combinedScore: 0, confidence: 'insufficient', flags: [],
  }

  const segments = extractTextSegments(events)
  if (segments.length < 4) return insufficient

  const flags: string[] = []

  // ── Signal 1: Burst length regularity ──────────────────────────────────────
  // Human composers have VARIABLE burst lengths. AI copiers have REGULAR bursts
  // (AI sentences tend to be similar length).
  const burstLengths   = segments.map(s => s.charCount)
  const burstLengthCV  = computeCV(burstLengths)
  const burstLengthMean = burstLengths.reduce((a, b) => a + b, 0) / burstLengths.length

  let burstRegularityScore: number
  if      (burstLengthCV < 0.25) burstRegularityScore = 0.90
  else if (burstLengthCV < 0.35) burstRegularityScore = 0.75
  else if (burstLengthCV < 0.50) burstRegularityScore = 0.45
  else if (burstLengthCV < 0.75) burstRegularityScore = 0.20
  else                           burstRegularityScore = 0.05

  if (burstRegularityScore > 0.6) {
    flags.push(`Writing bursts are unusually regular (CV: ${burstLengthCV.toFixed(2)}) — natural writing varies more`)
  }

  // ── Signal 2: Within-phrase deletion rate ───────────────────────────────────
  // Organic writers delete frequently MID-burst. AI copiers rarely delete
  // mid-sentence (they know what they're copying).
  const totalBurstChars      = segments.reduce((s, seg) => s + seg.charCount, 0)
  const totalWithinDeletions = segments.reduce((s, seg) => s + seg.deletionsWithin, 0)
  const withinPhraseDeleteRate = totalBurstChars > 0
    ? totalWithinDeletions / totalBurstChars
    : 0.5

  let intraSegmentRevisionScore: number
  if      (withinPhraseDeleteRate < 0.02) intraSegmentRevisionScore = 0.85
  else if (withinPhraseDeleteRate < 0.05) intraSegmentRevisionScore = 0.65
  else if (withinPhraseDeleteRate < 0.10) intraSegmentRevisionScore = 0.40
  else if (withinPhraseDeleteRate < 0.20) intraSegmentRevisionScore = 0.15
  else                                    intraSegmentRevisionScore = 0.05

  if (intraSegmentRevisionScore > 0.5) {
    flags.push(`Very few mid-phrase corrections (${Math.round(withinPhraseDeleteRate * 100)}%) — organic writing revises more within sentences`)
  }

  // ── Signal 3: Inter-burst pause variance ────────────────────────────────────
  // Natural writers: huge variance in thinking time between bursts.
  // AI copiers: more regular pauses (reading speed is roughly constant).
  const pauses = segments
    .slice(1)
    .map(s => s.pauseBeforeMs)
    .filter(p => p > 500 && p < 120000)

  let pauseCV = 1, pauseMean = 0, pauseRegularityScore = 0
  if (pauses.length >= 3) {
    pauseCV  = computeCV(pauses)
    pauseMean = pauses.reduce((a, b) => a + b, 0) / pauses.length

    if      (pauseCV < 0.3) pauseRegularityScore = 0.80
    else if (pauseCV < 0.5) pauseRegularityScore = 0.55
    else if (pauseCV < 0.8) pauseRegularityScore = 0.25
    else                    pauseRegularityScore = 0.05

    if (pauseRegularityScore > 0.5) {
      flags.push(`Pauses between writing bursts are unusually consistent (CV: ${pauseCV.toFixed(2)}) — may indicate reading at a fixed pace`)
    }
  }

  // ── Signal 4: Cursor linearity ───────────────────────────────────────────────
  // Organic writers jump backward to edit. AI copiers move forward.
  const cursorEvents = events
    .filter((e: AnyEvent) => e.cursor_position !== undefined && e.cursor_position !== null)
    .sort((a: AnyEvent, b: AnyEvent) => a.timestamp - b.timestamp)

  let backtrackCount = 0, totalCursorMoves = 0
  for (let i = 1; i < cursorEvents.length; i++) {
    const delta = cursorEvents[i].cursor_position - cursorEvents[i - 1].cursor_position
    // Only count jumps >= 50 chars backward as suspicious (ignores inline edits/word nav)
    if (delta < -50) backtrackCount++
    totalCursorMoves++
  }

  const cursorBacktrackRate = totalCursorMoves > 0 ? backtrackCount / totalCursorMoves : 0.3

  let linearityScore: number
  if      (cursorBacktrackRate < 0.02) linearityScore = 0.85
  else if (cursorBacktrackRate < 0.05) linearityScore = 0.65
  else if (cursorBacktrackRate < 0.10) linearityScore = 0.35
  else if (cursorBacktrackRate < 0.20) linearityScore = 0.10
  else                                 linearityScore = 0.00

  // Only flag linearity when corroborated by low intra-segment revision
  // (prevents false positives from normal buzzword typing / inline navigation)
  if (linearityScore > 0.5 && intraSegmentRevisionScore > 0.40) {
    flags.push(`Writing is unusually linear — organic writers edit earlier sections more frequently`)
  }

  // ── Signal 5: Correlated pause-tab-burst triplets ───────────────────────────
  // Even slow copiers: read AI in another tab → switch back → type.
  const windowEvents = events
    .filter((e: AnyEvent) => e.event_type === 'window_hidden')
    .sort((a: AnyEvent, b: AnyEvent) => a.timestamp - b.timestamp)

  let correlatedTriplets = 0
  for (const wEvent of windowEvents) {
    const hiddenDuration = wEvent.payload?.duration_before_return_ms || 0
    if (hiddenDuration < 5000 || hiddenDuration > 120000) continue

    const returnTime       = wEvent.timestamp + hiddenDuration
    const followingSegment = segments.find(
      s => s.startTime >= returnTime && s.startTime <= returnTime + 10000
    )
    if (followingSegment && followingSegment.charCount >= 8 && followingSegment.charCount <= 120) {
      correlatedTriplets++
    }
  }

  const tripletScore = Math.min(correlatedTriplets * 0.18, 1.0)
  if (correlatedTriplets >= 2) {
    flags.push(`${correlatedTriplets} tab-switch → writing burst pattern(s) detected`)
  }

  // ── Combined score ───────────────────────────────────────────────────────────
  const combinedScore = Math.min(
    (burstRegularityScore      * 0.30) +
    (intraSegmentRevisionScore * 0.25) +
    (pauseRegularityScore      * 0.20) +
    (linearityScore            * 0.15) +
    (tripletScore              * 0.10),
    0.90
  )

  const confidence = segments.length < 6 ? 'low'
    : segments.length < 12 ? 'medium'
    : 'high'

  return {
    burstLengthCV, burstLengthMean, burstRegularityScore,
    withinPhraseDeleteRate, intraSegmentRevisionScore,
    pauseCV, pauseMean, pauseRegularityScore,
    cursorBacktrackRate, linearityScore,
    correlatedTriplets, tripletScore,
    combinedScore, confidence, flags,
  }
}

// ─── TypeNet-inspired features ────────────────────────────────────────────────
// Approximates IEEE TypeNet: digraph latency CV, error correction ratio,
// typing speed variance across windows, and pause-to-burst ratio.

export interface TypeNetFeatures {
  commonDigraphCV:      number   // CV of inter-keystroke latencies (high = human)
  errorCorrectionRatio: number   // delete / total events (high = organic)
  speedWindowCV:        number   // CV of chars/min across 30-key windows (high = human)
  pauseToBurstRatio:    number   // time pausing / total time
  typeNetScore:         number   // 0–1, higher = more AI-assisted
  confidence:           'insufficient' | 'low' | 'medium' | 'high'
}

export function extractTypeNetFeatures(events: AnyEvent[]): TypeNetFeatures {
  const insufficient: TypeNetFeatures = {
    commonDigraphCV: 1, errorCorrectionRatio: 0.15,
    speedWindowCV: 1, pauseToBurstRatio: 0.5,
    typeNetScore: 0, confidence: 'insufficient',
  }

  const allTyping = events
    .filter(e => e.event_type === 'keystroke' || e.event_type === 'delete')
    .sort((a: AnyEvent, b: AnyEvent) => a.timestamp - b.timestamp)

  if (allTyping.length < 40) return insufficient

  const ksOnly  = allTyping.filter(e => e.event_type === 'keystroke' && !e.payload?.is_delete_key)
  const delOnly = allTyping.filter(e => e.event_type === 'delete' || e.payload?.is_delete_key)

  // Feature 1: Digraph latency CV — low = uniform pace = suspicious
  const digraphLatencies: number[] = []
  for (let i = 1; i < ksOnly.length; i++) {
    const gap = ksOnly[i].timestamp - ksOnly[i - 1].timestamp
    if (gap > 0 && gap < 5000) digraphLatencies.push(gap)
  }
  const commonDigraphCV = digraphLatencies.length > 10 ? computeCV(digraphLatencies) : 1

  // Feature 2: Error correction ratio — low = not correcting = suspicious
  const errorCorrectionRatio = allTyping.length > 0
    ? delOnly.length / allTyping.length
    : 0.15

  // Feature 3: Speed variance across 30-keystroke windows — low = uniform = suspicious
  const WINDOW = 30
  const speedWindows: number[] = []
  for (let i = 0; i + WINDOW <= ksOnly.length; i += 15) {
    const win      = ksOnly.slice(i, i + WINDOW)
    const duration = win[win.length - 1].timestamp - win[0].timestamp
    if (duration > 0) speedWindows.push(WINDOW / (duration / 60000))
  }
  const speedWindowCV = speedWindows.length >= 3 ? computeCV(speedWindows) : 1

  // Feature 4: Pause-to-burst ratio
  let totalPauseMs = 0, totalActiveMs = 0
  for (let i = 1; i < ksOnly.length; i++) {
    const gap = ksOnly[i].timestamp - ksOnly[i - 1].timestamp
    if (gap > 3000) totalPauseMs += gap
    else            totalActiveMs += gap
  }
  const pauseToBurstRatio = (totalPauseMs + totalActiveMs) > 0
    ? totalPauseMs / (totalPauseMs + totalActiveMs)
    : 0.5

  // Convert each feature to suspicion score (0–1)
  const digraphScore = commonDigraphCV < 0.30 ? 0.85 : commonDigraphCV < 0.50 ? 0.55 : commonDigraphCV < 0.80 ? 0.20 : 0.05
  const errorScore   = errorCorrectionRatio < 0.03 ? 0.85 : errorCorrectionRatio < 0.07 ? 0.60 : errorCorrectionRatio < 0.15 ? 0.30 : 0.05
  const speedScore   = speedWindowCV < 0.25 ? 0.80 : speedWindowCV < 0.45 ? 0.50 : speedWindowCV < 0.70 ? 0.20 : 0.05
  const pauseScore   = pauseToBurstRatio < 0.15 ? 0.70 : pauseToBurstRatio > 0.80 ? 0.55 : 0.10

  const typeNetScore = Math.min(
    (digraphScore * 0.30) + (errorScore * 0.35) + (speedScore * 0.25) + (pauseScore * 0.10),
    0.90
  )

  const confidence = ksOnly.length < 40 ? 'insufficient'
    : ksOnly.length < 80  ? 'low'
    : ksOnly.length < 150 ? 'medium'
    : 'high'

  return { commonDigraphCV, errorCorrectionRatio, speedWindowCV, pauseToBurstRatio, typeNetScore, confidence }
}
