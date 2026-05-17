'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookMarked, Check, Upload, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReferenceSourceData {
  title:  string
  author: string
  url:    string
  year:   string
}

interface ReferencePopoverProps {
  sentenceText: string
  position:     { top: number; left: number }
  onSave:       (source: ReferenceSourceData) => void
  onDismiss:    () => void
}

// ─────────────────────────────────────────────────────────────────────────────

export function ReferencePopover({
  sentenceText,
  position,
  onSave,
  onDismiss,
}: ReferencePopoverProps) {
  const [source, setSource] = useState<ReferenceSourceData>({
    title: '', author: '', url: '', year: '',
  })
  const [saved,     setSaved]     = useState(false)
  const [fileName,  setFileName]  = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  const POPOVER_W = 320
  const left = Math.min(position.left, (typeof window !== 'undefined' ? window.innerWidth : 1024) - POPOVER_W - 16)
  const top  = position.top + 8

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  // Close on click outside (100ms delay so the opening click doesn't close it)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onDismiss()
      }
    }
    const id = setTimeout(() => document.addEventListener('mousedown', onClick), 100)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onClick)
    }
  }, [onDismiss])

  const handleSave = () => {
    if (!canSave) return
    onSave(source)
    setSaved(true)
    setTimeout(onDismiss, 1200)
  }

  const inputCls =
    'w-full text-xs border border-[#B9B6AD]/40 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#2D4E71] text-[#111111] placeholder-[#B9B6AD] bg-white'

  const canSave = source.title.trim().length > 0

  return (
    <motion.div
      ref={popoverRef}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-[#B9B6AD]/20 overflow-hidden"
      style={{ top, left, width: POPOVER_W }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#B9B6AD]/15">
        <div className="flex items-center gap-2">
          <BookMarked size={13} className="text-[#2D4E71]" />
          <p className="text-xs font-semibold text-[#2D4E71]">Add Reference</p>
        </div>
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
          "{sentenceText.length > 60 ? sentenceText.slice(0, 57) + '…' : sentenceText}"
        </p>
      </div>

      {/* Saved state */}
      <AnimatePresence mode="wait">
        {saved ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-4 py-5 flex flex-col items-center gap-2"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check size={18} className="text-emerald-600" />
            </div>
            <p className="text-xs font-medium text-emerald-700">Reference saved</p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 py-3 space-y-2"
          >
            <input
              type="text"
              placeholder="Title *"
              value={source.title}
              onChange={e => setSource(s => ({ ...s, title: e.target.value }))}
              className={inputCls}
              autoFocus
            />
            <input
              type="text"
              placeholder="Author"
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
                placeholder="Year"
                value={source.year}
                onChange={e => setSource(s => ({ ...s, year: e.target.value }))}
                className={`${inputCls} w-20 shrink-0`}
              />
            </div>
            {/* Upload source file (placeholder) */}
            <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-dashed border-[#AABED6] hover:bg-[#AABED6]/10 cursor-pointer transition-colors">
              <Upload size={11} className="text-[#2D4E71]" />
              <span className="text-[11px] text-[#2D4E71]">
                {fileName || 'Upload source file (PDF, image)'}
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={e => setFileName(e.target.files?.[0]?.name ?? '')}
              />
            </label>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={!canSave}
              className="w-full text-xs font-medium bg-[#2D4E71] hover:bg-[#213a56] text-white px-3 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-1"
            >
              Save Reference
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
