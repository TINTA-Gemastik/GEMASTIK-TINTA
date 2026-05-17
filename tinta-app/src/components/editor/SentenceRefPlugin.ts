// TipTap extension: shows a "+ Referensi" button at the end of the hovered
// sentence and fires a callback when it is clicked. (PRD §7.2)

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorView } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SentenceInfo {
  from: number
  to:   number
  text: string
}

export interface SentenceRefOptions {
  /** Called when the user clicks "+ Referensi" on a sentence. */
  onTag: (sentence: SentenceInfo, view: EditorView) => void
}

// ─── Plugin state ─────────────────────────────────────────────────────────────

interface PluginState {
  decorations: DecorationSet
  lastSentenceTo: number   // avoid re-dispatch when sentence hasn't changed
}

const pluginKey = new PluginKey<PluginState>('sentenceRef')

// ─── Sentence detection ───────────────────────────────────────────────────────

function getSentenceAt(doc: PmNode, pos: number): SentenceInfo | null {
  try {
    const $pos   = doc.resolve(pos)
    const parent = $pos.parent
    if (!parent.isTextblock) return null

    const text = parent.textContent
    if (!text || text.length < 10) return null

    const blockStart = $pos.start()
    const localPos   = Math.max(0, Math.min(pos - blockStart, text.length - 1))

    // Scan backward for `. ` / `! ` / `? ` → sentence starts after that
    let sentStart = 0
    for (let i = localPos - 1; i >= 1; i--) {
      if (
        (text[i - 1] === '.' || text[i - 1] === '!' || text[i - 1] === '?') &&
        text[i] === ' '
      ) {
        sentStart = i + 1
        break
      }
    }

    // Scan forward for `.`/`!`/`?` at end of sentence
    let sentEnd = text.length
    for (let i = localPos; i < text.length; i++) {
      const ch = text[i]
      if (ch === '.' || ch === '!' || ch === '?') {
        if (i + 1 >= text.length || text[i + 1] === ' ' || text[i + 1] === '\n') {
          sentEnd = i + 1
          break
        }
      }
    }

    const sentText = text.slice(sentStart, sentEnd).trim()
    if (sentText.length < 10) return null

    return { from: blockStart + sentStart, to: blockStart + sentEnd, text: sentText }
  } catch {
    return null
  }
}

// ─── Widget factory ───────────────────────────────────────────────────────────

function makeRefButton(
  sentence: SentenceInfo,
  onTag: SentenceRefOptions['onTag'],
  view: EditorView
): HTMLElement {
  const btn    = document.createElement('button')
  btn.textContent = '+ Referensi'
  btn.setAttribute('data-sentence-ref', '1')
  btn.setAttribute('contenteditable', 'false')
  Object.assign(btn.style, {
    display:        'inline',
    fontSize:       '10px',
    fontWeight:     '500',
    color:          '#2D4E71',
    background:     'rgba(170,190,214,0.18)',
    border:         '1px solid rgba(45,78,113,0.35)',
    borderRadius:   '4px',
    padding:        '1px 6px',
    marginLeft:     '5px',
    cursor:         'pointer',
    lineHeight:     '1.6',
    verticalAlign:  'middle',
    fontFamily:     'inherit',
    userSelect:     'none',
    transition:     'background 0.12s',
  })
  btn.addEventListener('mouseenter',  () => { btn.style.background = 'rgba(45,78,113,0.12)' })
  btn.addEventListener('mouseleave',  () => { btn.style.background = 'rgba(170,190,214,0.18)' })
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onTag(sentence, view)
  })
  return btn
}

// ─── Extension ────────────────────────────────────────────────────────────────

export const SentenceRefExtension = Extension.create<SentenceRefOptions>({
  name: 'sentenceRef',

  addOptions(): SentenceRefOptions {
    return { onTag: () => {} }
  },

  addProseMirrorPlugins() {
    const getOnTag = () => this.options.onTag
    let rafId: number | null = null

    return [
      new Plugin<PluginState>({
        key: pluginKey,

        state: {
          init: () => ({ decorations: DecorationSet.empty, lastSentenceTo: -1 }),
          apply(tr, prev) {
            const meta = tr.getMeta(pluginKey) as PluginState | undefined
            if (meta !== undefined) return meta
            // Remap decorations when doc changes
            return {
              decorations:    prev.decorations.map(tr.mapping, tr.doc),
              lastSentenceTo: prev.lastSentenceTo,
            }
          },
        },

        props: {
          decorations: state =>
            pluginKey.getState(state)?.decorations ?? DecorationSet.empty,

          handleDOMEvents: {
            mousemove(view, event) {
              // RAF-throttle: only one update per animation frame
              if (rafId !== null) return false
              rafId = requestAnimationFrame(() => {
                rafId = null

                const result = view.posAtCoords({
                  left: (event as MouseEvent).clientX,
                  top:  (event as MouseEvent).clientY,
                })

                const pluginState = pluginKey.getState(view.state)!

                if (!result) {
                  if (pluginState.lastSentenceTo !== -1) {
                    view.dispatch(
                      view.state.tr.setMeta(pluginKey, {
                        decorations:    DecorationSet.empty,
                        lastSentenceTo: -1,
                      })
                    )
                  }
                  return
                }

                const sentence = getSentenceAt(view.state.doc, result.pos)

                if (!sentence) {
                  if (pluginState.lastSentenceTo !== -1) {
                    view.dispatch(
                      view.state.tr.setMeta(pluginKey, {
                        decorations:    DecorationSet.empty,
                        lastSentenceTo: -1,
                      })
                    )
                  }
                  return
                }

                // Same sentence — skip redundant dispatch
                if (sentence.to === pluginState.lastSentenceTo) return

                const onTag  = getOnTag()
                const widget = Decoration.widget(
                  sentence.to,
                  (view: EditorView) => makeRefButton(sentence, onTag, view),
                  { side: 1, stopEvent: e => ['mousedown', 'mouseenter', 'mouseleave'].includes(e.type) }
                )

                view.dispatch(
                  view.state.tr.setMeta(pluginKey, {
                    decorations:    DecorationSet.create(view.state.doc, [widget]),
                    lastSentenceTo: sentence.to,
                  })
                )
              })

              return false
            },

            mouseleave(view) {
              if (rafId !== null) {
                cancelAnimationFrame(rafId)
                rafId = null
              }
              const pluginState = pluginKey.getState(view.state)
              if (pluginState && pluginState.lastSentenceTo !== -1) {
                view.dispatch(
                  view.state.tr.setMeta(pluginKey, {
                    decorations:    DecorationSet.empty,
                    lastSentenceTo: -1,
                  })
                )
              }
              return false
            },
          },
        },
      }),
    ]
  },
})
