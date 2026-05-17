// EDM 2024 keystroke-pattern based plagiarism risk analysis.

export interface PlagiarismSignal {
  type:         'paste_without_declaration' | 'iki_post_paste_match' | 'velocity_spike' | 'ngram_reuse' | 'session_suspicion'
  confidence:   number        // 0–1
  description:  string
  timestamp?:   number
  relatedText?: string
}

export interface PlagiarismAnalysisResult {
  overallRisk:              'low' | 'medium' | 'high'
  riskScore:                number   // 0–1
  signals:                  PlagiarismSignal[]
  pasteOriginEstimate:      number   // 0–1, estimated fraction of content from paste
  keystrokeOriginEstimate:  number   // 0–1
  summary:                  string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function analyzePlagiarismRisk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events:         any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pasteEvents:    any[],
  finalDocLength: number,
): PlagiarismAnalysisResult {
  const signals: PlagiarismSignal[] = []

  // ── Signal 1: Undeclared large pastes ────────────────────────────────────
  const undeclared = pasteEvents.filter(p => !p.declared_type && p.pasted_char_count > 200)
  if (undeclared.length > 0) {
    signals.push({
      type:        'paste_without_declaration',
      confidence:  Math.min(0.9, undeclared.length * 0.3),
      description: `${undeclared.length} large paste(s) without source declaration`,
      relatedText: undeclared[0]?.pasted_text?.slice(0, 80),
    })
  }

  // ── Signal 2: IKI post-paste uniformity ──────────────────────────────────
  const keystrokes = events
    .filter(e => e.event_type === 'keystroke' && !e.payload?.is_delete_key)
    .sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp)

  for (const paste of pasteEvents) {
    const post = keystrokes.filter(
      k => k.timestamp > paste.timestamp && k.timestamp < paste.timestamp + 30_000
    )
    if (post.length < 20) continue

    const ikis: number[] = []
    for (let i = 1; i < post.length; i++) {
      const interval = post[i].timestamp - post[i - 1].timestamp
      if (interval < 5_000) ikis.push(interval)
    }
    if (ikis.length < 10) continue

    const mean = ikis.reduce((a, b) => a + b, 0) / ikis.length
    const variance = ikis.reduce((a, b) => a + (b - mean) ** 2, 0) / ikis.length
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1

    if (mean < 200 && cv < 0.4) {
      signals.push({
        type:        'iki_post_paste_match',
        confidence:  0.65,
        description: 'Uniform typing detected immediately after paste — possible read-and-retype',
        timestamp:   paste.timestamp,
      })
    }
  }

  // ── Signal 3: Velocity spikes ─────────────────────────────────────────────
  const WINDOW_MS = 5_000
  const spikes: number[] = []
  for (let i = 0; i < keystrokes.length; i++) {
    const windowEnd = keystrokes[i].timestamp + WINDOW_MS
    let count = 0
    for (let j = i; j < keystrokes.length && keystrokes[j].timestamp <= windowEnd; j++) count++
    if (count / (WINDOW_MS / 1000) > 8) spikes.push(keystrokes[i].timestamp)
    // Skip to end of this window to avoid re-counting overlapping windows
    while (i + 1 < keystrokes.length && keystrokes[i + 1].timestamp <= windowEnd) i++
  }
  if (spikes.length > 0) {
    signals.push({
      type:        'velocity_spike',
      confidence:  Math.min(0.7, spikes.length * 0.25),
      description: `${spikes.length} velocity spike(s) detected — typing speed exceeded physiological limit`,
      timestamp:   spikes[0],
    })
  }

  // ── Signal 4: Paste-origin ratio ──────────────────────────────────────────
  const pastedChars      = pasteEvents.reduce((s, p) => s + (p.pasted_char_count ?? 0), 0)
  const pasteOriginEstimate = finalDocLength > 0 ? Math.min(1, pastedChars / finalDocLength) : 0

  if (pasteOriginEstimate > 0.5) {
    signals.push({
      type:        'ngram_reuse',
      confidence:  pasteOriginEstimate * 0.8,
      description: `~${Math.round(pasteOriginEstimate * 100)}% of document content appears to originate from pasted text`,
    })
  }

  // ── Signal 5: Single-session high-output ──────────────────────────────────
  const sessionMs  = keystrokes.length > 1
    ? keystrokes[keystrokes.length - 1].timestamp - keystrokes[0].timestamp
    : 0
  const wordCount  = Math.floor(finalDocLength / 5.5)
  const wpm        = sessionMs > 0 ? wordCount / (sessionMs / 60_000) : 0
  if (wpm > 80 && wordCount > 500) {
    signals.push({
      type:        'session_suspicion',
      confidence:  Math.min(0.8, (wpm - 80) / 100),
      description: `Writing velocity: ~${Math.round(wpm)} WPM — exceeds average human typing speed for original composition`,
    })
  }

  // ── Overall risk ──────────────────────────────────────────────────────────
  const maxConf  = signals.length > 0 ? Math.max(...signals.map(s => s.confidence)) : 0
  const avgConf  = signals.length > 0 ? signals.reduce((s, r) => s + r.confidence, 0) / signals.length : 0
  const riskScore = Math.min(1, maxConf * 0.6 + avgConf * 0.4)
  const overallRisk: 'low' | 'medium' | 'high' = riskScore < 0.35 ? 'low' : riskScore < 0.65 ? 'medium' : 'high'

  const summary =
    overallRisk === 'low'    ? 'Writing patterns appear consistent with original composition.' :
    overallRisk === 'medium' ? `${signals.length} pattern(s) detected that may indicate external sourcing.` :
    'Multiple high-confidence signals detected suggesting significant external content.'

  return {
    overallRisk,
    riskScore,
    signals,
    pasteOriginEstimate,
    keystrokeOriginEstimate: Math.max(0, 1 - pasteOriginEstimate),
    summary,
  }
}
