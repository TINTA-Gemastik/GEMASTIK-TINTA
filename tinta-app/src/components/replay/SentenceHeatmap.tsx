'use client'

import { useState, useRef } from 'react'
import type { SentenceAnalysis } from '@/lib/replay/sentenceAnalyzer'

// ─── Heatmap color logic ──────────────────────────────────────────────────────

function sentenceBackground(s: SentenceAnalysis): string {
  // AI likelihood overrides
  if ((s.aiLikelihood ?? 0) > 0.6) return '#fee2e2'   // red tint
  if ((s.aiLikelihood ?? 1) < 0.2 && s.revisionCount > 2) return '#dcfce7'  // green tint

  // Revision-count heat
  if (s.revisionCount >= 6) return '#fbbf24'   // strong amber
  if (s.revisionCount >= 3) return '#fde68a'   // amber
  if (s.revisionCount >= 1) return '#fef9c3'   // light yellow
  return 'transparent'
}

// ─── Tooltip card ─────────────────────────────────────────────────────────────

interface TooltipProps {
  sentence: SentenceAnalysis
  x: number
  y: number
}

function SentenceTooltip({ sentence, x, y }: TooltipProps) {
  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div
      className="fixed z-50 bg-white border border-[#B9B6AD]/30 rounded-xl shadow-xl p-3 text-xs w-56 pointer-events-none"
      style={{ left: Math.min(x, window.innerWidth - 240), top: Math.max(y - 110, 8) }}
    >
      <p className="font-semibold text-[#111111] mb-1.5 leading-snug line-clamp-2">
        &quot;{sentence.sentence.slice(0, 60)}{sentence.sentence.length > 60 ? '…' : ''}&quot;
      </p>
      <div className="space-y-0.5 text-[#6b7280]">
        <p>First typed: <span className="text-[#111111] font-medium">{fmt(sentence.firstTypedAt)}</span></p>
        <p>Last edited: <span className="text-[#111111] font-medium">{fmt(sentence.lastModifiedAt)}</span></p>
        <p>Revisions: <span className="text-[#111111] font-medium">{sentence.revisionCount}</span></p>
        <p>Chars modified: <span className="text-[#111111] font-medium">{sentence.totalCharsModified}</span></p>
        {sentence.aiLikelihood != null && (
          <p>
            AI likelihood:{' '}
            <span className={`font-medium ${sentence.aiLikelihood > 0.6 ? 'text-red-600' : 'text-emerald-600'}`}>
              {Math.round(sentence.aiLikelihood * 100)}%
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SentenceHeatmapProps {
  sentences:         SentenceAnalysis[]
  onSentenceClick?:  (sentence: SentenceAnalysis) => void
}

// ─── SentenceHeatmap component ────────────────────────────────────────────────

export function SentenceHeatmap({ sentences, onSentenceClick }: SentenceHeatmapProps) {
  const [hovered, setHovered] = useState<{ sentence: SentenceAnalysis; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  if (sentences.length === 0) {
    return (
      <p className="text-sm text-[#B9B6AD] italic">No sentences to display.</p>
    )
  }

  return (
    <div ref={containerRef} className="relative leading-relaxed text-sm text-[#111111] font-[var(--font-dm-sans)]">
      {sentences.map((s, i) => (
        <span
          key={i}
          className="rounded transition-colors duration-150 cursor-pointer"
          style={{ backgroundColor: sentenceBackground(s), padding: '1px 2px' }}
          onMouseEnter={e => {
            const rect = (e.target as HTMLElement).getBoundingClientRect()
            setHovered({ sentence: s, x: rect.left, y: rect.top })
          }}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSentenceClick?.(s)}
        >
          {s.sentence}
          {i < sentences.length - 1 ? ' ' : ''}
        </span>
      ))}

      {hovered && (
        <SentenceTooltip
          sentence={hovered.sentence}
          x={hovered.x}
          y={hovered.y}
        />
      )}
    </div>
  )
}
