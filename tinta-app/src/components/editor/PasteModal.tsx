'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Clipboard, FileText, BookOpen, StickyNote, X, ExternalLink } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PasteSourceData {
  title:  string
  author: string
  url:    string
  year:   string
}

interface PasteModalProps {
  pastedText:   string
  pasteEventId: string
  onDeclare: (
    pasteEventId: string,
    declaredType: string,
    sourceData?: PasteSourceData
  ) => void
  onDismiss: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PASTE_TYPES = [
  {
    id:          'citation',
    label:       'Citation / Source',
    description: 'Quoted from a book, article, or website',
    icon:        BookOpen,
  },
  {
    id:          'own_text',
    label:       'My Own Writing',
    description: 'Written by me in another document',
    icon:        FileText,
  },
  {
    id:          'personal_note',
    label:       'Personal Note',
    description: 'Scratch notes or brainstorm',
    icon:        StickyNote,
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────

export function PasteModal({ pastedText, pasteEventId, onDeclare, onDismiss }: PasteModalProps) {
  const [selected,   setSelected]   = useState<string | null>(null)
  const [showSource, setShowSource] = useState(false)
  const [source, setSource] = useState<PasteSourceData>({
    title: '', author: '', url: '', year: '',
  })

  const preview = pastedText.length > 120
    ? pastedText.slice(0, 117) + '…'
    : pastedText

  const handleSubmit = () => {
    if (!selected) return
    const needsSource = selected === 'citation'
    onDeclare(
      pasteEventId,
      selected,
      needsSource && source.title ? source : undefined
    )
  }

  const inputCls =
    'w-full text-xs border border-[#B9B6AD]/40 rounded-lg px-3 py-2 focus:outline-none focus:border-[#2D4E71] text-[#111111] placeholder-[#B9B6AD] bg-white'

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]"
        onClick={onDismiss}
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#B9B6AD]/15 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#B9B6AD]/15">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#2D4E71]/10 flex items-center justify-center">
                <Clipboard size={15} className="text-[#2D4E71]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111111]">Pasted Text Detected</p>
                <p className="text-[10px] text-[#B9B6AD]">Please declare the source of this paste</p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="text-[#B9B6AD] hover:text-[#111111] transition-colors p-1 rounded-lg hover:bg-[#F8F7F5]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Paste preview */}
          <div className="mx-5 mt-4 px-3 py-2.5 bg-[#F8F7F5] rounded-xl border border-[#B9B6AD]/15">
            <p className="text-[10px] text-[#B9B6AD] mb-1 font-medium uppercase tracking-wide">Pasted content</p>
            <p className="text-xs text-[#111111]/70 leading-relaxed line-clamp-3">{preview}</p>
          </div>

          {/* Type selection */}
          <div className="px-5 pt-4 pb-2 space-y-2">
            <p className="text-xs font-medium text-[#B9B6AD]">What is this?</p>
            {PASTE_TYPES.map(({ id, label, description, icon: Icon }) => (
              <motion.button
                key={id}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelected(id)
                  setShowSource(id === 'citation')
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                  selected === id
                    ? 'border-[#2D4E71] bg-[#2D4E71]/5 ring-1 ring-[#2D4E71]/20'
                    : 'border-[#B9B6AD]/30 hover:border-[#2D4E71]/40 hover:bg-[#F8F7F5]'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  selected === id ? 'bg-[#2D4E71]/15' : 'bg-[#F8F7F5]'
                }`}>
                  <Icon size={14} className={selected === id ? 'text-[#2D4E71]' : 'text-[#B9B6AD]'} />
                </div>
                <div>
                  <p className={`text-xs font-medium ${selected === id ? 'text-[#2D4E71]' : 'text-[#111111]'}`}>
                    {label}
                  </p>
                  <p className="text-[10px] text-[#B9B6AD]">{description}</p>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Source form (citation only) */}
          <AnimatePresence>
            {showSource && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="px-5 pt-1 pb-2 space-y-2 border-t border-[#B9B6AD]/10 mt-2">
                  <div className="flex items-center gap-1.5 pt-2">
                    <ExternalLink size={11} className="text-[#B9B6AD]" />
                    <p className="text-[10px] font-medium text-[#B9B6AD] uppercase tracking-wide">
                      Source details (optional)
                    </p>
                  </div>
                  <input
                    type="text"
                    placeholder="Title"
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
                      placeholder="URL or DOI"
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[#B9B6AD]/10 flex items-center justify-between gap-3">
            <button
              onClick={onDismiss}
              className="text-xs text-[#B9B6AD] hover:text-[#111111] transition-colors px-3 py-2 rounded-lg hover:bg-[#F8F7F5]"
            >
              Skip for now
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={!selected}
              className="text-xs font-semibold bg-[#2D4E71] hover:bg-[#213a56] text-white px-5 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
