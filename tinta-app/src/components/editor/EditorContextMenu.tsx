'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { BookMarked, Copy, Scissors, Bold, Italic } from 'lucide-react'
import type { Editor } from '@tiptap/react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x:            number
  y:            number
  selectedText: string
  editor:       Editor | null
  onClose:      () => void
  onAddReference: (text: string) => void
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function MenuItem({
  icon: Icon, label, onClick, divider, color,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  label:    string
  onClick:  () => void
  divider?: boolean
  color?:   string
}) {
  return (
    <>
      {divider && <div className="h-px bg-[#B9B6AD]/20 my-1" />}
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#AABED6]/15 rounded-lg transition-colors"
      >
        <Icon size={13} className={color ?? 'text-[#B9B6AD]'} />
        <span className="text-xs text-[#111111]">{label}</span>
      </button>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EditorContextMenu({
  x, y, selectedText, editor, onClose, onAddReference,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const safeX = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth  : 1200) - 224)
  const safeY = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 900)  - 320)

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.12 }}
      style={{ position: 'fixed', top: safeY, left: safeX, zIndex: 1000 }}
      className="w-52 bg-white rounded-xl shadow-2xl border border-[#B9B6AD]/30 p-1.5"
    >
      {/* Selected text preview */}
      {selectedText && (
        <div className="px-3 py-2 mb-1 bg-[#f7f7f6] rounded-lg">
          <p className="text-[10px] text-[#B9B6AD] truncate">
            &quot;{selectedText.length > 40 ? selectedText.slice(0, 40) + '…' : selectedText}&quot;
          </p>
        </div>
      )}

      <MenuItem icon={Copy}    label="Copy"   onClick={() => { document.execCommand('copy');  onClose() }} />
      <MenuItem icon={Scissors} label="Cut"   onClick={() => { document.execCommand('cut');   onClose() }} />
      <MenuItem icon={Bold}    label="Bold"   divider onClick={() => { editor?.chain().focus().toggleBold().run();   onClose() }} />
      <MenuItem icon={Italic}  label="Italic" onClick={() => { editor?.chain().focus().toggleItalic().run(); onClose() }} />

      {selectedText && (
        <MenuItem
          icon={BookMarked}
          label="Add Reference"
          onClick={() => onAddReference(selectedText)}
          divider
          color="text-[#2D4E71]"
        />
      )}
    </motion.div>
  )
}
