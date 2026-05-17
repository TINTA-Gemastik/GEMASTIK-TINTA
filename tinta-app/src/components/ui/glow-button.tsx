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
  variant?:   'blue' | 'yellow'
}

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  ({ children, loading, disabled, className, onClick, variant = 'blue' }, ref) => {
    const isYellow = variant === 'yellow'
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        disabled={disabled || loading}
        onClick={onClick}
        className={cn(
          'relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60',
          isYellow ? 'shiny-button-yellow text-[#1C1400] font-bold' : 'shiny-button text-white',
          className,
        )}
      >
        {loading ? (
          <span className={cn(
            'w-3.5 h-3.5 rounded-full border-2 animate-spin',
            isYellow ? 'border-[#1C1400]/20 border-t-[#1C1400]/70' : 'border-white/40 border-t-white',
          )} />
        ) : (
          <Sparkles size={14} className={isYellow ? 'text-amber-900/60' : ''} />
        )}
        {children}
      </motion.button>
    )
  }
)
GlowButton.displayName = 'GlowButton'
