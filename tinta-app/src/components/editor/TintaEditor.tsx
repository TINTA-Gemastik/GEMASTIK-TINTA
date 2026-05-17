'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Image from '@tiptap/extension-image'
import { Extension } from '@tiptap/core'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import { EditorToolbar }       from './EditorToolbar'
import { PasteModal }          from './PasteModal'
import { ReferencePopover }    from './ReferencePopover'
import { ReferenceAlert }      from './ReferenceAlert'
import { PageBreakIndicators } from './PageBreakIndicators'
import { PageLayoutSettings, DEFAULT_LAYOUT, type LayoutSettings } from './PageLayoutSettings'
import { EditorContextMenu }   from './EditorContextMenu'
import { TintaRecorder }    from './TintaRecorder'
import { BehaviorTracker }  from './BehaviorTracker'
import { eventSender }      from '@/lib/supabase/eventSender'
import { createSession, closeSession } from '@/lib/supabase/sessionManager'
import { createClient }     from '@/lib/supabase/client'
import { classifyPaste }    from '@/lib/signals/pasteClassifier'
import { detectUnconfirmedFacts } from '@/lib/signals/referenceDetector'
import type { TintaEventInsert, EventPayloadPaste } from '@/types'

// ─── FontSize global attribute extension ─────────────────────────────────────

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default:    null,
          parseHTML:  el => (el as HTMLElement).style.fontSize || null,
          renderHTML: attrs => {
            if (!attrs.fontSize) return {}
            return { style: `font-size: ${attrs.fontSize}` }
          },
        },
      },
    }]
  },
})

// ─── Tab indentation extension ────────────────────────────────────────────────

const TabIndent = Extension.create({
  name: 'tabIndent',
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.chain().focus().insertContent('    ').run(),
    }
  },
})

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PasteItem {
  id:               string
  pasted_text:      string
  pasted_char_count: number
  declared_type:    string | null
  source_title:     string | null
  source_author:    string | null
  source_url:       string | null
  source_year:      string | null
  timestamp:        number
  cursor_position?: number
  is_deleted?:      boolean
}

