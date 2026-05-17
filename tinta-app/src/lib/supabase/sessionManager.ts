import { createClient } from '@/lib/supabase/client'
import type { TintaEventInsert } from '@/types'
import { computeWordDiff, estimateWordDiffFromEvents } from '@/lib/signals/lineDiff'

// ─── createSession ────────────────────────────────────────────────────────────
// Reuses an existing open session (ended_at IS NULL) for the same task+user
// to prevent duplicate session rows on page reload or quick re-entry.

export async function createSession(taskId: string, userId: string): Promise<string> {
  const supabase = createClient()

  // Check for an existing open session first
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return existing.id
  }

  // No open session — create a new one
  const { data, error } = await supabase
    .from('sessions')
    .insert({ task_id: taskId, user_id: userId })
    .select('id')
    .single()

  if (error || !data) throw new Error('Failed to create session: ' + error?.message)
  return data.id
}

// ─── computeSessionSummary ────────────────────────────────────────────────────

export function computeSessionSummary(events: TintaEventInsert[]) {
  let charsTyped      = 0
  let charsDeleted    = 0
  let charsPasted     = 0
  let pasteEventCount = 0
  let undoCount       = 0
  let tabSwitchCount  = 0
  let idlePeriods     = 0
  let finalDocLength  = 0

  for (const ev of events) {
    const p = ev.payload as Record<string, number>

    switch (ev.event_type) {
      case 'keystroke':     charsTyped++;                                  break
      case 'delete':        charsDeleted    += p.deleted_char_count ?? 0;  break
      case 'paste':         charsPasted     += p.pasted_char_count  ?? 0;
                            pasteEventCount++;                             break
      case 'undo':          undoCount++;                                    break
      case 'window_hidden': tabSwitchCount++;                               break
      case 'idle':          idlePeriods++;                                  break
    }

    if (ev.doc_length_after !== null && ev.doc_length_after !== undefined) {
      finalDocLength = ev.doc_length_after
    }
  }

  const firstDocLength = events.find(e => e.doc_length_before != null)?.doc_length_before ?? 0
  const netCharsAdded  = finalDocLength - firstDocLength

  return {
    chars_typed:        charsTyped,
    chars_deleted:      charsDeleted,
    chars_pasted:       charsPasted,
    paste_event_count:  pasteEventCount,
    net_chars_added:    netCharsAdded,
    undo_count:         undoCount,
    tab_switch_count:   tabSwitchCount,
    idle_periods:       idlePeriods,
    final_doc_length:   finalDocLength,
  }
}

// ─── closeSession ─────────────────────────────────────────────────────────────
// When initialText + currentText are provided, uses LCS word diff (accurate).
// Otherwise falls back to event-stream estimation (used for beacon closes).

export async function closeSession(
  sessionId:   string,
  events:      TintaEventInsert[],
  startedAt:   number,
  initialText?: string,
  currentText?: string
): Promise<void> {
  const summary          = computeSessionSummary(events)
  const durationActiveMs = Date.now() - startedAt

  let lineDiff: { insertions: number; deletions: number }

  if (initialText !== undefined && currentText !== undefined) {
    // Accurate word-level LCS diff
    lineDiff = computeWordDiff(initialText, currentText)
  } else {
    // Fallback: estimate from event stream using correct initial word count
    const firstDocLength = events.find(e => e.doc_length_before != null)?.doc_length_before ?? 0
    const initialWords   = Math.round(firstDocLength / 5.5)
    const finalWords     = Math.round(summary.final_doc_length / 5.5)
    lineDiff = estimateWordDiffFromEvents(events, initialWords, finalWords)
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at:           new Date().toISOString(),
      duration_active_ms: durationActiveMs,
      line_insertions:    lineDiff.insertions,
      line_deletions:     lineDiff.deletions,
      ...summary,
    })
    .eq('id', sessionId)

  if (error) {
    console.error('[SessionManager] closeSession failed:', error.message)
    throw error
  }
}
