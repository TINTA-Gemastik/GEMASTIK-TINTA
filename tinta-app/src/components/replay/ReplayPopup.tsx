'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, SkipBack, SkipForward, Play, Pause,
  ChevronLeft, ChevronRight, Layers
} from 'lucide-react'
import { reconstructAtTimestamp, buildDocumentTimeline, getReplayDurationMs } from '@/lib/replay/reconstructor'
import { analyzeSentences } from '@/lib/replay/sentenceAnalyzer'
import { computePresetSpeeds, computeWatchInSeconds, estimateRealDuration } from '@/lib/replay/speedCalculator'
import { TimelineGraph } from '@/components/replay/TimelineGraph'
import { SentenceHeatmap } from '@/components/replay/SentenceHeatmap'
import type { SpeedOption } from '@/lib/replay/speedCalculator'

interface ReplayPopupProps {
  isOpen:       boolean
  onClose:      () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events:       any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions:     any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pasteEvents:  any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  anomalyFlags: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  submission:   any
  studentName:  string
  taskTitle:    string
}

export const ReplayPopup: React.FC<ReplayPopupProps> = ({
  isOpen,
  onClose,
  events,
  sessions,
  pasteEvents,
  anomalyFlags,
  submission,
  studentName,
  taskTitle,
}) => {
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.timestamp - b.timestamp),
    [events]
  )

  const firstEventTimestamp = sortedEvents[0]?.timestamp ?? Date.now()
  const lastEventTimestamp  = sortedEvents[sortedEvents.length - 1]?.timestamp ?? Date.now()
  const totalDurationMs     = getReplayDurationMs(sortedEvents)

  const [currentTimestamp, setCurrentTimestamp] = useState(firstEventTimestamp)
  const [isPlaying,        setIsPlaying]        = useState(false)
  const [activeSpeed,      setActiveSpeed]      = useState<SpeedOption>(computePresetSpeeds()[0])
  const [showHeatmap,      setShowHeatmap]      = useState(false)
  const [activeSession,    setActiveSession]    = useState<string | null>(null)
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentTimestamp(firstEventTimestamp)
      setIsPlaying(false)
      setActiveSpeed(computePresetSpeeds()[0])
    }
  }, [isOpen, firstEventTimestamp])

  // Playback loop
  useEffect(() => {
    if (playIntervalRef.current) clearInterval(playIntervalRef.current)
    if (!isPlaying) return

    playIntervalRef.current = setInterval(() => {
      setCurrentTimestamp((prev: number) => {
        const next = prev + activeSpeed.msPerTick
        if (next >= lastEventTimestamp) {
          setIsPlaying(false)
          return lastEventTimestamp
        }
        return next
      })
    }, 100)

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
    }
  }, [isPlaying, activeSpeed, lastEventTimestamp])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p) }
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const reconstructedText = useMemo(
    () => reconstructAtTimestamp(sortedEvents, currentTimestamp),
    [sortedEvents, currentTimestamp]
  )

  const timeline = useMemo(
    () => buildDocumentTimeline(sortedEvents, sessions),
    [sortedEvents, sessions]
  )

  const sentences = useMemo(
    () => analyzeSentences(sortedEvents, submission?.final_doc_text || ''),
    [sortedEvents, submission]
  )

  const presetSpeeds = computePresetSpeeds()
  const watchIn60    = computeWatchInSeconds(totalDurationMs, 60)
  const watchIn30    = computeWatchInSeconds(totalDurationMs, 30)

  const progressPct = totalDurationMs > 0
    ? ((currentTimestamp - firstEventTimestamp) / totalDurationMs) * 100
    : 0

  const currentWordCount = Math.round(reconstructedText.length / 5.5)
  const currentEditCount = sortedEvents.filter(
    e => e.timestamp <= currentTimestamp && e.event_type === 'keystroke'
  ).length
  const currentPasteCount = pasteEvents.filter(p => p.timestamp <= currentTimestamp).length
  const currentMinutes    = Math.round((currentTimestamp - firstEventTimestamp) / 60000)
  const totalWordCount    = Math.round((submission?.final_doc_text?.length || 0) / 5.5)
  const totalEditCount    = sortedEvents.filter(e => e.event_type === 'keystroke').length
  const totalMinutes      = Math.round(totalDurationMs / 60000)

  // Gauge
  const gaugeScore = submission?.ai_likelihood_estimate ?? 0
  const gaugeLabel = gaugeScore < 0.2 ? 'Natural'
    : gaugeScore < 0.4 ? 'Mostly natural'
    : gaugeScore < 0.6 ? 'Less natural'
    : 'Unnatural'
  const gaugeAngle = -90 + (gaugeScore * 180)
  const gaugeRad   = (gaugeAngle * Math.PI) / 180
  const cx = 80, cy = 80, r = 55
  const needleX = cx + 45 * Math.cos(gaugeRad)
  const needleY = cy + 45 * Math.sin(gaugeRad)

  const initials = studentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const elapsedMs   = currentTimestamp - firstEventTimestamp
  const elapsedH    = Math.floor(elapsedMs / 3600000)
  const elapsedM    = Math.floor((elapsedMs % 3600000) / 60000)
  const elapsedS    = Math.floor((elapsedMs % 60000) / 1000)
  const recordingTimeStr = `${String(elapsedH).padStart(2,'0')}:${String(elapsedM).padStart(2,'0')}:${String(elapsedS).padStart(2,'0')}`

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Blurred backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Replay modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-4 z-50 bg-[#f8fafc] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >

            {/* ── HEADER ── */}
            <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#B9B6AD]/20 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111111] transition-colors"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
                <div className="w-px h-5 bg-[#B9B6AD]/30" />
                <span className="text-sm font-semibold text-[#111111]">{studentName}</span>
                <span className="text-sm text-[#B9B6AD]">·</span>
                <span className="text-sm text-[#6b7280] truncate max-w-[300px]">{taskTitle}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Session pills */}
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={() => setActiveSession(null)}
                    className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${
                      activeSession === null
                        ? 'bg-[#2D4E71] text-white'
                        : 'text-[#6b7280] hover:bg-[#f0f0f0]'
                    }`}
                  >
                    All sessions
                  </button>
                  {sessions.slice(0, 6).map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveSession(s.id)
                        setCurrentTimestamp(new Date(s.started_at).getTime())
                        setIsPlaying(false)
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${
                        activeSession === s.id
                          ? 'bg-[#2D4E71] text-white'
                          : 'text-[#6b7280] hover:bg-[#f0f0f0]'
                      }`}
                    >
                      Session {i + 1}
                    </button>
                  ))}
                  {sessions.length > 6 && (
                    <span className="text-[11px] text-[#B9B6AD] px-1">
                      +{sessions.length - 6} more
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl hover:bg-[#f0f0f0] flex items-center justify-center transition-colors"
                >
                  <X size={16} className="text-[#6b7280]" />
                </button>
              </div>
            </div>

            {/* ── MAIN CONTENT ── */}
            <div className="flex flex-1 overflow-hidden">

              {/* LEFT — Document panel */}
              <div className="flex-1 overflow-y-auto bg-[#e8e8e8] px-8 py-6">
                <div
                  className="bg-white mx-auto shadow-md rounded-sm"
                  style={{ maxWidth: '640px', minHeight: '600px', padding: '48px' }}
                >
                  {showHeatmap ? (
                    <SentenceHeatmap
                      sentences={sentences}
                      onSentenceClick={s => {
                        setCurrentTimestamp(s.firstTypedAt)
                        setIsPlaying(false)
                      }}
                    />
                  ) : (
                    <div
                      className="text-[14px] leading-[1.8] text-[#111111] whitespace-pre-wrap"
                      style={{ fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}
                    >
                      {reconstructedText || (
                        <span className="text-[#B9B6AD]">
                          Press Play to start the replay...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT — Analytics panel */}
              <div className="w-[300px] bg-white border-l border-[#B9B6AD]/20 flex flex-col overflow-y-auto shrink-0">

                {/* Recording time */}
                <div className="px-5 pt-5 pb-3 border-b border-[#B9B6AD]/10">
                  <p className="text-[10px] text-[#B9B6AD] uppercase tracking-widest mb-1">Recording Time</p>
                  <p className="text-2xl font-bold text-[#111111] font-mono">{recordingTimeStr}</p>
                  <p className="text-[11px] text-[#B9B6AD] mt-0.5">{currentWordCount} words at this point</p>
                </div>

                {/* Typing Analysis gauge */}
                <div className="px-5 py-4 border-b border-[#B9B6AD]/10">
                  <p className="text-[10px] text-[#B9B6AD] uppercase tracking-widest mb-3">Typing Analysis</p>
                  <div className="flex items-start gap-4">
                    <svg width="120" height="70" viewBox="0 0 160 90" className="shrink-0">
                      <defs>
                        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%"   stopColor="#16a34a" />
                          <stop offset="50%"  stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                      </defs>
                      <path
                        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                        fill="none" stroke="url(#gaugeGrad)" strokeWidth="8" strokeLinecap="round"
                      />
                      <line
                        x1={cx} y1={cy} x2={needleX} y2={needleY}
                        stroke="#111111" strokeWidth="2.5" strokeLinecap="round"
                      />
                      <circle cx={cx} cy={cy} r="4" fill="#111111" />
                      <text x="18" y="86" fontSize="8" fill="#16a34a" fontWeight="700">natural</text>
                      <text x="108" y="86" fontSize="8" fill="#ef4444" fontWeight="700">unnatural</text>
                    </svg>
                    <div className="flex-1 pt-1">
                      <p className="text-sm font-semibold text-[#111111]">{gaugeLabel} typing patterns</p>
                      <p className="text-[11px] text-[#6b7280] mt-1 leading-snug">
                        {gaugeScore < 0.2
                          ? 'Writing patterns indicate original composition'
                          : gaugeScore < 0.4
                          ? 'Mostly natural with minor anomalies'
                          : gaugeScore < 0.6
                          ? 'Some unusual patterns detected'
                          : 'Large text insertions and/or unusual rhythm changes'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#B9B6AD]/10">
                    <div className="w-7 h-7 rounded-full bg-[#2D4E71] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <span className="text-[12px] font-medium text-[#111111]">{studentName}</span>
                    <span className="text-[12px] text-[#B9B6AD]">· Editing</span>
                    <span className="text-[12px] font-semibold text-[#2D4E71] ml-auto">
                      {Math.round((submission?.organic_ratio ?? 0.8) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Analytics stats */}
                <details open className="border-b border-[#B9B6AD]/10">
                  <summary className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[#f7f7f6] transition-colors list-none">
                    <span className="text-[11px] font-semibold text-[#111111] uppercase tracking-wide">Analytics</span>
                    <ChevronRight size={13} className="text-[#B9B6AD]" />
                  </summary>
                  <div className="px-5 pb-4">
                    <p className="text-[11px] text-[#B9B6AD] mb-3">
                      {submission?.submitted_at
                        ? new Date(submission.submitted_at).toLocaleString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : 'In progress'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: currentEditCount,  total: totalEditCount,  label: 'Edits'   },
                        { value: currentPasteCount, total: pasteEvents.length, label: 'Pastes' },
                        { value: currentMinutes,    total: totalMinutes,    label: 'Minutes' },
                        { value: currentWordCount,  total: totalWordCount,  label: 'Words'   },
                      ].map(({ value, total, label }) => (
                        <div key={label} className="bg-[#f7f7f6] rounded-xl p-3">
                          <p className="text-base font-bold text-[#111111]">{value}</p>
                          <p className="text-[10px] text-[#B9B6AD]">of {total} {label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>

                {/* Sessions list */}
                <details open className="border-b border-[#B9B6AD]/10">
                  <summary className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[#f7f7f6] transition-colors list-none">
                    <span className="text-[11px] font-semibold text-[#111111] uppercase tracking-wide">Sessions</span>
                    <ChevronRight size={13} className="text-[#B9B6AD]" />
                  </summary>
                  <div className="px-3 pb-3 space-y-1 max-h-[200px] overflow-y-auto">
                    {sessions.map((s, i) => {
                      const startTime = new Date(s.started_at)
                      const isActive = activeSession === s.id ||
                        (activeSession === null &&
                          currentTimestamp >= startTime.getTime() &&
                          (!sessions[i + 1] || currentTimestamp < new Date(sessions[i + 1].started_at).getTime()))
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setActiveSession(s.id)
                            setCurrentTimestamp(startTime.getTime())
                            setIsPlaying(false)
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                            isActive
                              ? 'bg-[#2D4E71]/10 border border-[#2D4E71]/20'
                              : 'hover:bg-[#f0f0f0] border border-transparent'
                          }`}
                        >
                          <p className={`text-[12px] font-semibold ${isActive ? 'text-[#2D4E71]' : 'text-[#111111]'}`}>
                            Session {i + 1}
                          </p>
                          <p className="text-[10px] text-[#B9B6AD]">
                            {startTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {', '}
                            {startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            {s.ended_at ? ` – ${new Date(s.ended_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </details>

                {/* Activity — paste events */}
                <div className="px-5 py-3 flex-1 overflow-y-auto">
                  <p className="text-[10px] text-[#B9B6AD] uppercase tracking-widest mb-3">Activity</p>
                  <div className="space-y-2">
                    {pasteEvents.slice(0, 8).map((paste, i) => (
                      <div key={i} className="border border-[#B9B6AD]/20 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-semibold text-[#111111]">
                            {paste.pasted_char_count > 200 ? 'Large Paste' : 'Small Paste'}
                          </span>
                          {!paste.declared_type && (
                            <span className="text-[10px] text-amber-600">Undeclared</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#6b7280] line-clamp-2 mb-2">
                          {(paste.pasted_text || '').slice(0, 80)}…
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            (paste.ai_likelihood || 0) < 0.3
                              ? 'bg-emerald-100 text-emerald-700'
                              : (paste.ai_likelihood || 0) < 0.6
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {(paste.ai_likelihood || 0) < 0.3 ? 'Human'
                              : (paste.ai_likelihood || 0) < 0.6 ? 'Mixed'
                              : 'AI'}
                          </span>
                          <span className="text-[10px] text-[#B9B6AD] ml-auto">
                            {Math.round(paste.pasted_char_count / 5.5)} words
                          </span>
                        </div>
                      </div>
                    ))}
                    {pasteEvents.length === 0 && (
                      <p className="text-[11px] text-[#B9B6AD] text-center py-4">No paste events</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── CONTROL BAR ── */}
            <div className="shrink-0 bg-white border-t border-[#B9B6AD]/20">
              <div className="flex items-center gap-3 px-6 h-14">

                {/* Transport */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setCurrentTimestamp(firstEventTimestamp); setIsPlaying(false) }}
                    className="w-8 h-8 rounded-lg hover:bg-[#f0f0f0] flex items-center justify-center transition-colors"
                    title="Skip to start"
                  >
                    <SkipBack size={15} className="text-[#6b7280]" />
                  </button>
                  <button
                    onClick={() => setIsPlaying(p => !p)}
                    className="w-9 h-9 rounded-xl bg-[#2D4E71] hover:bg-[#1e3a56] text-white flex items-center justify-center transition-colors shadow-sm"
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>
                  <button
                    onClick={() => { setCurrentTimestamp(lastEventTimestamp); setIsPlaying(false) }}
                    className="w-8 h-8 rounded-lg hover:bg-[#f0f0f0] flex items-center justify-center transition-colors"
                    title="Skip to end"
                  >
                    <SkipForward size={15} className="text-[#6b7280]" />
                  </button>
                </div>

                <div className="w-px h-5 bg-[#B9B6AD]/30" />

                {/* Preset speeds */}
                <div className="flex items-center gap-1">
                  {presetSpeeds.map(speed => (
                    <button
                      key={speed.label}
                      onClick={() => setActiveSpeed(speed)}
                      className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors ${
                        activeSpeed.label === speed.label
                          ? 'bg-[#2D4E71] text-white'
                          : 'text-[#B9B6AD] hover:text-[#111111] hover:bg-[#f0f0f0]'
                      }`}
                    >
                      {speed.label}
                    </button>
                  ))}
                </div>

                <div className="w-px h-5 bg-[#B9B6AD]/30" />

                {/* Watch in Xs */}
                <div className="flex items-center gap-2">
                  {[watchIn60, watchIn30].map(speed => (
                    <button
                      key={speed.label}
                      onClick={() => {
                        setActiveSpeed(speed)
                        setCurrentTimestamp(firstEventTimestamp)
                        setIsPlaying(true)
                      }}
                      title={estimateRealDuration(speed, totalDurationMs)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                        activeSpeed.label === speed.label
                          ? 'bg-[#2D4E71] text-white border-[#2D4E71]'
                          : 'border-[#B9B6AD]/40 text-[#6b7280] hover:border-[#2D4E71] hover:text-[#2D4E71]'
                      }`}
                    >
                      Watch in {speed.label}
                    </button>
                  ))}
                </div>

                <div className="w-px h-5 bg-[#B9B6AD]/30" />

                {/* Heatmap toggle */}
                <button
                  onClick={() => setShowHeatmap(p => !p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                    showHeatmap
                      ? 'bg-[#2D4E71] text-white border-[#2D4E71]'
                      : 'border-[#B9B6AD]/40 text-[#6b7280] hover:border-[#2D4E71] hover:text-[#2D4E71]'
                  }`}
                >
                  <Layers size={13} />
                  Show AI Sentences
                </button>

                <div className="ml-auto flex items-center gap-3">
                  <span className="text-[11px] text-[#B9B6AD] font-mono">{recordingTimeStr}</span>
                  <span className="text-[11px] text-[#B9B6AD]">{Math.round(progressPct)}%</span>
                </div>
              </div>

              {/* Timeline graph */}
              <div className="border-t border-[#B9B6AD]/10">
                <TimelineGraph
                  timeline={timeline}
                  pasteEvents={pasteEvents}
                  sessions={sessions}
                  anomalyFlags={anomalyFlags}
                  currentTimestamp={currentTimestamp}
                  onSeek={ts => setCurrentTimestamp(ts)}
                />
              </div>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
