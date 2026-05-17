'use client'

import { forwardRef } from 'react'
import { Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface GlowButtonProps {
  children:   React.ReactNode
  loading?:   boolean
  disabled?:  boolean
  className?: string
  onClick?:   () => void
}

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  ({ children, loading, disabled, className, onClick }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60',
        'bg-gradient-to-r from-emerald-500 to-emerald-600',
        'shadow-[0_0_0_0_rgba(16,185,129,0)] hover:shadow-[0_0_16px_4px_rgba(16,185,129,0.35)]',
        'active:shadow-none',
        className,
      )}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      ) : (
        <Sparkles size={14} />
      )}
      {children}
    </motion.button>
  )
)
GlowButton.displayName = 'GlowButton'
