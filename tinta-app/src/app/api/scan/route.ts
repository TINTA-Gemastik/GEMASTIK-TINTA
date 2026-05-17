import { NextRequest, NextResponse } from 'next/server'

// TINTA Behavioral AI Likelihood Engine
//
// Three-layer analysis:
//   Layer 1 (basic):    paste ratio, IKI uniformity, tab-burst pattern, organic rate
//   Layer 2 (advanced): burst size regularity, within-phrase editing, pause variance,
//                        cursor linearity — targets "slow AI copying" that Layer 1 misses
//   Layer 3 (TypeNet):  digraph CV, error correction rate, speed variance across windows
//
// Blending: when TypeNet available (25% weight), otherwise Layer 1 / Layer 2.
// Score capped at 0.90 — never accuse at maximum confidence.

export interface BehavioralSignals {
  pasteRatio:        number
  organicRatio:      number
  ikiCV:             number
  ikiMean:           number
  burstPatternCount: number
  tabSwitchCount:    number
  sessionDurationMs: number
  totalKeystrokes:   number
}

interface ScanRequest extends BehavioralSignals {
  // Advanced pattern signals
  burstRegularityScore?:      number
  intraSegmentRevisionScore?: number
  pauseRegularityScore?:      number
  linearityScore?:            number
  tripletScore?:              number
  advancedConfidence?:        string
  advancedFlags?:             string[]
  // TypeNet-inspired signals
  typeNetScore?:              number
  typeNetConfidence?:         string
  errorCorrectionRatio?:      number
  speedWindowCV?:             number
}

function computeBehavioralScore(signals: ScanRequest): {
  score:      number
  breakdown:  Record<string, number>
  confidence: string
} {
  const {
    pasteRatio = 0, organicRatio = 1, ikiCV, ikiMean, burstPatternCount, totalKeystrokes,
    burstRegularityScore      = 0,
    intraSegmentRevisionScore = 0,
    pauseRegularityScore      = 0,
    linearityScore            = 0,
    tripletScore              = 0,
    advancedConfidence        = 'insufficient',
    typeNetScore,
    typeNetConfidence         = 'insufficient',
    errorCorrectionRatio      = 0,
    speedWindowCV             = 1,
  } = signals

  // ── Layer 1 signals ──────────────────────────────────────────────────────────

  const pasteScore = Math.min(pasteRatio * 1.3, 1.0)

  let ikiScore = 0
  if (totalKeystrokes >= 50) {
    if      (ikiCV < 0.25) ikiScore = 0.9
    else if (ikiCV < 0.35) ikiScore = 0.7
    else if (ikiCV < 0.5)  ikiScore = 0.4
    else if (ikiCV < 0.8)  ikiScore = 0.15
    else                   ikiScore = 0.0
    if (ikiMean < 150 && ikiCV < 0.4) ikiScore = Math.min(ikiScore * 1.2, 1)
    if (ikiMean > 400)                 ikiScore *= 0.6
  }

  const burstScore   = Math.min(burstPatternCount * 0.22, 1.0)
  const organicScore = Math.max(0, 1 - organicRatio)

  const layer1Score =
    (pasteScore   * 0.35) +
    (ikiScore     * 0.25) +
    (burstScore   * 0.20) +
    (organicScore * 0.20)

  // ── Layer 2 (advanced) ───────────────────────────────────────────────────────

  const hasAdvanced = advancedConfidence !== 'insufficient' && advancedConfidence !== 'low'
  const advancedCombined =
    (burstRegularityScore      * 0.30) +
    (intraSegmentRevisionScore * 0.25) +
    (pauseRegularityScore      * 0.20) +
    (linearityScore            * 0.15) +
    (tripletScore              * 0.10)

  // ── Layer 3 (TypeNet) + blending ─────────────────────────────────────────────

  const hasTypeNet = typeNetScore !== undefined &&
    typeNetConfidence !== 'insufficient' && typeNetConfidence !== 'low'

  let rawScore: number
  if (hasTypeNet) {
    rawScore =
      (pasteScore        * 0.25) +
      (ikiScore          * 0.15) +
      (burstScore        * 0.15) +
      (organicScore      * 0.15) +
      (advancedCombined  * 0.05) +
      (typeNetScore!     * 0.25)
  } else if (hasAdvanced) {
    rawScore = (layer1Score * 0.40) + (advancedCombined * 0.60)
  } else {
    rawScore = layer1Score
  }

  const score = Math.min(rawScore, 0.90)

  const confidence = hasTypeNet ? typeNetConfidence
    : hasAdvanced ? advancedConfidence
    : totalKeystrokes < 30  ? 'low'
    : totalKeystrokes < 100 ? 'medium'
    : 'high'

  // TypeNet breakdown bars (scale raw ratios to 0–100 for display)
  const errorCorrectionBar = Math.min(Math.round(errorCorrectionRatio * 500), 100)
  const speedVarianceBar   = Math.min(Math.round(speedWindowCV * 100), 100)

  return {
    score: Math.round(score * 100) / 100,
    breakdown: {
      pasteOrigin:         Math.round(pasteScore                       * 100),
      ikiUniformity:       Math.round(ikiScore                         * 100),
      tabBurstPattern:     Math.round(burstScore                       * 100),
      lowOrganicRate:      Math.round(organicScore                     * 100),
      burstRegularity:     Math.round(burstRegularityScore             * 100),
      withinPhraseEditing: Math.round((1 - intraSegmentRevisionScore)  * 100),
      pauseVariance:       Math.round((1 - pauseRegularityScore)       * 100),
      cursorLinearity:     Math.round(linearityScore                   * 100),
      errorCorrection:     errorCorrectionBar,
      speedVariance:       speedVarianceBar,
    },
    confidence,
  }
}

export async function POST(req: NextRequest) {
  const signals: ScanRequest = await req.json()

  if (!signals || signals.totalKeystrokes === undefined) {
    return NextResponse.json({
      probability: 0,
      source:      'insufficient_data',
      message:     'Not enough behavioral data to analyze',
    })
  }

  const result = computeBehavioralScore(signals)

  return NextResponse.json({
    probability:    result.score,
    source:         'tinta_behavioral',
    confidence:     result.confidence,
    breakdown:      result.breakdown,
    advancedFlags:  signals.advancedFlags ?? [],
    interpretation:
      result.score < 0.2  ? 'Strong evidence of original writing.'
      : result.score < 0.4 ? 'Mostly original with some external content.'
      : result.score < 0.6 ? 'Mixed signals — review paste events and writing patterns.'
      : result.score < 0.75 ? 'Multiple AI-assist indicators detected.'
      : 'Strong behavioral pattern of AI-assisted writing.',
  })
}
