'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { TintaEditor, type TintaEditorHandle, type PasteItem } from '@/components/editor/TintaEditor'
import { AnalyticsSidebar } from '@/components/editor/AnalyticsSidebar'
import { SubmitConfirmModal } from '@/components/editor/SubmitConfirmModal'
import { GlowButton } from '@/components/ui/glow-button'
import { ThemeToggle } from '@/components/ui/curtain-theme-toggle'
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

  const handlePasteItemUpdated = useCallback((id: string, updates: Partial<PasteItem>) => {
    setPasteItems(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
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

        {/* Right — theme toggle + notifications + submit + save & close */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <NotificationPopover />
          <GlowButton
            onClick={() => setShowSubmit(true)}
            disabled={closing || submitting}
            className="whitespace-nowrap"
          >
            Submit Assignment
          </GlowButton>
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
          onPasteItemUpdated={handlePasteItemUpdated}
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
          <SubmitConfirmModal
            wordCount={Math.floor(currentDocLength / 5.5)}
            sessionNumber={sessionNumber}
            undeclaredPastes={pasteItems.filter(p => !(p.declared_type && p.declared_type !== '')).length}
            submitting={submitting}
            error={submitError}
            onConfirm={handleSubmitConfirm}
            onCancel={() => !submitting && setShowSubmit(false)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
