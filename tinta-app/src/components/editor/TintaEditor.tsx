'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import { TintaRecorder } from './TintaRecorder'
import { BehaviorTracker } from './BehaviorTracker'
import { eventSender } from '@/lib/supabase/eventSender'
import { createSession, closeSession } from '@/lib/supabase/sessionManager'
import type { TintaEventInsert } from '@/types'

// ─── Public handle (exposed via ref) ─────────────────────────────────────────

export interface TintaEditorHandle {
  /** Flush pending events and write session summary. Call before navigating away. */
  close: () => Promise<void>
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TintaEditorProps {
  taskId: string
  userId: string
  initialContent?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner — only mounted once sessionId is known, so TintaRecorder always has
// a real session_id from the first keystroke.
// ─────────────────────────────────────────────────────────────────────────────

interface InnerProps extends TintaEditorProps {
  sessionId: string
}

const TintaEditorInner = forwardRef<TintaEditorHandle, InnerProps>(
  ({ sessionId, taskId, userId, initialContent = '' }, ref) => {
    const startedAtRef      = useRef(Date.now())
    const eventsRef         = useRef<TintaEventInsert[]>([])
    const behaviorRef       = useRef<BehaviorTracker | null>(null)
    const isClosingRef      = useRef(false)

    // ── Event callback wired into both TintaRecorder and BehaviorTracker ───
    const handleEvent = useCallback((event: TintaEventInsert) => {
      eventsRef.current.push(event)
      eventSender.enqueue(event)
      behaviorRef.current?.resetIdleTimer()
    }, [])

    // ── TipTap editor ───────────────────────────────────────────────────────
    const editor = useEditor({
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: 'Mulai menulis di sini…' }),
        CharacterCount,
        TintaRecorder.configure({ sessionId, userId, taskId, onEvent: handleEvent }),
      ],
      content: initialContent,
      editorProps: {
        attributes: {
          class: 'focus:outline-none leading-relaxed text-tinta-dark text-[1.0625rem]',
        },
      },
    })

    // ── Bootstrap behavior tracking and event sender ────────────────────────
    useEffect(() => {
      behaviorRef.current = new BehaviorTracker({
        sessionId, userId, taskId, onEvent: handleEvent,
      })
      eventSender.start()

      const onBeforeUnload = () => eventSender.sendBeaconFlush()
      window.addEventListener('beforeunload', onBeforeUnload)

      return () => {
        window.removeEventListener('beforeunload', onBeforeUnload)
        behaviorRef.current?.destroy()
        eventSender.stop()
      }
    }, [sessionId, userId, taskId, handleEvent])

    // ── Expose close() to parent via ref ────────────────────────────────────
    useImperativeHandle(ref, () => ({
      close: async () => {
        if (isClosingRef.current) return
        isClosingRef.current = true
        await eventSender.flush()
        await closeSession(sessionId, eventsRef.current, startedAtRef.current)
      },
    }))

    const charCount = editor?.storage.characterCount?.characters() ?? 0

    return (
      <div className="relative flex flex-col h-full">
        {/* Non-dismissable recording badge — always visible */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-tinta-dark/90 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg select-none">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          Rekaman Aktif
        </div>

        {/* Editor scroll container */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-10 min-h-full">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Bottom bar — character count */}
        <div className="shrink-0 border-t border-tinta-border bg-white px-6 py-2 flex items-center text-xs text-tinta-warm">
          <span>{charCount.toLocaleString('id-ID')} karakter</span>
        </div>
      </div>
    )
  }
)
TintaEditorInner.displayName = 'TintaEditorInner'

// ─────────────────────────────────────────────────────────────────────────────
// Outer — handles async session creation, shows loading state, then renders
// TintaEditorInner once we have a real sessionId.
// ─────────────────────────────────────────────────────────────────────────────

export const TintaEditor = forwardRef<TintaEditorHandle, TintaEditorProps>(
  ({ taskId, userId, initialContent = '' }, ref) => {
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [error, setError]         = useState<string | null>(null)

    // Forward the ref through to the inner component
    const innerRef = useRef<TintaEditorHandle>(null)
    useImperativeHandle(ref, () => ({
      close: async () => { await innerRef.current?.close() },
    }))

    useEffect(() => {
      createSession(taskId, userId)
        .then(setSessionId)
        .catch(err => setError(err.message))
    }, [taskId, userId])

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-tinta-danger">
          Gagal memulai sesi: {error}
        </div>
      )
    }

    if (!sessionId) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-tinta-warm gap-2">
          <span className="w-2 h-2 rounded-full bg-tinta-warm animate-pulse" />
          Memulai sesi rekaman…
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
      />
    )
  }
)
TintaEditor.displayName = 'TintaEditor'
