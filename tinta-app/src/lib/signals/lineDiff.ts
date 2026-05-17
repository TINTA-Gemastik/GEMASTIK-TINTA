// Word-level diff — TINTA session delta
//
// Compares document text at session start vs. now at the word level,
// using LCS (Longest Common Subsequence) to find changed words.
//
// Example:
//   Initial: "The cat sat on the mat"
//   Current: "The big cat sat on the floor"
//   Insertions: "big", "floor" = +2
//   Deletions: "mat" = -1

export interface WordDiff {
  insertions:   number
  deletions:    number
  wordsAdded:   string[]
  wordsRemoved: string[]
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0)
}

// Two-row DP — memory-efficient, capped at 500 words for performance
function lcsLength(a: string[], b: string[]): number {
  const m = Math.min(a.length, 500)
  const n = Math.min(b.length, 500)
  let prev = new Array(n + 1).fill(0)
  let curr = new Array(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1] + 1
        : Math.max(prev[j], curr[j - 1])
    }
    ;[prev, curr] = [curr, prev]
    curr.fill(0)
  }
  return prev[n]
}

export function computeWordDiff(initialText: string, currentText: string): WordDiff {
  const initialWords = tokenize(initialText)
  const currentWords = tokenize(currentText)

  if (initialWords.length === 0 && currentWords.length === 0) {
    return { insertions: 0, deletions: 0, wordsAdded: [], wordsRemoved: [] }
  }
  if (initialWords.length === 0) {
    return { insertions: currentWords.length, deletions: 0, wordsAdded: currentWords.slice(0, 10), wordsRemoved: [] }
  }
  if (currentWords.length === 0) {
    return { insertions: 0, deletions: initialWords.length, wordsAdded: [], wordsRemoved: initialWords.slice(0, 10) }
  }

  const lcs        = lcsLength(initialWords, currentWords)
  const insertions = Math.max(0, currentWords.length - lcs)
  const deletions  = Math.max(0, initialWords.length - lcs)

  // Approximate word lists via set difference (displayed only)
  const initialSet = new Map<string, number>()
  initialWords.forEach(w => initialSet.set(w, (initialSet.get(w) ?? 0) + 1))
  const currentSet = new Map<string, number>()
  currentWords.forEach(w => currentSet.set(w, (currentSet.get(w) ?? 0) + 1))

  const wordsAdded: string[] = []
  currentSet.forEach((count, word) => {
    if (count > (initialSet.get(word) ?? 0)) wordsAdded.push(word)
  })
  const wordsRemoved: string[] = []
  initialSet.forEach((count, word) => {
    if (count > (currentSet.get(word) ?? 0)) wordsRemoved.push(word)
  })

  return { insertions, deletions, wordsAdded: wordsAdded.slice(0, 10), wordsRemoved: wordsRemoved.slice(0, 10) }
}

// Estimate from event stream when text snapshots aren't available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function estimateWordDiffFromEvents(
  events:           any[],
  initialWordCount: number,
  currentWordCount: number
): { insertions: number; deletions: number } {
  const wordInsertions = events.filter(
    e => e.event_type === 'keystroke' &&
         (e.payload?.key === ' ' || e.payload?.key === 'Enter') &&
         !e.payload?.is_delete_key
  ).length

  const pasteWordAdditions = events
    .filter(e => e.event_type === 'paste')
    .reduce((sum, e) => sum + tokenize(e.payload?.pasted_text ?? '').length, 0)

  const wordDeletions = events
    .filter(e => e.event_type === 'delete')
    .filter(e => {
      const text: string = e.payload?.deleted_text ?? ''
      return text.includes(' ') || text.includes('\n')
    }).length

  // Sanity-clamp to net change
  const netChange = currentWordCount - initialWordCount
  const rawIns = wordInsertions + pasteWordAdditions
  const rawDel = wordDeletions

  if (netChange >= 0) {
    return { insertions: Math.max(rawIns, netChange), deletions: Math.max(0, rawDel) }
  }
  return { insertions: Math.max(0, rawIns), deletions: Math.max(rawDel, -netChange) }
}
