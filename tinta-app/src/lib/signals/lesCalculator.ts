import type { TintaEvent, Session, PasteEvent, LesBand } from '@/types'
import { computeRevisionDepth }       from './revisionDepth'
import { computeSessionDistribution } from './sessionDistribution'
import { computeOrganicRatio }        from './organicRatio'
import { computePasteDeclarationRate } from './pasteDeclarationRate'
import { computeVelocityConsistency }  from './velocityConsistency'
import { analyzeKeystrokeDynamics }   from './keystrokeDynamics'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LESComponents {
  revisionDepth:       number  // 0–1
  sessionDistribution: number  // 0–1
  organicRatio:        number  // 0–1
  pasteDeclarationRate:number  // 0–1
  velocityConsistency: number  // 0–1
  tabSwitchScore:      number  // 0–1
}

export interface LESResult {
  total:      number       // 0–100, 1 decimal place
  band:       LesBand
  components: LESComponents
}

// ─── Weights (must sum to 1.0) ────────────────────────────────────────────────

const WEIGHTS = {
  revisionDepth:        0.25,
  sessionDistribution:  0.20,
  organicRatio:         0.20,
  pasteDeclarationRate: 0.15,
  velocityConsistency:  0.10,
  tabSwitchScore:       0.10,
} as const

// ─── Band mapping ─────────────────────────────────────────────────────────────

function toBand(score: number): LesBand {
  if (score <= 30) return 'Perlu Perhatian'
  if (score <= 55) return 'Perlu Tinjauan'
  if (score <= 75) return 'Cukup'
  return 'Baik'
}

// ─────────────────────────────────────────────────────────────────────────────

export function computeLES(
  events:      TintaEvent[],
  sessions:    Session[],
  pasteEvents: PasteEvent[]
): LESResult {
  // IKD score replaces the simpler tab-switch counter — more accurate signal
  const ikdResult = analyzeKeystrokeDynamics(events)

  const components: LESComponents = {
    revisionDepth:        computeRevisionDepth(events),
    sessionDistribution:  computeSessionDistribution(sessions),
    organicRatio:         computeOrganicRatio(events),
    pasteDeclarationRate: computePasteDeclarationRate(pasteEvents),
    velocityConsistency:  computeVelocityConsistency(events),
    tabSwitchScore:       ikdResult.score,
  }

  const raw =
    components.revisionDepth        * WEIGHTS.revisionDepth        +
    components.sessionDistribution   * WEIGHTS.sessionDistribution   +
    components.organicRatio          * WEIGHTS.organicRatio          +
    components.pasteDeclarationRate  * WEIGHTS.pasteDeclarationRate  +
    components.velocityConsistency   * WEIGHTS.velocityConsistency   +
    components.tabSwitchScore        * WEIGHTS.tabSwitchScore

  const total = Math.round(raw * 1000) / 10  // 0–100, 1 decimal

  return { total, band: toBand(total), components }
}
