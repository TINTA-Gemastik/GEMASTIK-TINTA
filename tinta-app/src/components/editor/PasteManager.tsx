'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Upload,
  BookOpen, FileText, StickyNote,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { PasteItem } from './TintaEditor'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PasteManagerProps {
  pasteItems:     PasteItem[]
  onPasteUpdated: (id: string, updates: Partial<PasteItem>) => void
}

interface EditState {
  type:     string
  title:    string
  author:   string
  url:      string
  year:     string
  fileName: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'citation',  label: 'Citation from source', icon: BookOpen  },
  { value: 'own_text',  label: 'My own text',           icon: FileText  },
  { value: 'notes',     label: 'Personal notes',        icon: StickyNote },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function PasteManager({ pasteItems, onPasteUpdated }: PasteManagerProps) {
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [editStates,  setEditStates]  = useState<Record<string, EditState>>({})

  const undeclaredCount = pasteItems.filter(p => !p.declared_type).length

  const getEdit = (item: PasteItem): EditState =>
    editStates[item.id] ?? {
      type:     item.declared_type ?? '',
      title:    item.source_title  ?? '',
      author:   item.source_author ?? '',
      url:      item.source_url    ?? '',
      year:     item.source_year   ?? '',
      fileName: '',
    }

  const setField = (id: string, item: PasteItem, field: keyof EditState, val: string) => {
    setEditStates(prev => ({ ...prev, [id]: { ...getEdit(item), [field]: val } }))
  }

  const handleSave = async (item: PasteItem) => {
    const state = getEdit(item)
    if (!state.type) return

    const updates: Partial<PasteItem> = {
      declared_type: state.type,
      source_title:  state.title  || null,
      source_author: state.author || null,
      source_url:    state.url    || null,
      source_year:   state.year   || null,
    }

    const supabase = createClient()
    await supabase.from('paste_events').update(updates).eq('id', item.id)

    onPasteUpdated(item.id, updates)
    setExpandedId(null)
  }

  if (pasteItems.length === 0) return null

  return (
    <div className="px-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-[#B9B6AD] uppercase tracking-widest font-medium">
          Paste Details
        </p>
        {undeclaredCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            <AlertCircle size={9} />
            {undeclaredCount} need attention
          </span>
        )}
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {pasteItems.map(item => {
          const isExpanded  = expandedId === item.id
          const editState   = getEdit(item)
          const isDeclared  = !!item.declared_type
          const time        = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

          return (
            <div
              key={item.id}
              className={`rounded-xl border overflow-hidden ${
                isDeclared ? 'border-[#B9B6AD]/20 bg-[#f7f7f6]' : 'border-amber-200 bg-amber-50'
              }`}
            >
              {/* Collapsed row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                  isDeclared ? 'bg-[#2D4E71]/10' : 'bg-amber-200'
                }`}>
                  {isDeclared
                    ? <CheckCircle size={11} className="text-[#2D4E71]" />
                    : <AlertCircle size={11} className="text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[#111111] truncate">
                    &quot;{item.pasted_text.slice(0, 35)}…&quot;
                  </p>
                  <p className="text-[10px] text-[#B9B6AD]">
                    {item.pasted_char_count} chars · {time}
                    {isDeclared ? ` · ${item.declared_type}` : ' · Needs declaration'}
                  </p>
                </div>
                {isExpanded
                  ? <ChevronUp   size={12} className="text-[#B9B6AD] shrink-0" />
                  : <ChevronDown size={12} className="text-[#B9B6AD] shrink-0" />}
              </button>

              {/* Expanded form */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-2 space-y-2 border-t border-[#B9B6AD]/20">

                      {/* Preview */}
                      <div className="bg-white rounded-lg p-2 border border-[#B9B6AD]/20">
                        <p className="text-[10px] text-[#B9B6AD] font-mono leading-relaxed line-clamp-3">
                          &quot;{item.pasted_text.slice(0, 120)}{item.pasted_text.length > 120 ? '…' : ''}&quot;
                        </p>
                      </div>

                      {/* Type selector */}
                      <div className="space-y-1">
                        {TYPE_OPTIONS.map(opt => {
                          const Icon       = opt.icon
                          const isSelected = editState.type === opt.value
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setField(item.id, item, 'type', opt.value)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                                isSelected
                                  ? 'border-[#2D4E71] bg-[#2D4E71]/5'
                                  : 'border-[#B9B6AD]/30 hover:border-[#AABED6]'
                              }`}
                            >
                              <Icon size={11} className={isSelected ? 'text-[#2D4E71]' : 'text-[#B9B6AD]'} />
                              <span className={`text-[11px] ${isSelected ? 'text-[#2D4E71] font-medium' : 'text-[#111111]'}`}>
                                {opt.label}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Source fields */}
                      {(['title', 'author', 'url', 'year'] as const).map((field, fi) => (
                        <input
                          key={field}
                          type="text"
                          placeholder={['Source title *', 'Author (optional)', 'URL or DOI (optional)', 'Year (optional)'][fi]}
                          value={editState[field]}
                          onChange={e => setField(item.id, item, field, e.target.value)}
                          className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-[#B9B6AD]/40 bg-white focus:outline-none focus:border-[#2D4E71] text-[#111111] placeholder:text-[#B9B6AD]"
                        />
                      ))}

                      {/* Upload placeholder */}
                      <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-dashed border-[#AABED6] hover:bg-[#AABED6]/10 cursor-pointer transition-colors">
                        <Upload size={11} className="text-[#2D4E71]" />
                        <span className="text-[11px] text-[#2D4E71]">
                          {editState.fileName || 'Upload source file (PDF, image)'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          className="hidden"
                          onChange={e => {
                            const name = e.target.files?.[0]?.name ?? ''
                            setField(item.id, item, 'fileName', name)
                          }}
                        />
                      </label>

                      {/* Save */}
                      <button
                        onClick={() => handleSave(item)}
                        disabled={!editState.type}
                        className="w-full py-1.5 rounded-lg bg-[#2D4E71] text-white text-[11px] font-medium hover:bg-[#1e3a56] transition-colors disabled:opacity-40"
                      >
                        Save Declaration
                      </button>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
