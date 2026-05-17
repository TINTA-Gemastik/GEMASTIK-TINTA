// Heuristic: find sentences in doc text that look like factual claims
// but have no declared reference. (PRD §7.2)

// Patterns suggesting a factual claim that needs a citation
const FACTUAL_RE = new RegExp(
  [
    /menurut/i,
    /berdasarkan/i,
    /penelitian/i,
    /studi/i,
    /data menunjukkan/i,
    /menunjukkan bahwa/i,
    /sebesar/i,
    /\d+\s*%/,
    /\d+[\.,]\d+\s*(juta|miliar|ribu)/i,
    /\(\d{4}\)/,                 // in-text citation like (Smith, 2023)
  ]
    .map(r => r.source)
    .join('|')
)

/** Split raw document text into non-trivial sentences. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20)
}

/**
 * Return sentences that contain factual-claim patterns.
 * In a real implementation these would be cross-referenced against the
 * document_references table to exclude already-confirmed sentences.
 * For the MVP we return all matching sentences.
 */
export function detectUnconfirmedFacts(docText: string): string[] {
  const sentences = splitSentences(docText)
  return sentences.filter(s => FACTUAL_RE.test(s))
}
