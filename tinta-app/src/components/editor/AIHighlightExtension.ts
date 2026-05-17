// AIHighlightExtension — applies inline ProseMirror decorations to
// sentences detected as potentially AI-assisted.
//
// Usage:
//   editor.commands.setAIHighlightRanges([{ from, to, level: 'high'|'low' }])
//   editor.commands.clearAIHighlightRanges()

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface AIHighlightRange {
  from:  number
  to:    number
  level: 'high' | 'low'
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiHighlight: {
      setAIHighlightRanges:   (ranges: AIHighlightRange[]) => ReturnType
      clearAIHighlightRanges: () => ReturnType
    }
  }
}

const aiHighlightKey = new PluginKey<DecorationSet>('aiHighlight')

export const AIHighlightExtension = Extension.create({
  name: 'aiHighlight',

  addCommands() {
    return {
      setAIHighlightRanges: (ranges: AIHighlightRange[]) => ({ state, dispatch }) => {
        if (!dispatch) return false
        const decorations = ranges.map(r =>
          Decoration.inline(r.from, r.to, {
            class: r.level === 'high' ? 'ai-sentence-high' : 'ai-sentence-low',
          })
        )
        const set = DecorationSet.create(state.doc, decorations)
        dispatch(state.tr.setMeta(aiHighlightKey, set))
        return true
      },

      clearAIHighlightRanges: () => ({ state, dispatch }) => {
        if (!dispatch) return false
        dispatch(state.tr.setMeta(aiHighlightKey, DecorationSet.empty))
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: aiHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(aiHighlightKey)
            if (meta !== undefined) return meta as DecorationSet
            // Remap when doc changes
            return old.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations: state => aiHighlightKey.getState(state) ?? DecorationSet.empty,
        },
      }),
    ]
  },
})
