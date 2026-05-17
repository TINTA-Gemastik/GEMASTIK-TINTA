'use client'

import React, { useState, useEffect } from 'react'
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface PasteItem {
  id:               string
  pasted_text:      string
  pasted_char_count: number
  declared_type:    string | null
  source_title:     string | null
  timestamp:        number
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
  onPasteUpdated:          (id: string, updates: Record<string, unknown>) => void
  onScanText:              (text: string) => Promise<number>
  onHighlightAISentences:  (enabled: boolean) => void
}

// ─── AI Scan Panel ────────────────────────────────────────────────────────────

function AIScanPanel({
  selectedText,
  onScanText,
  onHighlightAISentences,
}: {
  selectedText:           string
  onScanText:             (text: string) => Promise<number>
  onHighlightAISentences: (enabled: boolean) => void
}) {
  const [scanning,        setScanning]        = useState(false)
  const [showAISentences, setShowAISentences]  = useState(false)
  const [scanTarget,      setScanTarget]       = useState<'full' | 'selected'>('full')
  const [result, setResult] = useState<{
    probability:  number
    label:        string
    confidence:   string
    scannedText:  string
  } | null>(null)

  const handleScan = async () => {
    const textToScan = scanTarget === 'selected' && selectedText ? selectedText : 'FULL_DOC'
    setScanning(true)
    try {
      const prob        = await onScanText(textToScan)
      const probability = Math.round(prob * 100)
      setResult({
        probability,
        label: probability < 20 ? 'Human' : probability < 60 ? 'Mixed' : 'AI',
        confidence:
          probability < 20 ? 'Highly confident this text is entirely human' :
          probability < 60 ? 'Text shows mixed human and AI characteristics' :
          'Highly confident this text was AI generated',
        scannedText: scanTarget === 'selected'
          ? `"${selectedText.slice(0, 40)}…"`
          : 'Entire document',
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
        <RefreshCw size={12} className="text-[#AABED6]" />
        <span className="text-xs font-semibold text-white">AI Scan</span>
      </div>

      {/* Result card */}
      <div className="bg-white/5 rounded-2xl border border-white/10 p-4 mb-3">
        <div className="flex items-center gap-4">
          {/* SVG probability ring */}
          <div className="relative shrink-0">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
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
            <p className="text-sm font-bold text-white">
              {result ? `${result.probability}% AI probability` : 'Not scanned yet'}
            </p>
            <p className="text-[11px] text-[#AABED6] mt-0.5 leading-snug">
              {result ? result.confidence : 'Click Scan to analyze this document'}
            </p>
            {result && (
              <p className="text-[10px] text-white/30 mt-1">
                Scanned: {result.scannedText}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scan controls */}
      <div className="flex items-center gap-2 mb-3">
        {/* Scan target toggle */}
        <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-0.5 flex-1">
          <button
            onClick={() => setScanTarget('full')}
            className={`flex-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors font-medium ${
              scanTarget === 'full' ? 'bg-[#2D4E71] text-white' : 'text-[#AABED6] hover:text-white'
            }`}
          >
            Full Doc
          </button>
          <button
            onClick={() => setScanTarget('selected')}
            disabled={!selectedText}
            className={`flex-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-30 ${
              scanTarget === 'selected' && selectedText ? 'bg-[#2D4E71] text-white' : 'text-[#AABED6] hover:text-white'
            }`}
          >
            {selectedText ? `"${selectedText.slice(0, 10)}…"` : 'Select text first'}
          </button>
        </div>

        {/* Scan button */}
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2D4E71] text-white text-[11px] font-semibold hover:bg-[#1e3a56] transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {scanning
            ? <RefreshCw size={11} className="animate-spin" />
            : <Scan size={11} />}
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {/* Show AI Sentences toggle */}
      <div className="flex items-center justify-between py-2.5 border-t border-white/10">
        <div className="flex items-center gap-2">
          <AlignLeft size={13} className="text-[#AABED6]" />
          <span className="text-xs text-white font-medium">Show AI Sentences</span>
          <div className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center">
            <Info size={9} className="text-[#AABED6]" />
          </div>
        </div>
        <button
          onClick={handleToggle}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            showAISentences ? 'bg-[#2D4E71]' : 'bg-white/20'
          }`}
        >
          <motion.div
            animate={{ x: showAISentences ? 21 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
          />
        </button>
      </div>

      {/* Legend (shown when toggle is on) */}
      <AnimatePresence>
        {showAISentences && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-4 py-2 border-t border-white/10">
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
                  <span className="text-[10px] text-[#AABED6]">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Paste item card (dark) ───────────────────────────────────────────────────

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
  const [expanded,  setExpanded]  = useState(!item.declared_type)
  const [type,      setType]      = useState(item.declared_type ?? '')
  const [title,     setTitle]     = useState(item.source_title ?? '')
  const [fileName,  setFileName]  = useState('')

  const isDeclared = !!item.declared_type
  const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDeclared ? 'border-white/10 bg-white/5' : 'border-amber-500/30 bg-amber-500/10'
    }`}>
      {/* Collapsed row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
          isDeclared ? 'bg-[#2D4E71]/30' : 'bg-amber-500/20'
        }`}>
          {isDeclared
            ? <CheckCircle size={11} className="text-[#AABED6]" />
            : <AlertCircle size={11} className="text-amber-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-white truncate">
            &quot;{item.pasted_text.slice(0, 30)}…&quot;
          </p>
          <p className="text-[10px] text-white/40">
            {item.pasted_char_count} chars · {time}
            {isDeclared ? ` · ${item.declared_type}` : ' · Needs declaration'}
          </p>
        </div>
        {expanded
          ? <ChevronUp   size={11} className="text-white/30 shrink-0" />
          : <ChevronDown size={11} className="text-white/30 shrink-0" />}
      </button>

      {/* Expanded form */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="px-3 pb-3 pt-2 space-y-2">

              {/* Text preview */}
              <p className="text-[10px] text-white/40 font-mono leading-relaxed line-clamp-2 bg-white/5 rounded-lg p-2">
                &quot;{item.pasted_text}&quot;
              </p>

              {/* Type selector */}
              {TYPE_OPTIONS.map(opt => {
                const Icon = opt.icon
                const sel  = type === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                      sel ? 'border-[#AABED6]/60 bg-[#2D4E71]/30' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <Icon size={11} className={sel ? 'text-[#AABED6]' : 'text-white/30'} />
                    <span className={`text-[11px] ${sel ? 'text-white font-medium' : 'text-white/50'}`}>
                      {opt.label}
                    </span>
                  </button>
                )
              })}

              {/* Title input */}
              <input
                type="text"
                placeholder="Source title (optional)"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#AABED6]/50"
              />

              {/* Upload file placeholder */}
              <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-dashed border-white/20 hover:border-[#AABED6]/40 cursor-pointer transition-colors">
                <Upload size={11} className="text-[#AABED6]" />
                <span className="text-[11px] text-[#AABED6]">
                  {fileName || 'Upload source file'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={e => setFileName(e.target.files?.[0]?.name ?? '')}
                />
              </label>

              {/* Save */}
              <button
                onClick={() => {
                  if (!type) return
                  onUpdate(item.id, { declared_type: type, source_title: title || null })
                  setExpanded(false)
                }}
                disabled={!type}
                className="w-full py-1.5 rounded-lg bg-[#2D4E71] text-white text-[11px] font-semibold hover:bg-[#1e3a56] transition-colors disabled:opacity-30"
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

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function AnalyticsSidebar({
  events,
  pasteItems,
  sessionStartedAt,
  sessionNumber,
  initialDocLength,
  currentDocLength,
  selectedText,
  onPasteUpdated,
  onScanText,
  onHighlightAISentences,
}: AnalyticsSidebarProps) {
  const [isOpen,        setIsOpen]        = useState(false)
  const [now,           setNow]           = useState(Date.now())
  const [activeSection, setActiveSection] = useState<'scan' | 'analytics' | 'pastes'>('scan')

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Derived stats ───────────────────────────────────────────────────────────
  const charsTyped   = events.filter(e => e.event_type === 'keystroke' && !e.payload?.is_delete_key).length
  const charsDeleted = events.filter(e => e.event_type === 'delete').reduce((s, e) => s + (e.payload?.deleted_char_count ?? 0), 0)
  const undoCount    = events.filter(e => e.event_type === 'undo').length
  const tabSwitches  = events.filter(e => e.event_type === 'window_hidden').length

  const netChange     = currentDocLength - initialDocLength
  const netInsertions = Math.max(0, netChange)
  const netDeletions  = Math.max(0, -netChange)
  const wordsDelta    = Math.round(netChange / 5.5)

  const sessionMs   = now - sessionStartedAt
  const sessionMins = Math.floor(sessionMs / 60_000)
  const sessionSecs = Math.floor((sessionMs % 60_000) / 1000)

  const revisionBase  = charsTyped + pasteItems.reduce((s, p) => s + p.pasted_char_count, 0)
  const revisionDepth = revisionBase > 0 ? charsDeleted / revisionBase : 0
  const organicRatio  = currentDocLength > 0 ? Math.min(1, charsTyped / currentDocLength) : 1

  const undeclaredCount = pasteItems.filter(p => !p.declared_type).length

  // IKD — only computed when sidebar is open
  const ikdResult    = isOpen ? analyzeKeystrokeDynamics(events) : null
  const ikdFormatted = ikdResult ? formatDynamicsScore(ikdResult) : null

  // ── Tab button component ────────────────────────────────────────────────────
  const TabBtn = ({ id, label, badge }: { id: typeof activeSection; label: string; badge?: number }) => (
    <button
      onClick={() => setActiveSection(id)}
      className={`flex-1 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
        activeSection === id
          ? 'text-white border-[#AABED6]'
          : 'text-white/40 hover:text-white/70 border-transparent'
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

  const ScoreBar = ({ value, color }: { value: number; color: string }) => (
    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(Math.min(value, 1) * 100)}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  )

  return (
    <>
      {/* ── Eye icon toggle tab ─────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        title={isOpen ? 'Hide AI Vision' : 'Open AI Vision'}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-8 h-16 bg-[#111111] text-white rounded-l-2xl shadow-xl hover:bg-[#1e1e1e] transition-colors border border-white/10 border-r-0"
      >
        {isOpen ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>

      {/* ── Sidebar panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 340, opacity: 0 }}
            animate={{ x: 0,   opacity: 1 }}
            exit={{ x: 340,    opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-8 top-0 bottom-0 w-[320px] z-30 bg-[#111111] flex flex-col overflow-hidden border-l border-white/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-[#AABED6]" />
                <span className="text-sm font-bold text-white tracking-tight">AI Vision</span>
                <span className="text-[10px] text-white/30 font-normal">Session {sessionNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Recording timer */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/15 rounded-lg border border-emerald-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {String(sessionMins).padStart(2, '0')}:{String(sessionSecs).padStart(2, '0')}
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X size={13} className="text-[#AABED6]" />
                </button>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-white/10 px-4 shrink-0">
              <TabBtn id="scan"      label="AI Scan" />
              <TabBtn id="analytics" label="Analytics" />
              <TabBtn id="pastes"    label="Pastes" badge={undeclaredCount} />
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">

              {/* ── AI SCAN ── */}
              {activeSection === 'scan' && (
                <AIScanPanel
                  selectedText={selectedText}
                  onScanText={onScanText}
                  onHighlightAISentences={onHighlightAISentences}
                />
              )}

              {/* ── ANALYTICS ── */}
              {activeSection === 'analytics' && (
                <div className="px-4 pt-4 space-y-3 pb-6">

                  {/* Git delta */}
                  <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-3 font-mono">
                    <p className="text-[10px] text-[#AABED6] uppercase tracking-widest mb-2">Session Delta</p>
                    <p className="text-sm text-emerald-400 font-bold">
                      +{netInsertions}{' '}
                      <span className="text-white/30 font-normal text-xs">net additions</span>
                    </p>
                    <p className="text-sm text-red-400 font-bold">
                      −{netDeletions}{' '}
                      <span className="text-white/30 font-normal text-xs">net deletions</span>
                    </p>
                    <p className="text-xs text-[#AABED6] mt-1">
                      {wordsDelta >= 0 ? '+' : ''}{wordsDelta} words this session
                    </p>
                  </div>

                  {/* Stats grid */}
                  <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/5">
                    {[
                      { icon: Type,     label: 'Characters typed',   value: charsTyped.toLocaleString()   },
                      { icon: Trash2,   label: 'Characters deleted',  value: charsDeleted.toLocaleString() },
                      { icon: Undo2,    label: 'Undo count',          value: undoCount.toString()          },
                      { icon: Activity, label: 'Tab switches',        value: tabSwitches.toString()        },
                      { icon: Clock,    label: 'Words (approx)',       value: Math.floor(currentDocLength / 5.5).toLocaleString() },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Icon size={11} className="text-[#AABED6]" />
                          <span className="text-[11px] text-[#AABED6]">{label}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-white">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Writing signals */}
                  <p className="text-[10px] text-[#AABED6] uppercase tracking-widest">Writing Signals</p>

                  {/* Revision depth */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-3">
                    <div className="flex justify-between">
                      <span className="text-[11px] text-white font-medium">Revision Depth</span>
                      <span className="text-[11px] font-bold text-[#AABED6]">
                        {Math.round(revisionDepth * 100)}%
                      </span>
                    </div>
                    <ScoreBar
                      value={Math.min(revisionDepth * 2.5, 1)}
                      color={revisionDepth > 0.05 ? '#AABED6' : '#f59e0b'}
                    />
                    <p className="text-[10px] text-white/40 mt-1">
                      {revisionDepth < 0.02
                        ? 'Very low — healthy writing revises more'
                        : revisionDepth < 0.15
                        ? 'Good — shows active editing'
                        : 'High — strong evidence of original thought'}
                    </p>
                  </div>

                  {/* Organic ratio */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-3">
                    <div className="flex justify-between">
                      <span className="text-[11px] text-white font-medium">Organic Writing</span>
                      <span className="text-[11px] font-bold text-emerald-400">
                        {Math.round(organicRatio * 100)}%
                      </span>
                    </div>
                    <ScoreBar
                      value={organicRatio}
                      color={organicRatio > 0.7 ? '#16a34a' : organicRatio > 0.4 ? '#f59e0b' : '#ef4444'}
                    />
                  </div>

                  {/* Keystroke rhythm */}
                  {ikdResult && ikdFormatted && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-3">
                      <div className="flex justify-between">
                        <span className="text-[11px] text-white font-medium">Typing Rhythm</span>
                        <span className="text-[11px] font-bold" style={{ color: ikdFormatted.color }}>
                          {ikdFormatted.label}
                        </span>
                      </div>
                      <ScoreBar value={ikdResult.score} color={ikdFormatted.color} />
                      <p className="text-[10px] text-white/40 mt-1">{ikdFormatted.detail}</p>
                      {ikdResult.burstPatternCount > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                          <AlertTriangle size={9} className="text-amber-400" />
                          <p className="text-[10px] text-amber-300">
                            {ikdResult.burstPatternCount} read-then-type burst{ikdResult.burstPatternCount > 1 ? 's' : ''} detected
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-[#2D4E71]/20 rounded-xl border border-[#2D4E71]/30">
                    <Info size={11} className="text-[#AABED6] mt-0.5 shrink-0" />
                    <p className="text-[10px] text-[#AABED6] leading-relaxed">
                      These analytics are visible to you only. Your lecturer sees a summary after submission.
                    </p>
                  </div>

                </div>
              )}

              {/* ── PASTES ── */}
              {activeSection === 'pastes' && (
                <div className="px-4 pt-4 pb-6">
                  {pasteItems.length === 0 ? (
                    <div className="text-center py-10 text-white/30 text-xs">
                      No paste events yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-[#AABED6] uppercase tracking-widest mb-3">
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
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