export interface TintaEditorHandle {
  close:   (opts?: { initialText?: string; currentText?: string }) => Promise<void>
  getText: () => string
  getHTML: () => string
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TintaEditorProps {
  taskId:                string
  userId:                string
  initialContent?:       string
  onEventEmitted?:       (event: TintaEventInsert) => void
  onDocLengthChange?:    (len: number) => void
  onTextChange?:         (text: string) => void
  onPasteItemCreated?:   (item: PasteItem) => void
  onPasteItemUpdated?:   (id: string, updates: Partial<PasteItem>) => void
  onSelectionChange?:    (text: string) => void
  onPasteMaybeDeleted?:  (cursorPos: number, deletedCount: number) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner — only mounted once sessionId is known.
// ─────────────────────────────────────────────────────────────────────────────

interface InnerProps extends TintaEditorProps {
  sessionId: string
}

const TintaEditorInner = forwardRef<TintaEditorHandle, InnerProps>(
  ({ sessionId, taskId, userId, initialContent = '', onEventEmitted, onDocLengthChange, onTextChange, onPasteItemCreated, onPasteItemUpdated, onSelectionChange, onPasteMaybeDeleted }, ref) => {

    // ── Core recording state ────────────────────────────────────────────────
    const startedAtRef  = useRef(Date.now())
    const eventsRef     = useRef<TintaEventInsert[]>([])
    const behaviorRef   = useRef<BehaviorTracker | null>(null)
    const isClosingRef  = useRef(false)
    const contentDivRef = useRef<HTMLDivElement>(null)

    // ── Layout settings ─────────────────────────────────────────────────────
    const [layout, setLayout] = useState<LayoutSettings>(DEFAULT_LAYOUT)

    // ── Paste modal state ───────────────────────────────────────────────────
    const [pendingPaste, setPendingPaste] = useState<{ text: string; recordId: string } | null>(null)

    // ── Context menu + reference popover ────────────────────────────────────
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selectedText: string } | null>(null)
    const [referencePopover, setReferencePopover] = useState<{ text: string; top: number; left: number } | null>(null)

    // ── Reference alert ─────────────────────────────────────────────────────
    const [unconfirmedCount, setUnconfirmedCount] = useState(0)

    // ── Paste event handler ─────────────────────────────────────────────────
    const handlePaste = useCallback(
      async (event: TintaEventInsert) => {
        const payload    = event.payload as unknown as EventPayloadPaste
        const pastedText = payload?.pasted_text ?? ''
        if (!pastedText) return

        const { autoClassified, type } = classifyPaste(pastedText)

        const supabase = createClient()
        const { data: rec } = await supabase
          .from('paste_events')
          .insert({
            session_id:        sessionId,
            student_id:        userId,
            task_id:           taskId,
            pasted_text:       pastedText,
            pasted_char_count: pastedText.length,
            declared_type:     autoClassified ? type : null,
            auto_classified:   autoClassified,
            timestamp:         event.timestamp,
          })
          .select('id')
          .single()

        if (rec?.id) {
          const item: PasteItem = {
            id:                rec.id,
            pasted_text:       pastedText,
            pasted_char_count: pastedText.length,
            declared_type:     autoClassified ? type : null,
            source_title:      null,
            source_author:     null,
            source_url:        null,
            source_year:       null,
            timestamp:         event.timestamp,
            cursor_position:   event.cursor_position ?? undefined,
            is_deleted:        false,
          }
          onPasteItemCreated?.(item)

          if (!autoClassified) {
            setPendingPaste({ text: pastedText, recordId: rec.id })
          }
        }
      },
      [sessionId, userId, taskId, onPasteItemCreated]
    )

    // ── Main event handler ──────────────────────────────────────────────────
    const handleEvent = useCallback(
      (event: TintaEventInsert) => {
        eventsRef.current.push(event)
        eventSender.enqueue(event)
        behaviorRef.current?.resetIdleTimer()
        onEventEmitted?.(event)

        if (event.event_type === 'paste') void handlePaste(event)

        if (event.event_type === 'delete') {
          const p = event.payload as Record<string, number>
          onPasteMaybeDeleted?.(event.cursor_position ?? 0, p.deleted_char_count ?? 0)
        }
      },
      [handlePaste, onEventEmitted, onPasteMaybeDeleted]
    )

    // ── TipTap editor ───────────────────────────────────────────────────────
    const editor = useEditor({
      extensions: [
        StarterKit,
        TextStyle,
        FontSize,
        Color,
        FontFamily,
        Highlight.configure({ multicolor: true }),
        Underline,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Subscript,
        Superscript,
        Image.configure({ inline: false, allowBase64: true }),
        TabIndent,
        Placeholder.configure({ placeholder: 'Mulai menulis di sini… / Start writing here…' }),
        CharacterCount,
        TintaRecorder.configure({ sessionId, userId, taskId, onEvent: handleEvent }),
      ],
      content: initialContent,
      editorProps: {
        attributes: {
          class:       'focus:outline-none',
          lang:        'id',
          spellcheck:  'false',
          autocorrect: 'off',
          autocomplete: 'off',
        },
      },
      onUpdate: ({ editor: ed }) => {
        const text  = ed.getText()
        setUnconfirmedCount(detectUnconfirmedFacts(text).length)
        const len = (ed.storage.characterCount?.characters() as number | undefined) ?? text.length
        onDocLengthChange?.(len)
        onTextChange?.(text)
      },
    })

    // ── Image paste from clipboard ──────────────────────────────────────────
    useEffect(() => {
      if (!editor) return
      const onImagePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items
        if (!items) return
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            e.preventDefault()
            const file = item.getAsFile()
            if (!file) continue
            const reader = new FileReader()
            reader.onload = ev => {
              const src = ev.target?.result as string
              editor.chain().focus().setImage({ src }).run()
            }
            reader.readAsDataURL(file)
          }
        }
      }
      const el = document.querySelector('.ProseMirror')
      el?.addEventListener('paste', onImagePaste as EventListener)
      return () => el?.removeEventListener('paste', onImagePaste as EventListener)
    }, [editor])

    // ── Selection change → notify parent ───────────────────────────────────
    const onSelectionChangeRef = useRef(onSelectionChange)
    onSelectionChangeRef.current = onSelectionChange

    useEffect(() => {
      if (!editor) return
      const handler = () => {
        const { from, to } = editor.state.selection
        const text = from === to ? '' : editor.state.doc.textBetween(from, to, ' ')
        onSelectionChangeRef.current?.(text)
      }
      editor.on('selectionUpdate', handler)
      return () => { editor.off('selectionUpdate', handler) }
    }, [editor])

    // ── Bootstrap behavior tracking ─────────────────────────────────────────
    useEffect(() => {
      behaviorRef.current = new BehaviorTracker({ sessionId, userId, taskId, onEvent: handleEvent })
      eventSender.start()
      const onBeforeUnload = () => eventSender.sendBeaconFlush()
      window.addEventListener('beforeunload', onBeforeUnload)
      return () => {
        window.removeEventListener('beforeunload', onBeforeUnload)
        behaviorRef.current?.destroy()
        eventSender.stop()
      }
    }, [sessionId, userId, taskId, handleEvent])

    // ── Expose close() ──────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      close: async (opts?: { initialText?: string; currentText?: string }) => {
        if (isClosingRef.current) return
        isClosingRef.current = true
        await eventSender.flush()
        await closeSession(sessionId, eventsRef.current, startedAtRef.current, opts?.initialText, opts?.currentText)
      },
      getText: () => editor?.getText() ?? '',
      getHTML: () => editor?.getHTML() ?? '',
    }))

    // Load draft content if initialContent arrives after editor mounts (async timing)
    useEffect(() => {
      if (editor && initialContent && editor.isEmpty) {
        editor.commands.setContent(initialContent, { emitUpdate: false })
      }
    }, [editor, initialContent])

    // ── Paste modal handlers ────────────────────────────────────────────────
    const onDeclarePaste = useCallback(
      async (
        pasteEventId: string,
        declaredType: string,
        sourceData?: import('./PasteModal').PasteSourceData
      ) => {
        setPendingPaste(null)
        const supabase = createClient()
        const update: Record<string, unknown> = { declared_type: declaredType }
        if (sourceData) {
          update.source_title  = sourceData.title  || null
          update.source_author = sourceData.author || null
          update.source_url    = sourceData.url    || null
        }
        await supabase.from('paste_events').update(update).eq('id', pasteEventId)
        onPasteItemUpdated?.(pasteEventId, {
          declared_type: declaredType,
          source_title:  sourceData?.title  || null,
          source_author: sourceData?.author || null,
          source_url:    sourceData?.url    || null,
        })
      },
      [onPasteItemUpdated]
    )

    const onDismissPaste = useCallback(() => setPendingPaste(null), [])

    // ── Reference save handler ──────────────────────────────────────────────
    const onSaveReference = useCallback(
      async (source: import('./ReferencePopover').ReferenceSourceData) => {
        const snapshot = referencePopover
        setReferencePopover(null)
        if (!snapshot) return
        const supabase = createClient()
        await supabase.from('document_references').insert({
          submission_id:    null,
          student_id:       userId,
          sentence_text:    snapshot.text,
          source_title:     source.title  || null,
          source_author:    source.author || null,
          source_url:       source.url    || null,
          is_paste_derived: false,
          confirmed:        true,
        })
      },
      [referencePopover, userId]
    )

    // ── Reference alert scroll action ───────────────────────────────────────
    const onAlertAction = useCallback(() => {
      if (!editor) return
      const facts = detectUnconfirmedFacts(editor.getText())
      if (!facts[0]) return
      const idx = editor.getText().indexOf(facts[0].slice(0, 20))
      if (idx >= 0) {
        editor.commands.focus()
        editor.commands.setTextSelection(idx + 1)
      }
    }, [editor])

    // ── Render ──────────────────────────────────────────────────────────────
    const charCount = (editor?.storage.characterCount?.characters() as number | undefined) ?? 0

    return (
      <div className="flex flex-col h-full">

        {/* Reference alert banner */}
        <ReferenceAlert count={unconfirmedCount} onAction={onAlertAction} />

        {/* Toolbar */}
        <div className="shrink-0">
          <EditorToolbar editor={editor ?? null} />
        </div>

        {/* Layout settings strip */}
        <PageLayoutSettings layout={layout} onChange={setLayout} />

        {/* Canvas — Word-style paged layout */}
        <div className="editor-canvas flex-1 overflow-y-auto bg-[#e8e8e8]">
          <div style={{ zoom: layout.zoom }}>
            <div className="py-10 px-4">
              <div
                className="editor-page bg-white mx-auto shadow-[0_2px_8px_rgba(0,0,0,0.15)] relative"
                style={{
                  width:     `${layout.paperWidth}px`,
                  minHeight: `${layout.paperHeight}px`,
                  padding:   `${layout.marginPx}px`,
                  marginBottom: '32px',
                }}
                onContextMenu={e => {
                  e.preventDefault()
                  const sel = editor?.state.selection
                  const selectedText = sel
                    ? editor?.state.doc.textBetween(sel.from, sel.to, ' ') ?? ''
                    : ''
                  setContextMenu({ x: e.clientX, y: e.clientY, selectedText })
                }}
              >
                <PageBreakIndicators editorRef={contentDivRef} />
                <div ref={contentDivRef} lang="id" spellCheck={false}>
                  <EditorContent editor={editor} />
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-[#B9B6AD]">
                  1
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Character count footer */}
        <div className="editor-bottom-bar shrink-0 border-t border-[#B9B6AD]/30 bg-white px-6 py-2 flex items-center text-xs text-[#B9B6AD]">
          {charCount.toLocaleString()} characters
        </div>

        {/* Paste declaration modal */}
        {pendingPaste && (
          <PasteModal
            pastedText={pendingPaste.text}
            pasteEventId={pendingPaste.recordId}
            onDeclare={onDeclarePaste}
            onDismiss={onDismissPaste}
          />
        )}

        {/* Right-click context menu */}
        {contextMenu && (
          <EditorContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            selectedText={contextMenu.selectedText}
            editor={editor}
            onClose={() => setContextMenu(null)}
            onAddReference={text => {
              setContextMenu(null)
              setReferencePopover({ text, top: contextMenu.y, left: contextMenu.x })
            }}
          />
        )}

        {/* Reference popover (triggered from context menu) */}
        {referencePopover && (
          <ReferencePopover
            sentenceText={referencePopover.text}
            position={{ top: referencePopover.top, left: referencePopover.left }}
            onSave={onSaveReference}
            onDismiss={() => setReferencePopover(null)}
          />
        )}

      </div>
    )
  }
)
TintaEditorInner.displayName = 'TintaEditorInner'

