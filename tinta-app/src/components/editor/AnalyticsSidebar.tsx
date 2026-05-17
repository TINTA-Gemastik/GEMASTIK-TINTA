'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye, EyeOff, X, RefreshCw,
  Type, Trash2, Undo2, Activity, Clock,
  AlertTriangle, CheckCircle, Info,
  AlignLeft,
  Scan, ChevronDown, ChevronUp,
  Upload, BookOpen, FileText, StickyNote,
  AlertCircle,
} from 'lucide-react'
import { analyzeKeystrokeDynamics, formatDynamicsScore } from '@/lib/signals/keystrokeDynamics'
import { computeWordDiff, estimateWordDiffFromEvents } from '@/lib/signals/lineDiff'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PasteItem {
  id:               string
  pasted_text:      string
  pasted_char_count: number
  declared_type:    string | null
  source_title:     string | null
  timestamp:        number
  cursor_position?: number
  is_deleted?:      boolean
}

interface AnalyticsSidebarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events:                  any[]
  pasteItems:              PasteItem[]
  sessionStartedAt:        number
  sessionNumber:           number
  initialDocLength:        number
  currentDocLength:        number
  selectedText:            string
  userName?:               string
  initialDocText?:         string
  currentDocText?:         string
  onPasteUpdated:          (id: string, updates: Record<string, unknown>) => void
  onScanText:              (text: string) => Promise<{
    probability:     number
    breakdown?:      Record<string, number>
    confidence?:     string
    interpretation?: string
    flags?:          string[]
  }>
  onHighlightAISentences:  (enabled: boolean) => void
}

// ─── AI Scan Panel ────────────────────────────────────────────────────────────

