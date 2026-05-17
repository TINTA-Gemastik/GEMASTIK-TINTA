'use client'

// ScrubBar — a Premiere-Pro-style draggable scrubber for the TINTA replay page.
// Shows:
//   • A gradient progress track with a draggable thumb
//   • Session segments as color-coded regions underneath the track
//   • Paste event markers as small colored dots on the track
//   • A time tooltip on the thumb while dragging

import React, { useCallback, useRef, useState } from 'react'
import type { Session, PasteEvent } from '@/types'

interface ScrubBarProps {
  firstTs:          number
  lastTs:           number
  currentTimestamp: number
  sessions:         Session[]
  pasteEvents:      PasteEvent[]
  onSeek:           (ts: number) => void
  className?:       string
}

const SESSION_COLORS = ['#2D4E71', '#4a7fa5', '#7aafd4', '#AABED6', '#1e3a56']

function formatTime(ms: number): string {
  const totalS = Math.floor(ms / 1000)
  const h = Math.floor(totalS / 3600)
  const m = Math.floor((totalS % 3600) / 60)
  const s = totalS % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ScrubBar({
  firstTs, lastTs, currentTimestamp,
  sessions, pasteEvents,
  onSeek, className = '',
}: ScrubBarProps) {
  const totalMs   = Math.max(lastTs - firstTs, 1)
  const progress  = Math.max(0, Math.min(1, (currentTimestamp - firstTs) / totalMs))

  const trackRef  = useRef<HTMLDivElement>(null)
  const dragging  = useRef(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipX,    setTooltipX]    = useState(0)
  const [tooltipTime, setTooltipTime] = useState('')

  const tsFromX = useCallback((clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return currentTimestamp
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return firstTs + pct * totalMs
  }, [firstTs, totalMs, currentTimestamp])

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    setShowTooltip(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const ts = tsFromX(e.clientX)
    onSeek(ts)
    setTooltipX(e.clientX)
    setTooltipTime(formatTime(ts - firstTs))
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const clampedX = Math.max(rect.left, Math.min(rect.right, e.clientX))
    const ts = tsFromX(clampedX)
    setTooltipX(clampedX)
    setTooltipTime(formatTime(ts - firstTs))
    if (!dragging.current) return
    onSeek(ts)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    setShowTooltip(false)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  // Keyboard seeking: left/right arrows when track is focused
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? totalMs * 0.05 : totalMs * 0.01
    if (e.key === 'ArrowLeft')  { e.preventDefault(); onSeek(Math.max(firstTs, currentTimestamp - step)) }
    if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(lastTs, currentTimestamp + step)) }
    if (e.key === 'Home')       { e.preventDefault(); onSeek(firstTs) }
    if (e.key === 'End')        { e.preventDefault(); onSeek(lastTs)  }
  }

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ height: 40, paddingTop: 14, paddingBottom: 4, paddingLeft: 8, paddingRight: 8 }}
    >
      {/* Session segments (color bands underneath track) */}
      <div
        style={{
          position: 'absolute', top: 24, left: 8, right: 8, height: 4,
          borderRadius: 2, overflow: 'hidden', background: 'rgba(185,182,173,0.2)',
        }}
      >
        {sessions.map((s, i) => {
          const segStart = (new Date(s.started_at).getTime() - firstTs) / totalMs
          const segEnd   = s.ended_at
            ? (new Date(s.ended_at).getTime() - firstTs) / totalMs
            : 1
          return (
            <div
              key={s.id}
              title={`Session ${i + 1}`}
              style={{
                position: 'absolute',
                left:     `${Math.max(0, segStart) * 100}%`,
                width:    `${Math.max(0, segEnd - segStart) * 100}%`,
                height:   '100%',
                background: SESSION_COLORS[i % SESSION_COLORS.length],
                opacity:  0.5,
              }}
            />
          )
        })}
      </div>

      {/* Main clickable / draggable track */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Playback scrubber"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        style={{
          position:     'relative',
          height:       6,
          borderRadius: 3,
          background:   'rgba(185,182,173,0.25)',
          cursor:       'pointer',
          outline:      'none',
        }}
      >
        {/* Filled portion */}
        <div
          style={{
            position:     'absolute',
            left:         0,
            width:        `${progress * 100}%`,
            height:       '100%',
            borderRadius: 3,
            background:   'linear-gradient(90deg, #2D4E71 0%, #4a7fa5 100%)',
            transition:   dragging.current ? 'none' : 'width 0.05s linear',
          }}
        />

        {/* Paste event markers */}
        {pasteEvents.map(pe => {
          const pct = Math.max(0, Math.min(1, (pe.timestamp - firstTs) / totalMs))
          const isAI = (pe.ai_likelihood ?? 0) > 0.5
          const isUndeclared = !pe.declared_type
          const dotColor = isAI ? '#ef4444' : isUndeclared ? '#f59e0b' : '#16a34a'
          return (
            <div
              key={pe.id}
              title={`Paste at ${formatTime(pe.timestamp - firstTs)}${isAI ? ' (AI-flagged)' : ''}`}
              style={{
                position:     'absolute',
                left:         `${pct * 100}%`,
                top:          '50%',
                transform:    'translate(-50%, -50%)',
                width:        7,
                height:       7,
                borderRadius: '50%',
                background:   dotColor,
                border:       '1.5px solid white',
                zIndex:       2,
                pointerEvents: 'none',
              }}
            />
          )
        })}

        {/* Thumb */}
        <div
          style={{
            position:     'absolute',
            left:         `${progress * 100}%`,
            top:          '50%',
            transform:    'translate(-50%, -50%)',
            width:        14,
            height:       14,
            borderRadius: '50%',
            background:   '#2D4E71',
            border:       '2px solid white',
            boxShadow:    '0 1px 4px rgba(0,0,0,0.2)',
            zIndex:       3,
            transition:   dragging.current ? 'none' : 'left 0.05s linear',
            cursor:       'grab',
          }}
        />
      </div>

      {/* Hover / drag tooltip */}
      {showTooltip && (
        <div
          style={{
            position:      'fixed',
            left:          tooltipX,
            top:           (trackRef.current?.getBoundingClientRect().top ?? 0) - 28,
            transform:     'translateX(-50%)',
            background:    '#2D4E71',
            color:         'white',
            fontSize:      10,
            fontFamily:    'monospace',
            padding:       '2px 6px',
            borderRadius:  6,
            pointerEvents: 'none',
            zIndex:        999,
            whiteSpace:    'nowrap',
          }}
        >
          {tooltipTime}
        </div>
      )}
    </div>
  )
}
