import { createClient } from '@/lib/supabase/client'
import type { TintaEventInsert } from '@/types'
import { estimateWordDiffFromEvents } from '@/lib/signals/lineDiff'

// ─── createSession ────────────────────────────────────────────────────────────

export async function createSession(taskId: string, userId: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sessions')
    .insert({ task_id: taskId, user_id: userId })
    .select('id')
    .single()

  if (error || !data) throw new Error('Failed to create session: ' + error?.message)
  return data.id
}

// ─── computeSessionSummary ────────────────────────────────────────────────────
// Derives all sessions-table summary columns from the raw event list.

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

export async function closeSession(
  sessionId: string,
  events: TintaEventInsert[],
  startedAt: number
): Promise<void> {
  const summary          = computeSessionSummary(events)
  const durationActiveMs = Date.now() - startedAt
  const finalWords       = Math.round(summary.final_doc_length / 5.5)
  const lineDiff         = estimateWordDiffFromEvents(events, 0, finalWords)

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
