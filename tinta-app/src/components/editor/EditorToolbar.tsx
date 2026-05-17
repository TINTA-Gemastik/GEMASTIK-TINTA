'use client'

import { useEffect, useState } from 'react'
import { type Editor } from '@tiptap/react'
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered,
  Highlighter,
  Undo2, Redo2,
  Minus, Plus,
  Quote, ImageIcon,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_SIZE = 8
const MAX_SIZE = 96

const FONTS: { label: string; value: string }[] = [
  { label: 'Default (DM Sans)',     value: '' },
  { label: 'Serif (Playfair)',      value: 'var(--font-playfair), Georgia, serif' },
  { label: 'Monospace',             value: '"Courier New", Courier, monospace' },
  { label: 'Arial',                 value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman',       value: '"Times New Roman", Times, serif' },
]

// ─────────────────────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [fontSize, setFontSize] = useState(14)
  const [sizeInput, setSizeInput] = useState('14')

  // Keep displayed size in sync with selection
  useEffect(() => {
    if (!editor) return
    const sync = () => {
      const raw = editor.getAttributes('textStyle').fontSize as string | undefined
      const n   = raw ? parseInt(raw) : 14
      if (!isNaN(n)) {
        setFontSize(n)
        setSizeInput(String(n))
      }
    }
    editor.on('selectionUpdate', sync)
    editor.on('transaction',     sync)
    return () => {
      editor.off('selectionUpdate', sync)
      editor.off('transaction',     sync)
    }
  }, [editor])

  if (!editor) return null

  // ── Helpers ──────────────────────────────────────────────────────────────

  const applySize = (size: number) => {
    const clamped = Math.min(MAX_SIZE, Math.max(MIN_SIZE, size))
    setFontSize(clamped)
    setSizeInput(String(clamped))
    editor.chain().focus().setMark('textStyle', { fontSize: `${clamped}px` }).run()
  }

  const commitSizeInput = () => {
    const n = parseInt(sizeInput)
    if (!isNaN(n)) applySize(n)
    else setSizeInput(String(fontSize))
  }

  // Returns className string for a toolbar button
  const btn = (active: boolean, disabled = false) =>
    [
      'w-8 h-8 flex items-center justify-center rounded-lg transition-colors select-none',
      active   ? 'bg-[#2D4E71]/10 text-[#2D4E71]'           : 'text-[#111111]/60 hover:bg-[#AABED6]/20',
      disabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
    ].join(' ')

  const currentFont = (editor.getAttributes('textStyle').fontFamily as string | undefined) ?? ''
  const currentColor = (editor.getAttributes('textStyle').color as string | undefined) ?? '#111111'

  const headingLevel =
    editor.isActive('heading', { level: 1 }) ? '1' :
    editor.isActive('heading', { level: 2 }) ? '2' :
    editor.isActive('heading', { level: 3 }) ? '3' : '0'

  return (
    <div className="editor-toolbar bg-white border-b border-[#B9B6AD]/20 px-4 py-2 flex items-center gap-1 flex-wrap shadow-sm">

      {/* GROUP 1 — Font family ─────────────────────────────────────────────── */}
      <select
        className="border border-[#B9B6AD]/40 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-[#2D4E71] min-w-[130px] cursor-pointer text-[#111111]"
        value={currentFont}
        onChange={e => {
          if (e.target.value) {
            editor.chain().focus().setFontFamily(e.target.value).run()
          } else {
            editor.chain().focus().unsetFontFamily().run()
          }
        }}
      >
        {FONTS.map(f => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <Divider />

      {/* GROUP 2 — Font size ──────────────────────────────────────────────── */}
      <button className={btn(false)} onClick={() => applySize(fontSize - 1)} title="Kecilkan font">
        <Minus size={13} />
      </button>
      <input
        type="text"
        className="w-10 text-center text-xs border border-[#B9B6AD]/40 rounded-lg py-1 focus:outline-none focus:border-[#2D4E71] text-[#111111]"
        value={sizeInput}
        onChange={e => setSizeInput(e.target.value)}
        onBlur={commitSizeInput}
        onKeyDown={e => { if (e.key === 'Enter') commitSizeInput() }}
      />
      <button className={btn(false)} onClick={() => applySize(fontSize + 1)} title="Besarkan font">
        <Plus size={13} />
      </button>

      <Divider />

      {/* GROUP 3 — Text formatting ────────────────────────────────────────── */}
      <button
        className={btn(editor.isActive('bold'))}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Tebal (Ctrl+B)"
      >
        <Bold size={15} />
      </button>
      <button
        className={btn(editor.isActive('italic'))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Miring (Ctrl+I)"
      >
        <Italic size={15} />
      </button>
      <button
        className={btn(editor.isActive('underline'))}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Garis bawah (Ctrl+U)"
      >
        <Underline size={15} />
      </button>
      <button
        className={btn(editor.isActive('strike'))}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Coret"
      >
        <Strikethrough size={15} />
      </button>

      <Divider />

      {/* GROUP 4 — Text alignment ─────────────────────────────────────────── */}
      <button
        className={btn(editor.isActive({ textAlign: 'left' }))}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        title="Rata kiri"
      >
        <AlignLeft size={15} />
      </button>
      <button
        className={btn(editor.isActive({ textAlign: 'center' }))}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        title="Rata tengah"
      >
        <AlignCenter size={15} />
      </button>
      <button
        className={btn(editor.isActive({ textAlign: 'right' }))}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        title="Rata kanan"
      >
        <AlignRight size={15} />
      </button>
      <button
        className={btn(editor.isActive({ textAlign: 'justify' }))}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        title="Rata penuh"
      >
        <AlignJustify size={15} />
      </button>

      <Divider />

      {/* GROUP 5 — Lists ──────────────────────────────────────────────────── */}
      <button
        className={btn(editor.isActive('bulletList'))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Daftar tak berurut"
      >
        <List size={15} />
      </button>
      <button
        className={btn(editor.isActive('orderedList'))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Daftar berurut"
      >
        <ListOrdered size={15} />
      </button>

      <Divider />

      {/* GROUP 6 — Color & Highlight ──────────────────────────────────────── */}
      <label
        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer text-[#111111]/60 hover:bg-[#AABED6]/20 transition-colors select-none relative"
        title="Warna teks"
      >
        <span className="text-sm font-bold" style={{ color: currentColor, textDecoration: 'underline' }}>
          A
        </span>
        <input
          type="color"
          className="sr-only"
          value={currentColor}
          onChange={e => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>

      <label
        className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors select-none relative ${
          editor.isActive('highlight') ? 'bg-[#2D4E71]/10 text-[#2D4E71]' : 'text-[#111111]/60 hover:bg-[#AABED6]/20'
        }`}
        title="Sorot teks"
      >
        <Highlighter size={15} />
        <input
          type="color"
          className="sr-only"
          defaultValue="#fef08a"
          onChange={e => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
        />
      </label>

      <Divider />

      {/* GROUP 7 — Structure ──────────────────────────────────────────────── */}
      <select
        className="border border-[#B9B6AD]/40 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-[#2D4E71] cursor-pointer text-[#111111]"
        value={headingLevel}
        onChange={e => {
          const v = e.target.value
          if (v === '0') editor.chain().focus().setParagraph().run()
          else editor.chain().focus().setHeading({ level: parseInt(v) as 1 | 2 | 3 }).run()
        }}
      >
        <option value="0">Normal</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      <button
        className={btn(editor.isActive('blockquote'))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Kutipan blok"
      >
        <Quote size={15} />
      </button>

      <button
        className={btn(false)}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Garis pemisah"
      >
        <Minus size={15} strokeWidth={2.5} />
      </button>

      <Divider />

      {/* GROUP 8 — History ────────────────────────────────────────────────── */}
      <button
        className={btn(false, !editor.can().undo())}
        onClick={() => editor.chain().focus().undo().run()}
        title="Batalkan (Ctrl+Z)"
      >
        <Undo2 size={15} />
      </button>
      <button
        className={btn(false, !editor.can().redo())}
        onClick={() => editor.chain().focus().redo().run()}
        title="Ulangi (Ctrl+Y)"
      >
        <Redo2 size={15} />
      </button>

      <Divider />

      {/* GROUP 9 — Insert image ───────────────────────────────────────────── */}
      <label
        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer text-[#111111]/60 hover:bg-[#AABED6]/20 transition-colors select-none"
        title="Insert image"
      >
        <ImageIcon size={15} />
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = ev => {
              const src = ev.target?.result as string
              editor.chain().focus().setImage({ src }).run()
            }
            reader.readAsDataURL(file)
            // Reset so same file can be re-selected
            e.target.value = ''
          }}
        />
      </label>

    </div>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-[#B9B6AD]/30 mx-0.5 shrink-0" />
}
