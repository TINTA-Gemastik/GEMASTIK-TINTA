'use client'

import { AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { GlowButton } from '@/components/ui/glow-button'

interface SubmitConfirmModalProps {
  wordCount:        number
  sessionNumber:    number
  undeclaredPastes: number
  submitting:       boolean
  error:            string | null
  onConfirm:        () => void
  onCancel:         () => void
}

export function SubmitConfirmModal({
  wordCount,
  sessionNumber,
  undeclaredPastes,
  submitting,
  error,
  onConfirm,
  onCancel,
}: SubmitConfirmModalProps) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
        onClick={() => !submitting && onCancel()}
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1,   y: 0  }}
        exit={{ opacity: 0,    scale: 0.95, y: 12 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-[#B9B6AD]/15 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={17} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111111]">Submit Assignment?</p>
                <p className="text-xs text-[#B9B6AD] mt-1 leading-relaxed">
                  You cannot edit your writing after submitting. Session data and analytics will be finalized.
                </p>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="mx-6 mb-3 grid grid-cols-2 gap-2">
            <div className="bg-[#F8F7F5] rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-[#B9B6AD] uppercase tracking-wide">Words</p>
              <p className="text-sm font-bold text-[#111111]">{wordCount.toLocaleString()}</p>
            </div>
            <div className="bg-[#F8F7F5] rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-[#B9B6AD] uppercase tracking-wide">Sessions</p>
              <p className="text-sm font-bold text-[#111111]">{sessionNumber}</p>
            </div>
          </div>

          {/* Undeclared pastes warning */}
          {undeclaredPastes > 0 && (
            <div className="mx-6 mb-3 flex items-center gap-2 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-200">
              <AlertTriangle size={13} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">
                {undeclaredPastes} paste{undeclaredPastes > 1 ? 's' : ''} still undeclared
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-6 mb-3 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 text-sm font-medium bg-[#F8F7F5] hover:bg-[#EDECE9] text-[#111111] px-4 py-2.5 rounded-xl border border-[#B9B6AD]/20 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <GlowButton
              onClick={onConfirm}
              loading={submitting}
              className="flex-1 justify-center h-11 rounded-2xl"
            >
              {submitting ? 'Submitting…' : 'Yes, Submit'}
            </GlowButton>
          </div>
        </div>
      </motion.div>
    </>
  )
}
