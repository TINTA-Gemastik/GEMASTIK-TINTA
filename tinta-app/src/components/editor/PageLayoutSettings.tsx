'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LayoutSettings {
  marginPx:    number   // all sides uniform (default 96)
  paperWidth:  number   // default 816 (Letter)
  paperHeight: number   // default 1056 (Letter)
  zoom:        number   // 0.75 – 1.25, default 1.0
}

export const DEFAULT_LAYOUT: LayoutSettings = {
  marginPx:    96,
  paperWidth:  816,
  paperHeight: 1056,
  zoom:        1.0,
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const MARGIN_PRESETS = [
  { label: 'Normal (96px / 2.54cm all sides)',   value: 96  },
  { label: 'Narrow (48px / 1.27cm all sides)',   value: 48  },
  { label: 'Moderate (72px / 1.91cm all sides)', value: 72  },
  { label: 'Wide (128px / 3.18cm all sides)',    value: 128 },
  { label: 'Custom…',                            value: -1  },
]

const PAPER_PRESETS = [
  { label: 'Letter (216 × 279mm)', width: 816,  height: 1056 },
  { label: 'A4 (210 × 297mm)',     width: 794,  height: 1123 },
  { label: 'A3 (297 × 420mm)',     width: 1123, height: 1587 },
]

const ZOOM_LEVELS = [0.75, 0.90, 1.0, 1.10, 1.25]

// ─── Props ────────────────────────────────────────────────────────────────────

interface PageLayoutSettingsProps {
  layout:   LayoutSettings
  onChange: (layout: LayoutSettings) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PageLayoutSettings({ layout, onChange }: PageLayoutSettingsProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customTop,    setCustomTop]    = useState('2.54')
  const [customBottom, setCustomBottom] = useState('2.54')
  const [customLeft,   setCustomLeft]   = useState('2.54')
  const [customRight,  setCustomRight]  = useState('2.54')

  const handleMarginChange = (val: string) => {
    const n = parseInt(val)
    if (n === -1) { setShowCustom(true); return }
    onChange({ ...layout, marginPx: n })
  }

  const handlePaperChange = (idx: string) => {
    const p = PAPER_PRESETS[parseInt(idx)]
    if (p) onChange({ ...layout, paperWidth: p.width, paperHeight: p.height })
  }

  const applyCustom = () => {
    const topCm = parseFloat(customTop) || 2.54
    onChange({ ...layout, marginPx: Math.round(topCm * 37.8) })
    setShowCustom(false)
  }

  const marginValue = MARGIN_PRESETS.find(m => m.value === layout.marginPx) ? layout.marginPx : -1
  const paperIdx    = PAPER_PRESETS.findIndex(p => p.width === layout.paperWidth && p.height === layout.paperHeight)

  const selectCls = 'text-[11px] bg-white border border-[#B9B6AD]/40 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-[#2D4E71] cursor-pointer text-[#111111]'

  return (
    <>
      {/* Settings strip */}
      <div className="shrink-0 h-9 flex items-center gap-6 px-6 bg-[#f0f0f0] border-b border-[#B9B6AD]/30">

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#B9B6AD] font-medium whitespace-nowrap">Margins:</span>
          <select className={selectCls} value={marginValue} onChange={e => handleMarginChange(e.target.value)}>
            {MARGIN_PRESETS.map((p, i) => <option key={i} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#B9B6AD] font-medium whitespace-nowrap">Paper:</span>
          <select className={selectCls} value={paperIdx >= 0 ? paperIdx : 0} onChange={e => handlePaperChange(e.target.value)}>
            {PAPER_PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#B9B6AD] font-medium whitespace-nowrap">Zoom:</span>
          <select className={selectCls} value={layout.zoom} onChange={e => onChange({ ...layout, zoom: parseFloat(e.target.value) })}>
            {ZOOM_LEVELS.map(z => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
          </select>
        </div>

      </div>

      {/* Custom margins modal */}
      <AnimatePresence>
        {showCustom && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
              onClick={() => setShowCustom(false)}
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div className="pointer-events-auto w-72 bg-white rounded-2xl shadow-2xl border border-[#B9B6AD]/15 p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-[#111111]">Custom Margins</p>
                  <button onClick={() => setShowCustom(false)} className="text-[#B9B6AD] hover:text-[#111111] transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { label: 'Top',    val: customTop,    set: setCustomTop    },
                    { label: 'Bottom', val: customBottom, set: setCustomBottom },
                    { label: 'Left',   val: customLeft,   set: setCustomLeft   },
                    { label: 'Right',  val: customRight,  set: setCustomRight  },
                  ] as const).map(({ label, val, set }) => (
                    <div key={label}>
                      <label className="block text-[10px] text-[#B9B6AD] mb-1">{label} (cm)</label>
                      <input
                        type="number" step="0.1" min="0.5" max="10"
                        value={val}
                        onChange={e => (set as (v: string) => void)(e.target.value)}
                        className="w-full text-xs border border-[#B9B6AD]/40 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#2D4E71] text-[#111111]"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[#B9B6AD] mt-2">Top margin applied uniformly for MVP.</p>
                <button
                  onClick={applyCustom}
                  className="w-full mt-3 py-2 rounded-xl bg-[#2D4E71] text-white text-sm font-medium hover:bg-[#1e3a56] transition-colors"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
