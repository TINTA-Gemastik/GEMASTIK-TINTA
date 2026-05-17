'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SentenceSourceData {
  title:  string
  author: string
  url:    string
  year:   string
}

interface SentencePopoverProps {
  sentenceText: string
  /** Viewport-relative coords for positioning */
  anchorTop:  number
  anchorLeft: number
  onSave:    (source: SentenceSourceData) => void
  onDismiss: () => void
}

// ─────────────────────────────────────────────────────────────────────────────

export function SentencePopover({
  sentenceText,
  anchorTop,
  anchorLeft,
  onSave,
  onDismiss,
}: SentencePopoverProps) {
  const [source, setSource] = useState<SentenceSourceData>({
    title: '', author: '', url: '', year: '',
  })
  const popoverRef = useRef<HTMLDivElement>(null)

  // Clamp position so popover stays within viewport
  const POPOVER_W = 300
  const left = Math.min(anchorLeft, window.innerWidth  - POPOVER_W - 12)
  const top  = anchorTop + 8  // slightly below the anchor

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  // Close on click outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onDismiss()
      }
    }
    // Delay so the opening click doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('mousedown', onClick), 100)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onClick)
    }
  }, [onDismiss])

  const inputCls =
    'w-full text-xs border border-[#B9B6AD]/40 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#2D4E71] text-[#111111] placeholder-[#B9B6AD]'

  const canSave = source.title.trim() && source.author.trim()

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-[#B9B6AD]/20 animate-fade-in"
      style={{ top, left, width: POPOVER_W }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#B9B6AD]/15">
        <p className="text-xs font-semibold text-[#2D4E71]">+ Tambah Referensi</p>
        <button
          onClick={onDismiss}
          className="text-[#B9B6AD] hover:text-[#111111] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Sentence preview */}
      <div className="px-4 py-2 bg-[#F8F7F5] border-b border-[#B9B6AD]/10">
        <p className="text-[10px] text-[#B9B6AD] truncate" title={sentenceText}>
          &quot;{sentenceText.length > 60 ? sentenceText.slice(0, 57) + '…' : sentenceText}&quot;
        </p>
      </div>

      {/* Source form */}
      <div className="px-4 py-3 space-y-2">
        <input
          type="text"
          placeholder="Judul Sumber *"
          value={source.title}
          onChange={e => setSource(s => ({ ...s, title: e.target.value }))}
          className={inputCls}
          autoFocus
        />
        <input
          type="text"
          placeholder="Penulis *"
          value={source.author}
          onChange={e => setSource(s => ({ ...s, author: e.target.value }))}
          className={inputCls}
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="URL / DOI"
            value={source.url}
            onChange={e => setSource(s => ({ ...s, url: e.target.value }))}
            className={inputCls}
          />
          <input
            type="text"
            placeholder="Tahun"
            value={source.year}
            onChange={e => setSource(s => ({ ...s, year: e.target.value }))}
            className={`${inputCls} w-20 shrink-0`}
          />
        </div>
        <button
          onClick={() => canSave && onSave(source)}
          disabled={!canSave}
          className="w-full text-xs font-medium bg-[#2D4E71] hover:bg-[#213a56] active:scale-[0.98] text-white px-3 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-1"
        >
          Simpan Referensi
        </button>
      </div>
    </div>
  )
}
