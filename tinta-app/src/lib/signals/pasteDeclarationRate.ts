import type { PasteEvent } from '@/types'

/**
 * Paste Declaration Rate — % of non-benign paste events that received a declared_type.
 * Auto-classified benign pastes are excluded (already handled).
 * If 0 non-benign paste events, returns 1.0 (nothing to declare).
 * Returns a 0–1 float.
 */
export function computePasteDeclarationRate(pasteEvents: PasteEvent[]): number {
  // Only consider events that weren't auto-classified as benign
  const nonBenign = pasteEvents.filter(
    p => !(p.auto_classified && p.declared_type === 'benign')
  )

  if (nonBenign.length === 0) return 1.0

  const declared = nonBenign.filter(p => p.declared_type !== null)
  return declared.length / nonBenign.length
}
