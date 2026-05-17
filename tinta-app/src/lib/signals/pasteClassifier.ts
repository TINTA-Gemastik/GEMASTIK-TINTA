// Auto-classification rules for paste events (PRD §7.1)

const URL_RE    = /^https?:\/\//i
const DOI_RE    = /\bdoi\.org\b/i
const YEAR_RE   = /\(\d{4}\)/            // e.g. (2023)
const BIBLIO_RE = /\(\d{4}\)/            // year in parens + comma = bibliography pattern

export interface PasteClassification {
  autoClassified: boolean
  type: 'benign' | 'citation' | null
}

export function classifyPaste(text: string): PasteClassification {
  // Rule 1 — short text is benign
  if (text.length < 60) return { autoClassified: true, type: 'benign' }

  const trimmed = text.trim()

  // Rule 2 — URL or DOI
  if (URL_RE.test(trimmed) || DOI_RE.test(trimmed)) {
    return { autoClassified: true, type: 'citation' }
  }

  // Rule 3 — bibliography pattern: year in parens AND comma-separated content
  // e.g. "Sanjaya, B. (2023). Teknologi Pendidikan. Jakarta: Pustaka."
  if (YEAR_RE.test(trimmed) && trimmed.includes(',')) {
    return { autoClassified: true, type: 'citation' }
  }

  return { autoClassified: false, type: null }
}
