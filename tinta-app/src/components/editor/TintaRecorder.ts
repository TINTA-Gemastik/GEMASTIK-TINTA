import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReplaceStep } from '@tiptap/pm/transform'
import { v4 as uuidv4 } from 'uuid'
import type { TintaEventInsert, EventType } from '@/types'

// ─── Options ─────────────────────────────────────────────────────────────────

export interface TintaRecorderOptions {
  sessionId: string
  userId: string
  taskId: string
  onEvent: (event: TintaEventInsert) => void
}

// ─── Plugin key ───────────────────────────────────────────────────────────────

const TintaRecorderKey = new PluginKey('tintaRecorder')

// ─── Extension ───────────────────────────────────────────────────────────────

export const TintaRecorder = Extension.create<TintaRecorderOptions>({
  name: 'tintaRecorder',

  addOptions() {
    return {
      sessionId: '',
      userId: '',
      taskId: '',
      onEvent: () => {},
    }
  },

  addProseMirrorPlugins() {
    // Capture options in a stable getter so appendTransaction always reads
    // the latest values (important if sessionId is updated after init).
    const getOptions = () => this.options

    // Mutable flags — set by DOM event handlers, read by appendTransaction
    let isPasting = false
    let lastPastedText = ''
    let pendingHistoryOp: 'undo' | 'redo' | null = null

    return [
      new Plugin({
        key: TintaRecorderKey,

        props: {
          // ── Capture raw clipboard text before TipTap normalises it ──────
          handleDOMEvents: {
            paste: (_view, e) => {
              const text = (e as ClipboardEvent).clipboardData?.getData('text/plain') ?? ''
              lastPastedText = text
              isPasting = true
              return false // let TipTap handle the actual insertion
            },
          },

          // ── Intercept Ctrl/Cmd+Z / Ctrl/Cmd+Y before the history plugin ─
          handleKeyDown: (_view, e) => {
            const mod = e.ctrlKey || e.metaKey
            if (mod && !e.shiftKey && e.key === 'z') {
              pendingHistoryOp = 'undo'
            } else if (mod && e.shiftKey && e.key === 'z') {
              pendingHistoryOp = 'redo'
            } else if (mod && e.key === 'y') {
              pendingHistoryOp = 'redo'
            }
            return false // always let default handling proceed
          },
        },

        // ── Observe every transaction batch ───────────────────────────────
        appendTransaction(transactions, oldState, newState) {
          const opts = getOptions()
          if (!opts.sessionId) return null // session not ready yet

          const docChanged   = transactions.some(tr => tr.docChanged)
          const selChanged   = transactions.some(tr => tr.selectionSet)
          if (!docChanged && !selChanged) return null

          const docLenBefore = oldState.doc.textContent.length
          const docLenAfter  = newState.doc.textContent.length
          const cursorPos    = newState.selection.from

          const base = (): Omit<TintaEventInsert, 'event_type' | 'payload'> => ({
            event_id:          uuidv4(),
            timestamp:         Date.now(),
            session_id:        opts.sessionId,
            user_id:           opts.userId,
            task_id:           opts.taskId,
            cursor_position:   cursorPos,
            doc_length_before: docLenBefore,
            doc_length_after:  docLenAfter,
          })

          const emit = (event_type: EventType, payload: Record<string, unknown>) =>
            opts.onEvent({ ...base(), event_type, payload })

          // ── Selection-only (no doc change) ───────────────────────────────
          if (!docChanged) {
            const { from, to } = newState.selection
            if (from !== to) {
              emit('select', {
                selected_text:   newState.doc.textBetween(from, to, '\n'),
                selection_start: from,
                selection_end:   to,
              })
            }
            return null
          }

          // ── Undo / Redo (keyboard shortcut was intercepted above) ─────────
          if (pendingHistoryOp) {
            const op = pendingHistoryOp
            pendingHistoryOp = null
            emit(op, {
              chars_restored: Math.max(0, docLenAfter  - docLenBefore),
              chars_removed:  Math.max(0, docLenBefore - docLenAfter),
            })
            return null
          }

          // ── Paste ─────────────────────────────────────────────────────────
          if (isPasting) {
            isPasting = false
            const pastedText = lastPastedText
            lastPastedText   = ''
            emit('paste', {
              pasted_text:       pastedText,
              pasted_char_count: pastedText.length,
              declared_type:     null,
              source_url:        null,
            })
            return null
          }

          // Use the last transaction's steps for fine-grained text extraction
          const lastTr = transactions[transactions.length - 1]

          // ── Delete ────────────────────────────────────────────────────────
          if (docLenAfter < docLenBefore) {
            const wasSelection = oldState.selection.from !== oldState.selection.to
            let deletedText    = ''
            for (const step of lastTr.steps) {
              if (step instanceof ReplaceStep) {
                try {
                  deletedText += oldState.doc.textBetween(
                    (step as ReplaceStep).from,
                    (step as ReplaceStep).to,
                    '\n'
                  )
                } catch { /* ignore malformed step ranges */ }
              }
            }
            emit('delete', {
              deleted_text:       deletedText,
              deleted_char_count: docLenBefore - docLenAfter,
              was_selection:      wasSelection,
            })
            return null
          }

          // ── Keystroke (single-char or multi-char insertion) ────────────────
          if (docLenAfter > docLenBefore) {
            let insertedChar = ''
            for (const step of lastTr.steps) {
              if (step instanceof ReplaceStep) {
                try {
                  insertedChar = (step as ReplaceStep).slice.content.textBetween(
                    0,
                    (step as ReplaceStep).slice.content.size,
                    ''
                  )
                } catch { /* ignore */ }
              }
            }
            emit('keystroke', { key: insertedChar, is_delete_key: false })
          }

          return null // never append a new transaction
        },
      }),
    ]
  },
})
