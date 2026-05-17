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
import type { Task, TintaEventInsert, EventPayloadPaste, EventPayloadWindowHidden } from '@/types'
import { analyzeAdvancedPatterns, extractTypeNetFeatures } from '@/lib/signals/advancedPatternDetector'

export default function WritePage() {
  const params  = useParams()
  const router  = useRouter()
  const taskId  = params.id as string

  const [userId,         setUserId]         = useState<string | null>(null)
  const [userName,       setUserName]       = useState<string>('')
  const [task,           setTask]           = useState<Task | null>(null)
  const [taskLoaded,     setTaskLoaded]     = useState(false)
  const [closing,        setClosing]        = useState(false)
  const [showSubmit,     setShowSubmit]     = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [submitError,    setSubmitError]    = useState<string | null>(null)
  const [initialContent,  setInitialContent]  = useState<string>('')
  const [lastSavedAt,     setLastSavedAt]     = useState<Date | null>(null)
  const [initialDocText,  setInitialDocText]  = useState<string>('')
  const [currentDocText,  setCurrentDocText]  = useState<string>('')

  // Live event stream for analytics sidebar
  const [liveEvents,       setLiveEvents]       = useState<TintaEventInsert[]>([])
  const [sessionStartedAt]                      = useState(() => Date.now())
  const [sessionNumber]                         = useState(1)
  const [currentDocLength, setCurrentDocLength] = useState(0)
  const [pasteItems,       setPasteItems]       = useState<PasteItem[]>([])
  const [selectedText,     setSelectedText]     = useState('')

  const editorRef      = useRef<TintaEditorHandle>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Draft persistence ───────────────────────────────────────────────────────

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!userId) return false
    const contentHTML = editorRef.current?.getHTML() ?? ''
    const contentText = editorRef.current?.getText() ?? ''
    const wordCount   = Math.max(0, Math.round(contentText.trim().length / 5.5))

    const supabase = createClient()
    const { error } = await supabase
      .from('drafts')
      .upsert(
        {
          task_id:      taskId,
          student_id:   userId,
          content_html: contentHTML,
          content_text: contentText,
          word_count:   wordCount,
          saved_at:     new Date().toISOString(),
        },
        { onConflict: 'task_id,student_id' }
      )

    if (error) {
      console.error('Draft save failed:', error)
      return false
    }
    setLastSavedAt(new Date())
    return true
  }, [userId, taskId])

  // Debounced auto-save on content change (10 s)
  useEffect(() => {
    if (!userId) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => { void saveDraft() }, 10000)
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDocLength, userId])

  // Interval auto-save every 60 seconds
  useEffect(() => {
    if (!userId) return
    const id = setInterval(() => { void saveDraft() }, 60000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ── Event handlers ──────────────────────────────────────────────────────────

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
    const { createClient: mkClient } = await import('@/lib/supabase/client')
    const supabase = mkClient()
    await supabase.from('paste_events').update(updates).eq('id', id)
  }, [])

  const handleSelectionChange = useCallback((text: string) => {
    setSelectedText(text)
  }, [])

  // Step 3: mark paste items as deleted when their text is removed
  const handlePasteMaybeDeleted = useCallback((deleteCursorPos: number, deletedCount: number) => {
    setPasteItems(prev => prev.map(item => {
      if (item.is_deleted) return item
      const itemPos = item.cursor_position ?? 0
      const itemEnd = itemPos + item.pasted_char_count
      if (deleteCursorPos <= itemEnd && deleteCursorPos + deletedCount >= itemPos) {
        return { ...item, is_deleted: true }
      }
      return item
    }))
  }, [])

  // ── AI scan ─────────────────────────────────────────────────────────────────

  const handleScanText = useCallback(async (_text: string): Promise<{
    probability:     number
    breakdown?:      Record<string, number>
    confidence?:     string
    interpretation?: string
    flags?:          string[]
  }> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void _text;
    // Compute behavioral signals from live event stream
    const keystrokeEvents  = liveEvents.filter(e => e.event_type === 'keystroke' && !e.payload.is_delete_key)
    const windowHiddenEvts = liveEvents.filter(e => e.event_type === 'window_hidden')
    const pasteEvts        = liveEvents.filter(e => e.event_type === 'paste')

    const totalKeystrokes = keystrokeEvents.length
    const pastedChars     = pasteEvts.reduce(
      (s, e) => s + ((e.payload as unknown as EventPayloadPaste).pasted_char_count ?? 0), 0
    )

    const pasteRatio   = currentDocLength > 0 ? Math.min(pastedChars / currentDocLength, 1) : 0
    const organicRatio = currentDocLength > 0 ? Math.min(totalKeystrokes / currentDocLength, 1) : 1

    // IKI computation from sorted keystroke timestamps
    const sortedKS = [...keystrokeEvents].sort((a, b) => a.timestamp - b.timestamp)
    const ikis: number[] = []
    for (let i = 1; i < sortedKS.length; i++) {
      const gap = sortedKS[i].timestamp - sortedKS[i - 1].timestamp
      if (gap < 30000) ikis.push(gap)
    }

    let ikiCV = 0.8, ikiMean = 250
    if (ikis.length >= 20) {
      ikiMean = ikis.reduce((a, b) => a + b, 0) / ikis.length
      const variance = ikis.reduce((a, b) => a + Math.pow(b - ikiMean, 2), 0) / ikis.length
      ikiCV = ikiMean > 0 ? Math.sqrt(variance) / ikiMean : 0.8
    }

    // Count confirmed tab-switch → type burst patterns
    let burstPatternCount = 0
    for (const hiddenEvt of windowHiddenEvts) {
      const hiddenDuration =
        (hiddenEvt.payload as unknown as EventPayloadWindowHidden).duration_before_return_ms ?? 0
      if (hiddenDuration >= 15000 && hiddenDuration <= 300000) {
        const returnTime = hiddenEvt.timestamp + hiddenDuration
        const burstKS    = sortedKS.filter(
          k => k.timestamp >= returnTime && k.timestamp <= returnTime + 45000
        )
        if (burstKS.length >= 25) {
          const burstIKIs: number[] = []
          for (let j = 1; j < burstKS.length; j++) {
            const gap = burstKS[j].timestamp - burstKS[j - 1].timestamp
            if (gap < 5000) burstIKIs.push(gap)
          }
          if (burstIKIs.length >= 10) {
            const bMean = burstIKIs.reduce((a, b) => a + b, 0) / burstIKIs.length
            const bVar  = burstIKIs.reduce((a, b) => a + Math.pow(b - bMean, 2), 0) / burstIKIs.length
            const bCV   = bMean > 0 ? Math.sqrt(bVar) / bMean : 0.8
            if (bCV < 0.45 && bMean < 300) burstPatternCount++
          }
        }
      }
    }

    const sessionDurationMs = sortedKS.length > 1
      ? sortedKS[sortedKS.length - 1].timestamp - sortedKS[0].timestamp
      : 0

    // Advanced paragraph-level pattern analysis
    const advanced = analyzeAdvancedPatterns(liveEvents)

    // TypeNet-inspired feature extraction
    const typeNet = extractTypeNetFeatures(liveEvents)

    try {
      const res = await fetch('/api/scan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          pasteRatio, organicRatio, ikiCV, ikiMean,
          burstPatternCount,
          tabSwitchCount:             windowHiddenEvts.length,
          sessionDurationMs,          totalKeystrokes,
          burstRegularityScore:       advanced.burstRegularityScore,
          intraSegmentRevisionScore:  advanced.intraSegmentRevisionScore,
          pauseRegularityScore:       advanced.pauseRegularityScore,
          linearityScore:             advanced.linearityScore,
          tripletScore:               advanced.tripletScore,
          advancedConfidence:         advanced.confidence,
          advancedFlags:              advanced.flags,
          typeNetScore:               typeNet.typeNetScore,
          typeNetConfidence:          typeNet.confidence,
          errorCorrectionRatio:       typeNet.errorCorrectionRatio,
          speedWindowCV:              typeNet.speedWindowCV,
        }),
      })
      const data = await res.json()
      return {
        probability:    data.probability    ?? 0,
        breakdown:      data.breakdown,
        confidence:     data.confidence,
        interpretation: data.interpretation,
        flags:          advanced.flags,
      }
    } catch {
      return { probability: 0 }
    }
  }, [liveEvents, currentDocLength])

  const handleHighlightAISentences = useCallback((enabled: boolean) => {
    const editorEl = document.querySelector('.ProseMirror')
    if (enabled) editorEl?.classList.add('show-ai-highlights')
    else         editorEl?.classList.remove('show-ai-highlights')
  }, [])

  // ── Init: auth + task + draft load ──────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Derive first name from metadata or email
      const meta      = user.user_metadata as Record<string, string> | undefined
      const fullName  = meta?.full_name || meta?.name || ''
      const fromEmail = user.email?.split('@')[0]?.split('.')[0] ?? ''
      const raw       = fullName.split(' ')[0] || fromEmail
      setUserName(raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase())

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

      // Load saved draft content
      const { data: draft } = await supabase
        .from('drafts')
        .select('content_html, content_text, saved_at')
        .eq('task_id', taskId)
        .eq('student_id', user.id)
        .maybeSingle()

      if (draft?.content_html) setInitialContent(draft.content_html)
      if (draft?.content_text) setInitialDocText(draft.content_text)
      if (draft?.saved_at)     setLastSavedAt(new Date(draft.saved_at))

      setTaskLoaded(true)
    }

    init()
  }, [taskId, router])

  // ── Close + submit handlers ─────────────────────────────────────────────────

  const handleClose = async () => {
    if (closing) return
    setClosing(true)
    try {
      await editorRef.current?.close()
      await saveDraft()
    } catch {}
    router.push('/mahasiswa/dashboard')
  }

  const handleSubmitConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)

    try {
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

  const visiblePastes      = pasteItems.filter(p => !p.is_deleted)
  const undeclaredPasteCount = visiblePastes.filter(p => !(p.declared_type && p.declared_type !== '')).length

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="editor-topbar shrink-0 h-14 flex items-center justify-between gap-4 px-6 bg-white border-b border-[#B9B6AD]/30 sticky top-0 z-20">

        {/* Left — task title + deadline + last saved */}
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
              {lastSavedAt && (
                <span className="text-[11px] text-[#B9B6AD] hidden sm:inline">
                  · Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-all text-white whitespace-nowrap bg-[#2D4E71] hover:bg-[#1e3a56] hover:shadow-[0_0_12px_rgba(45,78,113,0.3)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait"
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
          initialContent={initialContent}
          onEventEmitted={handleEventEmitted}
          onDocLengthChange={handleDocLengthChange}
          onTextChange={setCurrentDocText}
          onPasteItemCreated={handlePasteItemCreated}
          onPasteItemUpdated={handlePasteItemUpdated}
          onSelectionChange={handleSelectionChange}
          onPasteMaybeDeleted={handlePasteMaybeDeleted}
        />
      </main>

      {/* ── Analytics sidebar (fixed overlay, always on top) ─────────────── */}
      <AnalyticsSidebar
        events={liveEvents}
        pasteItems={visiblePastes}
        sessionStartedAt={sessionStartedAt}
        sessionNumber={sessionNumber}
        initialDocLength={0}
        currentDocLength={currentDocLength}
        initialDocText={initialDocText}
        currentDocText={currentDocText}
        selectedText={selectedText}
        userName={userName}
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
            undeclaredPastes={undeclaredPasteCount}
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
