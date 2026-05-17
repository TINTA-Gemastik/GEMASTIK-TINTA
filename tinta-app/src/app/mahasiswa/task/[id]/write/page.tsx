'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TintaEditor, type TintaEditorHandle, type PasteItem } from '@/components/editor/TintaEditor'
import { AnalyticsSidebar } from '@/components/editor/AnalyticsSidebar'
import { NotificationPopover } from '@/components/ui/notification-popover'
import type { Task, TintaEventInsert } from '@/types'

export default function WritePage() {
  const params  = useParams()
  const router  = useRouter()
  const taskId  = params.id as string

  const [userId,     setUserId]     = useState<string | null>(null)
  const [task,       setTask]       = useState<Task | null>(null)
  const [taskLoaded, setTaskLoaded] = useState(false)
  const [closing,    setClosing]    = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Live event stream for analytics sidebar
  const [liveEvents,       setLiveEvents]       = useState<TintaEventInsert[]>([])
  const [sessionStartedAt]                      = useState(() => Date.now())
  const [sessionNumber]                         = useState(1)
  const [currentDocLength, setCurrentDocLength] = useState(0)
  const [pasteItems,       setPasteItems]       = useState<PasteItem[]>([])
  const [selectedText,     setSelectedText]     = useState('')

  const editorRef = useRef<TintaEditorHandle>(null)

  const handleEventEmitted = useCallback((event: TintaEventInsert) => {
    setLiveEvents(prev => [...prev, event])
  }, [])

  const handleDocLengthChange = useCallback((len: number) => {
    setCurrentDocLength(len)
  }, [])

  const handlePasteItemCreated = useCallback((item: PasteItem) => {
    setPasteItems(prev => [...prev, item])
  }, [])

  const handlePasteUpdated = useCallback(async (id: string, updates: Record<string, unknown>) => {
    setPasteItems(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.from('paste_events').update(updates).eq('id', id)
  }, [])

  const handleSelectionChange = useCallback((text: string) => {
    setSelectedText(text)
  }, [])

  const handleScanText = useCallback(async (_text: string): Promise<number> => {
    // MVP mock: estimate from paste ratio
    const pasteChars = pasteItems.reduce((s, p) => s + p.pasted_char_count, 0)
    const ratio = pasteChars / Math.max(currentDocLength, 1)
    return Math.min(0.95, ratio * 1.2 + Math.random() * 0.08)
  }, [pasteItems, currentDocLength])

  const handleHighlightAISentences = useCallback((enabled: boolean) => {
    const editorEl = document.querySelector('.ProseMirror')
    if (enabled) editorEl?.classList.add('show-ai-highlights')
    else         editorEl?.classList.remove('show-ai-highlights')
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('tasks')
        .select('id, dosen_id, title, description, deadline, min_sessions, max_paste_ratio, allow_paste, created_at')
        .eq('id', taskId)
        .single()

      if (!data) {
        router.push('/mahasiswa/dashboard')
        return
      }

      setTask(data as Task)
      setTaskLoaded(true)
    }

    init()
  }, [taskId, router])

  const handleClose = async () => {
    if (closing) return
    setClosing(true)
    try { await editorRef.current?.close() } catch {}
    router.push('/mahasiswa/dashboard')
  }

  const handleSubmitConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      // Flush + close session first
      await editorRef.current?.close()

      const finalDocText = editorRef.current?.getText() ?? ''

      const res = await fetch('/api/submissions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ task_id: taskId, final_doc_text: finalDocText }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Submission failed')
      }

      const { submission_id } = await res.json()
      router.push(`/mahasiswa/submissions/${submission_id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error')
      setSubmitting(false)
    }
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f0f0] text-[#B9B6AD] text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-14 flex items-center justify-between gap-4 px-6 bg-white border-b border-[#B9B6AD]/30 sticky top-0 z-20">

        {/* Left — task title + deadline */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {!taskLoaded ? (
            <div className="h-4 w-52 bg-[#B9B6AD]/25 rounded animate-pulse" />
          ) : (
            <>
              <h1 className="text-sm font-medium text-[#111111] truncate">
                {task!.title}
              </h1>
              {task!.deadline && (
                <span className="text-xs text-[#B9B6AD] whitespace-nowrap hidden sm:block">
                  Due:{' '}
                  {format(new Date(task!.deadline), 'dd MMM yyyy, HH:mm')}
                </span>
              )}
            </>
          )}
        </div>

        {/* Right — notifications + submit + save & close */}
        <div className="flex items-center gap-2 shrink-0">
          <NotificationPopover />
          <button
            onClick={() => setShowSubmit(true)}
            disabled={closing || submitting}
            className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white px-4 py-2 rounded-xl transition-all disabled:opacity-60 whitespace-nowrap"
          >
            <Send size={14} />
            Submit Assignment
          </button>
          <button
            onClick={handleClose}
            disabled={closing || submitting}
            className="text-sm bg-[#2D4E71] hover:bg-[#213a56] active:scale-[0.98] text-white px-4 py-2 rounded-xl transition-all disabled:opacity-60 whitespace-nowrap"
          >
            {closing ? 'Saving…' : 'Save & Close'}
          </button>
        </div>
      </header>

      {/* ── Editor ──────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        <TintaEditor
          ref={editorRef}
          taskId={taskId}
          userId={userId}
          onEventEmitted={handleEventEmitted}
          onDocLengthChange={handleDocLengthChange}
          onPasteItemCreated={handlePasteItemCreated}
          onSelectionChange={handleSelectionChange}
        />
      </main>

      {/* ── Analytics sidebar (fixed overlay, always on top) ─────────────── */}
      <AnalyticsSidebar
        events={liveEvents}
        pasteItems={pasteItems}
        sessionStartedAt={sessionStartedAt}
        sessionNumber={sessionNumber}
        initialDocLength={0}
        currentDocLength={currentDocLength}
        selectedText={selectedText}
        onPasteUpdated={handlePasteUpdated}
        onScanText={handleScanText}
        onHighlightAISentences={handleHighlightAISentences}
      />

      {/* ── Submit confirmation modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showSubmit && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
              onClick={() => !submitting && setShowSubmit(false)}
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-[#B9B6AD]/15 overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-6 pt-6 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle size={17} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#111111]">Submit Assignment?</p>
                      <p className="text-xs text-[#B9B6AD] mt-1 leading-relaxed">
                        You cannot edit your writing after submitting. Your session data and
                        writing analytics will be finalized.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error message */}
                {submitError && (
                  <div className="mx-6 mb-3 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs text-red-700">{submitError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                  <button
                    onClick={() => setShowSubmit(false)}
                    disabled={submitting}
                    className="flex-1 text-sm font-medium bg-[#F8F7F5] hover:bg-[#EDECE9] text-[#111111] px-4 py-2.5 rounded-xl border border-[#B9B6AD]/20 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSubmitConfirm}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Yes, Submit
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}