function AIScanPanel({
  selectedText,
  onScanText,
  onHighlightAISentences,
}: {
  selectedText:           string
  onScanText:             (text: string) => Promise<{
    probability:     number
    breakdown?:      Record<string, number>
    confidence?:     string
    interpretation?: string
    flags?:          string[]
  }>
  onHighlightAISentences: (enabled: boolean) => void
}) {
  const [scanning,        setScanning]       = useState(false)
  const [showAISentences, setShowAISentences] = useState(false)
  const [scanTarget,      setScanTarget]      = useState<'full' | 'selected'>('full')
  const [result, setResult] = useState<{
    probability: number
    label:       string
    confidence:  string
    scannedText: string
    breakdown?:  Record<string, number>
    flags?:      string[]
  } | null>(null)

  const handleScan = async () => {
    const textToScan = scanTarget === 'selected' && selectedText ? selectedText : 'FULL_DOC'
    setScanning(true)
    try {
      const scanResult  = await onScanText(textToScan)
      const probability = Math.round(scanResult.probability * 100)
      setResult({
        probability,
        label: probability < 20 ? 'Low' : probability < 60 ? 'Mixed' : 'High',
        confidence: scanResult.interpretation || (
          probability < 20
            ? 'Strong evidence of original writing.'
            : probability < 60
            ? 'Mixed signals — review paste events.'
            : 'Multiple AI-assist indicators detected.'
        ),
        scannedText: scanTarget === 'selected'
          ? `"${selectedText.slice(0, 40)}…"`
          : 'Entire document',
        breakdown: scanResult.breakdown,
        flags:     scanResult.flags,
      })
    } finally {
      setScanning(false)
    }
  }

  const handleToggle = () => {
    const next = !showAISentences
    setShowAISentences(next)
    onHighlightAISentences(next)
  }

  const ringColor = result
    ? result.probability < 20 ? '#16a34a'
    : result.probability < 60 ? '#f59e0b'
    : '#ef4444'
    : '#AABED6'

  const CIRCUMFERENCE = 2 * Math.PI * 22

  return (
    <div className="px-4 pt-4">

      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <RefreshCw size={12} className="text-[#2D4E71]" />
        <span className="text-xs font-semibold text-[#111111]">AI Scan</span>
      </div>

      {/* Result card */}
      <div className="bg-[#F8F7F5] rounded-2xl border border-[#B9B6AD]/20 p-4 mb-1">
        <div className="flex items-center gap-4">
          {/* SVG probability ring */}
          <div className="relative shrink-0">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="4" />
              {result && (
                <circle
                  cx="26" cy="26" r="22"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - result.probability / 100)}
                  transform="rotate(-90 26 26)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              )}
              <text x="26" y="30" textAnchor="middle" fontSize="9" fontWeight="600"
                fill={result ? ringColor : '#AABED6'}>
                {result ? result.label : '—'}
              </text>
            </svg>
          </div>

          <div className="flex-1">
            <p className="text-sm font-bold text-[#111111]">
              {result ? `${result.probability}% AI likelihood` : 'Not scanned yet'}
            </p>
            <p className="text-[11px] text-[#6b7280] mt-0.5 leading-snug">
              {result ? result.confidence : 'Click Scan to analyze this document'}
            </p>
            {result && (
              <p className="text-[10px] text-[#B9B6AD]/70 mt-1">
                Scanned: {result.scannedText}
              </p>
            )}
          </div>
        </div>

        {/* Signal breakdown — shown after first scan */}
        {result?.breakdown && (
          <div className="mt-3 pt-3 border-t border-[#B9B6AD]/20 space-y-1.5">
            <p className="text-[10px] text-[#B9B6AD] uppercase tracking-wide mb-2">Signal Breakdown</p>
            {([
              { key: 'pasteOrigin',         label: 'Paste origin',           inverted: false },
              { key: 'ikiUniformity',       label: 'Keystroke uniformity',   inverted: false },
              { key: 'tabBurstPattern',     label: 'Tab-burst pattern',      inverted: false },
              { key: 'lowOrganicRate',      label: 'Low organic rate',       inverted: false },
              { key: 'burstRegularity',     label: 'Burst size regularity',  inverted: false },
              { key: 'withinPhraseEditing', label: 'Mid-phrase editing ↑',   inverted: true  },
              { key: 'pauseVariance',       label: 'Pause variance ↑',       inverted: true  },
              { key: 'cursorLinearity',     label: 'Linear cursor movement', inverted: false },
              { key: 'errorCorrection',     label: 'Error correction rate ↑',inverted: true  },
              { key: 'speedVariance',       label: 'Typing speed variance ↑',inverted: true  },
            ] as const).map(({ key, label, inverted }) => {
              const val      = result.breakdown![key] ?? 0
              const barColor = inverted
                ? (val > 60 ? '#16a34a' : val > 30 ? '#f59e0b' : '#ef4444')
                : (val > 60 ? '#ef4444' : val > 30 ? '#f59e0b' : '#16a34a')
              return (
                <div key={key}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] text-[#6b7280]">{label}</span>
                    <span className="text-[10px] font-medium text-[#111111]">{val}%</span>
                  </div>
                  <div className="w-full h-1 bg-[#B9B6AD]/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:           `${val}%`,
                        backgroundColor: barColor,
                        transition:      'width 0.6s ease-out',
                      }}
                    />
                  </div>
                </div>
              )
            })}
            {result.flags && result.flags.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#B9B6AD]/20 space-y-2">
                <p className="text-[10px] text-[#B9B6AD] uppercase tracking-wide">Pattern Flags</p>
                {result.flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 px-2 py-1.5 bg-amber-50 rounded-lg border border-amber-200/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <p className="text-[11px] text-amber-800 leading-snug">{flag}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-[#B9B6AD] text-center mb-3 px-2 leading-relaxed">
        TINTA analyzes HOW you wrote, not what the text looks like.
        More accurate for Bahasa Indonesia and non-native English writers.
      </p>

      {/* Scan controls */}
      <div className="flex items-center gap-2 mb-3">
        {/* Scan target toggle */}
        <div className="flex items-center bg-[#F8F7F5] rounded-xl border border-[#B9B6AD]/20 p-0.5 flex-1">
          <button
            onClick={() => setScanTarget('full')}
            className={`flex-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors font-medium ${
              scanTarget === 'full' ? 'bg-[#2D4E71] text-white' : 'text-[#B9B6AD] hover:text-[#111111]'
            }`}
          >
            Full Doc
          </button>
          <button
            onClick={() => setScanTarget('selected')}
            disabled={!selectedText}
            className={`flex-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-30 ${
              scanTarget === 'selected' && selectedText ? 'bg-[#2D4E71] text-white' : 'text-[#B9B6AD] hover:text-[#111111]'
            }`}
          >
            {selectedText ? `"${selectedText.slice(0, 10)}…"` : 'Select text first'}
          </button>
        </div>

        {/* Scan button */}
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2D4E71] text-white text-[11px] font-semibold hover:bg-[#213a56] transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {scanning
            ? <RefreshCw size={11} className="animate-spin" />
            : <Scan size={11} />}
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {/* Show AI Sentences toggle */}
      <div className="flex items-center justify-between py-2.5 border-t border-[#B9B6AD]/20">
        <div className="flex items-center gap-2">
          <AlignLeft size={13} className="text-[#2D4E71]" />
          <span className="text-xs text-[#111111] font-medium">Show AI Sentences</span>
          <div className="w-4 h-4 rounded-full border border-[#B9B6AD]/30 flex items-center justify-center">
            <Info size={9} className="text-[#B9B6AD]" />
          </div>
        </div>
        <button
          onClick={handleToggle}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            showAISentences ? 'bg-[#2D4E71]' : 'bg-[#B9B6AD]/30'
          }`}
        >
          <motion.div
            animate={{ x: showAISentences ? 21 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
          />
        </button>
      </div>

      {/* Legend */}
      <AnimatePresence>
        {showAISentences && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-4 py-2 border-t border-[#B9B6AD]/20">
              {[
                { bars: [0.3, 0.6, 0.9], color: 'bg-amber-400', label: 'Low AI' },
                { bars: [0.5, 0.8, 1.0], color: 'bg-red-400',   label: 'High AI' },
                { bars: [0.5, 0.8, 1.0], color: 'bg-emerald-400', label: 'Human' },
              ].map(({ bars, color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {bars.map((o, i) => (
                      <div key={i} className={`w-1.5 h-3 rounded-sm ${color}`} style={{ opacity: o }} />
                    ))}
                  </div>
                  <span className="text-[10px] text-[#B9B6AD]">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Paste item card (light) ──────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'citation', label: 'Citation from source', icon: BookOpen  },
  { value: 'own_text', label: 'My own text',           icon: FileText  },
  { value: 'notes',    label: 'Personal notes',        icon: StickyNote },
]

function PasteItemCard({
  item,
  onUpdate,
}: {
  item:     PasteItem
  onUpdate: (id: string, updates: Record<string, unknown>) => void
}) {
  const isDeclared = !!(item.declared_type && item.declared_type !== '')
  const [expanded, setExpanded] = useState(!isDeclared)
  const [type,     setType]     = useState(item.declared_type ?? '')
  const [title,    setTitle]    = useState(item.source_title ?? '')
  const [fileName, setFileName] = useState('')

  const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDeclared
        ? 'border-[#B9B6AD]/20 bg-[#f7f7f6]'
        : 'border-amber-200 bg-amber-50'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
          isDeclared ? 'bg-[#AABED6]/20' : 'bg-amber-100'
        }`}>
          {isDeclared
            ? <CheckCircle size={11} className="text-[#2D4E71]" />
            : <AlertCircle size={11} className="text-amber-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[#111111] truncate">
            &quot;{item.pasted_text.slice(0, 30)}…&quot;
          </p>
          <p className="text-[10px] text-[#B9B6AD]">
            {item.pasted_char_count} chars · {time}
            {isDeclared ? ` · ${item.declared_type}` : ' · Needs declaration'}
          </p>
        </div>
        {expanded
          ? <ChevronUp   size={11} className="text-[#B9B6AD] shrink-0" />
          : <ChevronDown size={11} className="text-[#B9B6AD] shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-[#B9B6AD]/20"
          >
            <div className="px-3 pb-3 pt-2 space-y-2">
              <p className="text-[10px] text-[#B9B6AD] font-mono leading-relaxed line-clamp-2 bg-white rounded-lg p-2 border border-[#B9B6AD]/15">
                &quot;{item.pasted_text}&quot;
              </p>
              {TYPE_OPTIONS.map(opt => {
                const Icon = opt.icon
                const sel  = type === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                      sel
                        ? 'border-[#2D4E71] bg-[#AABED6]/20'
                        : 'border-[#B9B6AD]/30 hover:border-[#B9B6AD]/60'
                    }`}
                  >
                    <Icon size={11} className={sel ? 'text-[#2D4E71]' : 'text-[#B9B6AD]'} />
                    <span className={`text-[11px] ${sel ? 'text-[#111111] font-medium' : 'text-[#B9B6AD]'}`}>
                      {opt.label}
                    </span>
                  </button>
                )
              })}
              <input
                type="text"
                placeholder="Source title (optional)"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-[#B9B6AD]/30 bg-white text-[#111111] placeholder:text-[#B9B6AD] focus:outline-none focus:border-[#2D4E71]"
              />
              <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-dashed border-[#B9B6AD]/40 hover:border-[#2D4E71]/40 cursor-pointer transition-colors">
                <Upload size={11} className="text-[#2D4E71]" />
                <span className="text-[11px] text-[#2D4E71]">
                  {fileName || 'Upload source file'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={e => setFileName(e.target.files?.[0]?.name ?? '')}
                />
              </label>
              <button
                onClick={() => {
                  if (!type) return
                  onUpdate(item.id, { declared_type: type, source_title: title || null })
                  setExpanded(false)
                }}
                disabled={!type}
                className="w-full py-1.5 rounded-lg bg-[#2D4E71] text-white text-[11px] font-semibold hover:bg-[#213a56] transition-colors disabled:opacity-30"
              >
                Save Declaration
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Score bar — CSS transition, no framer-motion ────────────────────────────

const ScoreBar = ({ value, color }: { value: number; color: string }) => (
  <div className="w-full h-1.5 bg-[#B9B6AD]/20 rounded-full overflow-hidden mt-1">
    <div
      style={{
        backgroundColor: color,
        width: `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`,
        height: '100%',
        borderRadius: '9999px',
        transition: 'width 0.6s ease-out',
      }}
    />
  </div>
)

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function AnalyticsSidebar({
  events,
  pasteItems,
  sessionStartedAt,
  sessionNumber,
  initialDocLength,
  currentDocLength,
  initialDocText,
  currentDocText,
  selectedText,
  userName,
  onPasteUpdated,
  onScanText,
  onHighlightAISentences,
}: AnalyticsSidebarProps) {
  const [isOpen,        setIsOpen]        = useState(false)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [activeSection, setActiveSection] = useState<'analytics' | 'scan'>('analytics')

  // Timer — isolated so stats don't recalculate every second
  useEffect(() => {
    const id = setInterval(() => {
      setSessionSeconds(Math.floor((Date.now() - sessionStartedAt) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [sessionStartedAt])

  const sessionMins = Math.floor(sessionSeconds / 60)
  const sessionSecs = sessionSeconds % 60

  // ── Memoized stats — only recalculate when events/pasteItems/docLength change ─
  const stats = useMemo(() => {
    const charsTyped   = events.filter(e => e.event_type === 'keystroke' && !e.payload?.is_delete_key).length
    const charsDeleted = events.filter(e => e.event_type === 'delete').reduce((s, e) => s + (e.payload?.deleted_char_count ?? 0), 0)
    const undoCount    = events.filter(e => e.event_type === 'undo').length
    const tabSwitches  = events.filter(e => e.event_type === 'window_hidden').length
    const charsPasted  = pasteItems.reduce((s, p) => s + p.pasted_char_count, 0)

    const revisionBase  = charsTyped + charsPasted
    const revisionDepth = Math.min(revisionBase > 0 ? charsDeleted / revisionBase : 0, 1.0)
    const organicRatio  = currentDocLength > 0 ? Math.min(1, charsTyped / currentDocLength) : 1

    return { charsTyped, charsDeleted, undoCount, tabSwitches, charsPasted, revisionDepth, organicRatio }
  }, [events, pasteItems, currentDocLength])

  // ── Session delta (word-level, git style) ──────────────────────────────────
  const wordDiff = useMemo(() => {
    if (initialDocText !== undefined && currentDocText !== undefined &&
        (initialDocText.length > 0 || currentDocText.length > 0)) {
      return computeWordDiff(initialDocText, currentDocText)
    }
    const initialWords = Math.round(initialDocLength / 5.5)
    const currentWords = Math.round(currentDocLength / 5.5)
    return estimateWordDiffFromEvents(events, initialWords, currentWords)
  }, [events, initialDocLength, currentDocLength, initialDocText, currentDocText])

  const undeclaredCount = pasteItems.filter(p => !(p.declared_type && p.declared_type !== '')).length

  // IKD — only computed when sidebar is open (expensive)
  const ikdResult    = isOpen ? analyzeKeystrokeDynamics(events) : null
  const ikdFormatted = ikdResult ? formatDynamicsScore(ikdResult) : null

  // ── Tab button ──────────────────────────────────────────────────────────────
  const TabBtn = ({ id, label, badge }: { id: typeof activeSection; label: string; badge?: number }) => (
    <button
      onClick={() => setActiveSection(id)}
      className={`flex-1 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
        activeSection === id
          ? 'text-[#2D4E71] border-[#2D4E71]'
          : 'text-[#B9B6AD] hover:text-[#111111] border-transparent'
      }`}
    >
      {label}
      {badge && badge > 0 ? (
        <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
          {badge}
        </span>
      ) : null}
    </button>
  )

  return (
    <>
      {/* ── Eye icon toggle ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        title={isOpen ? "Hide Dashboard" : "Open Dashboard"}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-12 h-20 bg-[#2A4D88] text-white hover:text-black rounded-l-2xl shadow-lg hover:bg-[#f7f7f6] transition-colors border border-[#B9B6AD]/30 border-r-0"
      >
        {isOpen ? <EyeOff size={26} /> : <Eye size={26} />}
      </button>

      {/* ── Sidebar panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 340, y: '-50%', opacity: 0 }}
            animate={{ x: 0,   y: '-50%', opacity: 1 }}
            exit={{ x: 340,    y: '-50%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ position: 'fixed', right: '48px', top: '50%', zIndex: 30, width: '320px', maxHeight: 'calc(100vh - 64px)' }}
            className="flex flex-col rounded-[30px] overflow-hidden shadow-2xl border border-[#B9B6AD]/20 bg-white"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#B9B6AD]/20 shrink-0">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-[#2D4E71]" />
                <span className="text-sm font-bold text-[#111111] tracking-tight">
                  {userName ? `${userName}'s Dashboard` : "Tinta's Dashboard"}
                </span>
                <span className="text-[10px] text-[#B9B6AD] font-normal">Session {sessionNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-600 font-mono">
                    {String(sessionMins).padStart(2, '0')}:{String(sessionSecs).padStart(2, '0')}
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-6 h-6 rounded-lg hover:bg-[#f7f7f6] flex items-center justify-center transition-colors"
                >
                  <X size={13} className="text-[#B9B6AD]" />
                </button>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-[#B9B6AD]/20 px-4 shrink-0">
              <TabBtn id="analytics" label="Analytics" />
              <TabBtn id="scan"      label="Scan & Pastes" badge={undeclaredCount} />
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">

              {/* ── ANALYTICS ── */}
              {activeSection === 'analytics' && (
                <div className="px-4 pt-4 space-y-3 pb-6">

                  {/* Session Delta */}
                  <div className="bg-[#111111] rounded-2xl border border-white/10 p-3 font-mono">
                    <p className="text-[10px] text-white/50 uppercase tracking-widest mb-2">Session Delta</p>
                    <p className="text-sm text-emerald-400 font-bold">
                      +{wordDiff.insertions}{' '}
                      <span className="text-[#9ca3af] font-normal text-xs">insertion{wordDiff.insertions !== 1 ? 's' : ''}(+)</span>
                    </p>
                    <p className="text-sm text-red-400 font-bold">
                      -{wordDiff.deletions}{' '}
                      <span className="text-[#9ca3af] font-normal text-xs">deletion{wordDiff.deletions !== 1 ? 's' : ''}(-)</span>
                    </p>
                    <p className="text-[11px] text-[#9ca3af] mt-2">~{Math.round(currentDocLength / 5.5)} words total</p>
                  </div>

                  {/* Stats grid */}
                  <div className="bg-[#F8F7F5] rounded-2xl border border-[#B9B6AD]/20 divide-y divide-[#B9B6AD]/15">
                    {[
                      { icon: Type,     label: 'Words typed',    value: Math.round(stats.charsTyped / 5.5).toLocaleString()   },
                      { icon: Trash2,   label: 'Words deleted',   value: Math.round(stats.charsDeleted / 5.5).toLocaleString() },
                      { icon: Undo2,    label: 'Undo count',      value: stats.undoCount.toString()                            },
                      { icon: Activity, label: 'Tab switches',    value: stats.tabSwitches.toString()                          },
                      { icon: Clock,    label: 'Words (total)',   value: Math.floor(currentDocLength / 5.5).toLocaleString()   },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Icon size={11} className="text-[#2D4E71]" />
                          <span className="text-[11px] text-[#374151]">{label}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-[#111111]">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Writing signals */}
                  <p className="text-[10px] text-[#374151] uppercase tracking-widest">Writing Signals</p>

                  {/* Revision depth */}
                  <div className="bg-[#F8F7F5] rounded-xl border border-[#B9B6AD]/20 p-3">
                    <div className="flex justify-between">
                      <span className="text-[11px] text-[#111111] font-medium">Revision Depth</span>
                      <span className="text-[11px] font-bold text-[#2D4E71]">
                        {Math.round(stats.revisionDepth * 100)}%
                      </span>
                    </div>
                    <ScoreBar
                      value={Math.min(stats.revisionDepth * 2.5, 1)}
                      color={stats.revisionDepth > 0.05 ? '#2D4E71' : '#f59e0b'}
                    />
                    <p className="text-[10px] text-[#6b7280] mt-1">
                      {stats.revisionDepth < 0.02
                        ? 'Very low — healthy writing revises more'
                        : stats.revisionDepth < 0.15
                        ? 'Good — shows active editing'
                        : 'High — strong evidence of original thought'}
                    </p>
                  </div>

                  {/* Organic ratio */}
                  <div className="bg-[#F8F7F5] rounded-xl border border-[#B9B6AD]/20 p-3">
                    <div className="flex justify-between">
                      <span className="text-[11px] text-[#111111] font-medium">Organic Writing</span>
                      <span className="text-[11px] font-bold text-emerald-600">
                        {Math.round(stats.organicRatio * 100)}%
                      </span>
                    </div>
                    <ScoreBar
                      value={stats.organicRatio}
                      color={stats.organicRatio > 0.7 ? '#16a34a' : stats.organicRatio > 0.4 ? '#f59e0b' : '#ef4444'}
                    />
                    <p className="text-[10px] text-[#6b7280] mt-1">
                      Proportion of text typed keystroke-by-keystroke
                    </p>
                  </div>

                  {/* Keystroke rhythm */}
                  {ikdResult && ikdFormatted && (
                    <div className="bg-[#F8F7F5] rounded-xl border border-[#B9B6AD]/20 p-3">
                      <div className="flex justify-between">
                        <span className="text-[11px] text-[#111111] font-medium">Typing Rhythm</span>
                        <span className="text-[11px] font-bold" style={{ color: ikdFormatted.color }}>
                          {ikdFormatted.label}
                        </span>
                      </div>
                      <ScoreBar value={ikdResult.score} color={ikdFormatted.color} />
                      <p className="text-[10px] text-[#6b7280] mt-1">{ikdFormatted.detail}</p>
                      {ikdResult.burstPatternCount > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 bg-amber-50 rounded-lg border border-amber-200">
                          <AlertTriangle size={9} className="text-amber-600" />
                          <p className="text-[10px] text-amber-700">
                            {ikdResult.burstPatternCount} read-then-type burst{ikdResult.burstPatternCount > 1 ? 's' : ''} detected
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-[#AABED6]/10 rounded-xl border border-[#AABED6]/20">
                    <Info size={11} className="text-[#2D4E71] mt-0.5 shrink-0" />
                    <p className="text-[10px] text-[#374151] leading-relaxed">
                      These analytics are visible to you only. Your lecturer sees a summary after submission.
                    </p>
                  </div>

                </div>
              )}

              {/* ── SCAN & PASTES ── */}
              {activeSection === 'scan' && (
                <div className="flex flex-col">
                  <details className="mx-4 mt-3 mb-1">
                    <summary className="text-[11px] text-[#2D4E71] cursor-pointer hover:underline list-none flex items-center gap-1 select-none">
                      <Info size={11} />
                      <span>How is this score calculated?</span>
                    </summary>
                    <div className="mt-2 p-3 bg-[#f7f7f6] rounded-xl border border-[#B9B6AD]/20 space-y-1.5">
                      <p className="text-[10px] text-[#6b7280] leading-relaxed">
                        TINTA analyzes your <strong>writing behavior</strong>, not your text. Ten signals:
                      </p>
                      {[
                        { label: 'Paste origin',           desc: 'Characters pasted vs. typed'                            },
                        { label: 'Keystroke uniformity',   desc: 'How uniform your typing speed is (IKI CV)'             },
                        { label: 'Tab-burst pattern',      desc: 'Tab switch followed by sudden fast typing'               },
                        { label: 'Low organic rate',       desc: 'Proportion of text typed keystroke-by-keystroke'         },
                        { label: 'Burst size regularity',  desc: 'Human writers vary burst length; AI copying is regular'  },
                        { label: 'Mid-phrase editing ↑',   desc: 'More mid-sentence deletions → more organic (↑ = good)'  },
                        { label: 'Pause variance ↑',       desc: 'High variance in pauses → natural thinking (↑ = good)'  },
                        { label: 'Linear cursor movement', desc: 'Forward-only cursor = less revision = suspicious'        },
                        { label: 'Error correction ↑',     desc: 'TypeNet: higher delete ratio = active self-editing (↑ = good)' },
                        { label: 'Speed variance ↑',       desc: 'TypeNet: speed variation across 30-key windows (↑ = good)'     },
                      ].map(({ label, desc }) => (
                        <div key={label} className="flex gap-2">
                          <span className="text-[10px] font-semibold text-[#2D4E71] shrink-0 w-[110px]">{label}</span>
                          <span className="text-[10px] text-[#6b7280]">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                  <AIScanPanel
                    selectedText={selectedText}
                    onScanText={onScanText}
                    onHighlightAISentences={onHighlightAISentences}
                  />

                  <div className="mx-4 my-2 h-px bg-[#B9B6AD]/20" />

                  <div className="px-4 pb-6">
                    {pasteItems.length === 0 ? (
                      <div className="text-center py-6 text-[#B9B6AD] text-xs">
                        No paste events yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] text-[#2D4E71] uppercase tracking-widest mb-3">
                          {undeclaredCount > 0
                            ? `${undeclaredCount} paste${undeclaredCount > 1 ? 's' : ''} need attention`
                            : 'All pastes declared ✓'}
                        </p>
                        {pasteItems.map(item => (
                          <PasteItemCard key={item.id} item={item} onUpdate={onPasteUpdated} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
