'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Play, Pause, RotateCcw, Layers, FileText, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { reconstructAtTimestamp, buildDocumentTimeline } from '@/lib/replay/reconstructor'
import { analyzeSentences }  from '@/lib/replay/sentenceAnalyzer'
import {
  computePresetSpeeds, computeWatchInSeconds,
  estimateRealDuration, formatDuration,
} from '@/lib/replay/speedCalculator'
import { TimelineGraph }   from '@/components/replay/TimelineGraph'
import { SentenceHeatmap } from '@/components/replay/SentenceHeatmap'
import type { TintaEvent, Session, PasteEvent, Task } from '@/types'

const TICK_MS   = 100   // real-time interval between playback ticks
const ALL_SPEEDS = computePresetSpeeds()

// ─── Paste status chip ────────────────────────────────────────────────────────

function PasteChip({ declared }: { declared: string | null }) {
  if (!declared) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Undeclared</span>
  if (declared === 'citation') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">Citation</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Own text</span>
}

// ─── Main replay page ─────────────────────────────────────────────────────────

export default function ReplayPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  // ── Data state ──────────────────────────────────────────────────────────────
  const [task,        setTask]        = useState<Task | null>(null)
  const [events,      setEvents]      = useState<TintaEvent[]>([])
  const [sessions,    setSessions]    = useState<Session[]>([])
  const [pasteEvents, setPasteEvents] = useState<PasteEvent[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  // ── Playback state ──────────────────────────────────────────────────────────
  const [currentTimestamp, setCurrentTimestamp] = useState(0)
  const [isPlaying,        setIsPlaying]        = useState(false)
  const [speedIdx,         setSpeedIdx]         = useState(2)   // default 5×
  const [showHeatmap,      setShowHeatmap]       = useState(false)
  const [activeSessionId,  setActiveSessionId]   = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Derived timeline data ───────────────────────────────────────────────────
  const timeline = useMemo(
    () => buildDocumentTimeline(events, sessions),
    [events, sessions]
  )

  const firstTs = useMemo(() => events.length ? Math.min(...events.map(e => e.timestamp)) : 0, [events])
  const lastTs  = useMemo(() => events.length ? Math.max(...events.map(e => e.timestamp)) : 0, [events])
  const totalMs = lastTs - firstTs

  // Available speeds including "Watch in 60s"
  const speeds = useMemo(() => {
    const extras = totalMs > 0
      ? [computeWatchInSeconds(totalMs, 60), computeWatchInSeconds(totalMs, 30)]
      : []
    return [...ALL_SPEEDS, ...extras]
  }, [totalMs])

  const speed = speeds[Math.min(speedIdx, speeds.length - 1)]

  // ── Reconstructed document at currentTimestamp ──────────────────────────────
  const docText = useMemo(
    () => reconstructAtTimestamp(events, currentTimestamp),
    [events, currentTimestamp]
  )

  // Final document (for heatmap and sentence analysis)
  const finalDocText = useMemo(
    () => reconstructAtTimestamp(events, lastTs),
    [events, lastTs]
  )

  const sentences = useMemo(
    () => analyzeSentences(events, finalDocText),
    [events, finalDocText]
  )

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [
        { data: taskData },
        { data: eventsData, error: evErr },
        { data: sessData },
        { data: pasteData },
      ] = await Promise.all([
        supabase.from('tasks').select('*').eq('id', taskId).single(),
        supabase
          .from('events')
          .select('*')
          .eq('task_id', taskId)
          .eq('user_id', user.id)
          .order('timestamp', { ascending: true }),
        supabase
          .from('sessions')
          .select('*')
          .eq('task_id', taskId)
          .eq('user_id', user.id)
          .order('started_at', { ascending: true }),
        supabase
          .from('paste_events')
          .select('*')
          .eq('task_id', taskId)
          .eq('student_id', user.id)
          .order('timestamp', { ascending: true }),
      ])

      if (evErr) { setError('Failed to load events.'); setLoading(false); return }

      setTask(taskData as Task)
      setEvents((eventsData ?? []) as TintaEvent[])
      setSessions((sessData  ?? []) as Session[])
      setPasteEvents((pasteData ?? []) as PasteEvent[])

      // Start at the first event
      const first = eventsData?.[0]?.timestamp as number | undefined
      if (first) setCurrentTimestamp(first)

      setLoading(false)
    }

    load()
  }, [taskId, router])

  // ── Playback interval ───────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setIsPlaying(false)
  }, [])

  const startPlayback = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setCurrentTimestamp(prev => {
        const next = prev + speed.msPerTick
        if (next >= lastTs) { stopPlayback(); return lastTs }
        return next
      })
    }, TICK_MS)
    setIsPlaying(true)
  }, [speed.msPerTick, lastTs, stopPlayback])

  // Restart interval when speed changes while playing
  useEffect(() => {
    if (isPlaying) startPlayback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed.msPerTick])

  // Cleanup on unmount
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  const handlePlayPause = () => {
    if (isPlaying) stopPlayback()
    else {
      if (currentTimestamp >= lastTs) setCurrentTimestamp(firstTs)
      startPlayback()
    }
  }

  const handleRestart = () => {
    stopPlayback()
    setCurrentTimestamp(firstTs)
  }

  const handleSeek = (ts: number) => {
    setCurrentTimestamp(Math.max(firstTs, Math.min(lastTs, ts)))
  }

  // Progress 0–1
  const progress = totalMs > 0 ? (currentTimestamp - firstTs) / totalMs : 0

  // Current display time
  const currentTime = currentTimestamp > 0
    ? format(new Date(currentTimestamp), 'HH:mm:ss')
    : '--:--:--'

  // Elapsed recording time
  const elapsedMs = currentTimestamp - firstTs

  // ── Filtered timeline for active session ─────────────────────────────────────
  const filteredTimeline = useMemo(
    () => activeSessionId
      ? timeline.filter(p => p.sessionId === activeSessionId)
      : timeline,
    [timeline, activeSessionId]
  )

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F8F7F5] text-[#B9B6AD] text-sm gap-2">
        <span className="w-2 h-2 rounded-full bg-[#B9B6AD] animate-pulse" />
        Loading replay…
      </div>
    )
  }

  if (error || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#F8F7F5] gap-4">
        <p className="text-sm text-[#B9B6AD]">
          {error ?? 'No recorded events found for this task.'}
        </p>
        <button
          onClick={() => router.back()}
          className="text-sm text-[#2D4E71] hover:underline"
        >
          ← Go back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#F8F7F5] overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-14 flex items-center gap-4 px-5 bg-white border-b border-[#B9B6AD]/20">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-[#B9B6AD] hover:text-[#111111] transition-colors shrink-0"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <div className="w-px h-5 bg-[#B9B6AD]/30" />

        {/* Task title */}
        <p className="text-sm font-semibold text-[#111111] truncate flex-1 min-w-0">
          {task?.title ?? 'Replay'}
        </p>

        {/* Session pills */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setActiveSessionId(null)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              activeSessionId === null
                ? 'bg-[#2D4E71] text-white border-[#2D4E71]'
                : 'bg-white text-[#B9B6AD] border-[#B9B6AD]/30 hover:border-[#2D4E71]/50'
            }`}
          >
            All sessions
          </button>
          {sessions.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSessionId(s.id)
                // Seek to session start
                const firstSessionEvent = events.find(e => e.session_id === s.id)
                if (firstSessionEvent) handleSeek(firstSessionEvent.timestamp)
              }}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                activeSessionId === s.id
                  ? 'bg-[#2D4E71] text-white border-[#2D4E71]'
                  : 'bg-white text-[#B9B6AD] border-[#B9B6AD]/30 hover:border-[#2D4E71]/50'
              }`}
            >
              Session {i + 1}
            </button>
          ))}
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRestart}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#B9B6AD] hover:text-[#111111] hover:bg-[#F8F7F5] transition-colors"
            title="Restart"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handlePlayPause}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2D4E71] text-white hover:bg-[#1e3a56] transition-colors"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          {/* Speed selector */}
          <div className="flex items-center gap-1">
            {speeds.map((s, i) => (
              <button
                key={s.label}
                onClick={() => setSpeedIdx(i)}
                className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                  i === speedIdx
                    ? 'bg-[#2D4E71] text-white'
                    : 'text-[#B9B6AD] hover:text-[#111111] hover:bg-[#F8F7F5]'
                }`}
                title={estimateRealDuration(s, totalMs)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Time display */}
          <span className="text-[11px] font-mono text-[#B9B6AD] w-20 text-right">
            {formatDuration(elapsedMs)} / {formatDuration(totalMs)}
          </span>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 ml-2 bg-[#F8F7F5] rounded-lg p-1 shrink-0">
          <button
            onClick={() => setShowHeatmap(false)}
            title="Document view"
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              !showHeatmap ? 'bg-white shadow-sm text-[#2D4E71]' : 'text-[#B9B6AD] hover:text-[#111111]'
            }`}
          >
            <FileText size={13} />
          </button>
          <button
            onClick={() => setShowHeatmap(true)}
            title="Sentence heatmap"
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              showHeatmap ? 'bg-white shadow-sm text-[#2D4E71]' : 'text-[#B9B6AD] hover:text-[#111111]'
            }`}
          >
            <Layers size={13} />
          </button>
        </div>
      </header>

      {/* ── Progress bar ─────────────────────────────────────────────────────── */}
      <div className="h-0.5 bg-[#B9B6AD]/20 shrink-0">
        <div
          className="h-full bg-[#2D4E71] transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* ── Main panels ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left — Document viewer */}
        <div className="flex-1 overflow-y-auto bg-[#e8e8e8]">
          <div className="py-10 px-4">
            <div
              className="bg-white mx-auto shadow-[0_2px_8px_rgba(0,0,0,0.12)] rounded-sm"
              style={{ width: '680px', minHeight: '960px', padding: '72px 80px', maxWidth: '100%' }}
            >
              {showHeatmap ? (
                <SentenceHeatmap sentences={sentences} />
              ) : (
                <div
                  className="text-sm leading-[1.8] text-[#111111] whitespace-pre-wrap font-[var(--font-dm-sans)] min-h-[800px]"
                  style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}
                >
                  {docText || (
                    <span className="text-[#B9B6AD] italic">
                      {currentTimestamp <= firstTs ? 'Press play to start the replay.' : ''}
                    </span>
                  )}
                  {/* Blinking cursor */}
                  {isPlaying && (
                    <span className="inline-block w-0.5 h-4 bg-[#2D4E71] align-middle animate-pulse ml-0.5" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — Analytics panel */}
        <aside className="w-72 shrink-0 border-l border-[#B9B6AD]/20 bg-white flex flex-col overflow-hidden">

          {/* Current time card */}
          <div className="p-4 border-b border-[#B9B6AD]/20">
            <p className="text-[10px] text-[#B9B6AD] uppercase tracking-widest mb-1">Recording Time</p>
            <p className="text-2xl font-mono font-bold text-[#111111]">{currentTime}</p>
            <p className="text-[11px] text-[#B9B6AD] mt-0.5">
              {Math.round((docText.split(/\s+/).filter(Boolean).length)) || 0} words at this point
            </p>
          </div>

          {/* Session list */}
          <div className="p-4 border-b border-[#B9B6AD]/20">
            <p className="text-[10px] text-[#B9B6AD] uppercase tracking-widest mb-2">Sessions</p>
            <div className="space-y-2">
              {sessions.map((s, i) => {
                const isActive = s.id === activeSessionId ||
                  (activeSessionId === null && events.find(e => e.session_id === s.id && e.timestamp <= currentTimestamp))
                const wordDelta = Math.round((s.line_insertions ?? 0))
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSessionId(s.id === activeSessionId ? null : s.id)
                      const firstSessionEvent = events.find(e => e.session_id === s.id)
                      if (firstSessionEvent) handleSeek(firstSessionEvent.timestamp)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${
                      isActive
                        ? 'border-[#2D4E71]/30 bg-[#2D4E71]/5'
                        : 'border-[#B9B6AD]/20 hover:border-[#2D4E71]/30'
                    }`}
                  >
                    <p className="text-[11px] font-semibold text-[#111111]">Session {i + 1}</p>
                    <p className="text-[10px] text-[#B9B6AD] mt-0.5">
                      {format(new Date(s.started_at), 'dd MMM, HH:mm')}
                      {s.ended_at && ` – ${format(new Date(s.ended_at), 'HH:mm')}`}
                    </p>
                    {wordDelta > 0 && (
                      <p className="text-[10px] font-mono text-emerald-600 mt-0.5">+{wordDelta} words</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Paste events */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-[10px] text-[#B9B6AD] uppercase tracking-widest mb-2">
              Paste Events ({pasteEvents.length})
            </p>
            {pasteEvents.length === 0 ? (
              <p className="text-xs text-[#B9B6AD] italic">No pastes recorded.</p>
            ) : (
              <div className="space-y-2">
                {pasteEvents.map(pe => {
                  const isPast = pe.timestamp <= currentTimestamp
                  return (
                    <button
                      key={pe.id}
                      onClick={() => handleSeek(pe.timestamp)}
                      className={`w-full text-left px-3 py-2 rounded-xl border transition-all ${
                        isPast
                          ? 'border-[#B9B6AD]/20 bg-[#F8F7F5]'
                          : 'border-[#B9B6AD]/10 opacity-40'
                      } hover:border-[#2D4E71]/40`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <PasteChip declared={pe.declared_type} />
                        <span className="text-[10px] text-[#B9B6AD] ml-auto">
                          {format(new Date(pe.timestamp), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#111111] line-clamp-2 leading-snug">
                        {pe.pasted_text.slice(0, 80)}{pe.pasted_text.length > 80 ? '…' : ''}
                      </p>
                      <p className="text-[10px] text-[#B9B6AD] mt-0.5">{pe.pasted_char_count} chars</p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Timeline scrub bar ────────────────────────────────────────────────── */}
      <TimelineGraph
        timeline={filteredTimeline}
        pasteEvents={pasteEvents}
        sessions={sessions}
        currentTimestamp={currentTimestamp}
        onSeek={handleSeek}
      />

    </div>
  )
}
