'use client'

// ResizableImage — TipTap extension that replaces the default Image extension
// with a custom NodeView that supports:
//   • Corner/edge drag-to-resize
//   • Alignment toolbar (float-left, center, float-right, full-width)
//   • Keyboard-accessible width input when selected

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react'
import React, { useRef, useCallback, useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ImageAlign = 'left' | 'center' | 'right' | 'full'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setResizableImage: (options: { src: string; alt?: string; title?: string }) => ReturnType
    }
  }
}

// ─── NodeView React component ─────────────────────────────────────────────────

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, title, width, align } = node.attrs as {
    src: string; alt?: string; title?: string
    width: number; align: ImageAlign
  }

  const dragStart     = useRef<{ x: number; w: number } | null>(null)
  const [localW, setLocalW] = useState<number>(width || 400)

  // Sync local width when attrs change (e.g. undo/redo)
  useEffect(() => { setLocalW(width || 400) }, [width])

  const onMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragStart.current = { x: e.clientX, w: localW }

    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return
      const newW = Math.max(80, Math.min(900, dragStart.current.w + ev.clientX - dragStart.current.x))
      setLocalW(newW)
    }
    const onUp = (ev: MouseEvent) => {
      if (!dragStart.current) return
      const finalW = Math.max(80, Math.min(900, dragStart.current.w + ev.clientX - dragStart.current.x))
      updateAttributes({ width: finalW })
      dragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [localW, updateAttributes])

  const setAlign = (a: ImageAlign) => updateAttributes({ align: a })

  // Container styles by alignment
  const containerStyle: React.CSSProperties = (() => {
    if (align === 'left')  return { float: 'left',  marginRight: '1em', marginBottom: '0.5em', display: 'block' }
    if (align === 'right') return { float: 'right', marginLeft:  '1em', marginBottom: '0.5em', display: 'block' }
    if (align === 'full')  return { display: 'block', width: '100%', marginBottom: '0.5em' }
    return { display: 'block', marginLeft: 'auto', marginRight: 'auto', marginBottom: '0.5em' } // center
  })()

  const imgWidth = align === 'full' ? '100%' : `${localW}px`

  const ALIGN_OPTS: { key: ImageAlign; icon: string; title: string }[] = [
    { key: 'left',   icon: '⬅', title: 'Float left'   },
    { key: 'center', icon: '⬛', title: 'Center'        },
    { key: 'right',  icon: '➡', title: 'Float right'  },
    { key: 'full',   icon: '↔', title: 'Full width'   },
  ]

  return (
    <NodeViewWrapper
      as="div"
      style={{ ...containerStyle, position: 'relative', display: 'inline-block', lineHeight: 0 }}
      data-drag-handle
    >
      {/* Image itself — eslint-disable-next-line: TipTap NodeView cannot use next/image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ''}
        title={title ?? ''}
        style={{
          width:         imgWidth,
          height:        'auto',
          display:       'block',
          borderRadius:  '4px',
          outline:       selected ? '2px solid #2D4E71' : 'none',
          outlineOffset: '2px',
          userSelect:    'none',
        }}
        draggable={false}
      />

      {/* Resize handle (bottom-right corner) */}
      {selected && align !== 'full' && (
        <div
          onMouseDown={onMouseDownResize}
          title="Drag to resize"
          style={{
            position:        'absolute',
            bottom:          0,
            right:           0,
            width:           14,
            height:          14,
            background:      '#2D4E71',
            borderRadius:    '2px 0 4px 0',
            cursor:          'se-resize',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M7 1L1 7M7 4L4 7M7 7L7 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}

      {/* Alignment toolbar — appears above image when selected */}
      {selected && (
        <div
          contentEditable={false}
          style={{
            position:      'absolute',
            top:           -36,
            left:          '50%',
            transform:     'translateX(-50%)',
            display:       'flex',
            gap:           4,
            background:    'white',
            border:        '1px solid rgba(185,182,173,0.4)',
            borderRadius:  10,
            padding:       '3px 6px',
            boxShadow:     '0 2px 8px rgba(0,0,0,0.12)',
            zIndex:        100,
            whiteSpace:    'nowrap',
          }}
        >
          {ALIGN_OPTS.map(opt => (
            <button
              key={opt.key}
              onMouseDown={e => { e.preventDefault(); setAlign(opt.key) }}
              title={opt.title}
              style={{
                padding:      '2px 6px',
                border:       'none',
                borderRadius: 6,
                cursor:       'pointer',
                fontSize:     12,
                background:   align === opt.key ? '#2D4E71' : 'transparent',
                color:        align === opt.key ? 'white' : '#6b7280',
              }}
            >
              {opt.icon}
            </button>
          ))}
          {align !== 'full' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderLeft: '1px solid #e5e7eb', paddingLeft: 6, marginLeft: 2 }}>
              <span style={{ fontSize: 10, color: '#B9B6AD' }}>W:</span>
              <input
                type="number"
                value={localW}
                min={80}
                max={900}
                step={10}
                onMouseDown={e => e.stopPropagation()}
                onChange={e => {
                  const v = parseInt(e.target.value)
                  if (!isNaN(v)) { setLocalW(v); updateAttributes({ width: v }) }
                }}
                style={{
                  width:        50,
                  fontSize:     10,
                  border:       '1px solid #e5e7eb',
                  borderRadius: 4,
                  padding:      '1px 4px',
                  textAlign:    'center',
                }}
              />
              <span style={{ fontSize: 10, color: '#B9B6AD' }}>px</span>
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
}

// ─── TipTap Extension ─────────────────────────────────────────────────────────

export const ResizableImage = Node.create({
  name:    'resizableImage',
  group:   'block',
  inline:  false,
  atom:    true,
  draggable: true,

  addAttributes() {
    return {
      src:   { default: null },
      alt:   { default: null },
      title: { default: null },
      width: { default: 400 },
      align: { default: 'center' },
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { align, width, ...rest } = HTMLAttributes
    const style = align === 'full' ? 'width:100%;display:block;'
      : align === 'left'  ? `width:${width}px;float:left;margin-right:1em;`
      : align === 'right' ? `width:${width}px;float:right;margin-left:1em;`
      : `width:${width}px;display:block;margin:auto;`
    return ['img', mergeAttributes(rest, { style, 'data-align': align })]
  },

  addCommands() {
    return {
      setResizableImage: (options) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { ...options, width: 400, align: 'center' },
        })
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})
