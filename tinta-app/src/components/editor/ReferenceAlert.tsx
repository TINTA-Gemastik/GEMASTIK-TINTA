'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'

interface ReferenceAlertProps {
  count:    number
  onAction: () => void
}

export function ReferenceAlert({ count, onAction }: ReferenceAlertProps) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-between gap-4 px-5 py-2.5 bg-amber-50 border-b border-amber-200/60">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                {count} sentence{count !== 1 ? 's' : ''} with unconfirmed factual claims
              </p>
            </div>
            <button
              onClick={onAction}
              className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              Add References →
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