// ─────────────────────────────────────────────────────────────────────────────
// Outer — async session creation gate.
// ─────────────────────────────────────────────────────────────────────────────

export const TintaEditor = forwardRef<TintaEditorHandle, TintaEditorProps>(
  ({ taskId, userId, initialContent = '', onEventEmitted, onDocLengthChange, onTextChange, onPasteItemCreated, onPasteItemUpdated, onSelectionChange, onPasteMaybeDeleted }, ref) => {
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [error,     setError]     = useState<string | null>(null)

    const innerRef = useRef<TintaEditorHandle>(null)
    useImperativeHandle(ref, () => ({
      close:   async (opts?) => { await innerRef.current?.close(opts) },
      getText: ()      => innerRef.current?.getText() ?? '',
      getHTML: ()      => innerRef.current?.getHTML() ?? '',
    }))

    useEffect(() => {
      createSession(taskId, userId)
        .then(setSessionId)
        .catch(err => setError(err.message))
    }, [taskId, userId])

    // Beacon session close when tab is closed without Save & Close
    useEffect(() => {
      if (!sessionId) return
      const handleBeforeUnload = () => {
        navigator.sendBeacon(
          '/api/sessions/close',
          JSON.stringify({ session_id: sessionId, ended_at: new Date().toISOString() })
        )
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [sessionId])

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-[#c0392b]">
          Failed to start session: {error}
        </div>
      )
    }

    if (!sessionId) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-[#B9B6AD] gap-2">
          <span className="w-2 h-2 rounded-full bg-[#B9B6AD] animate-pulse" />
          Starting recording session…
        </div>
      )
    }

    return (
      <TintaEditorInner
        ref={innerRef}
        sessionId={sessionId}
        taskId={taskId}
        userId={userId}
        initialContent={initialContent}
        onEventEmitted={onEventEmitted}
        onDocLengthChange={onDocLengthChange}
        onTextChange={onTextChange}
        onPasteItemCreated={onPasteItemCreated}
        onPasteItemUpdated={onPasteItemUpdated}
        onSelectionChange={onSelectionChange}
        onPasteMaybeDeleted={onPasteMaybeDeleted}
      />
    )
  }
)
TintaEditor.displayName = 'TintaEditor'
