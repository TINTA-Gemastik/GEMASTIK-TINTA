'use client'

import { useState } from 'react'
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const [dark,      setDark]      = useState(false)
  const [busy,      setBusy]      = useState(false)
  const curtainCtrl = useAnimationControls()

  const toggle = async () => {
    if (busy) return
    setBusy(true)

    const nextDark    = !dark
    const curtainBg   = nextDark ? '#111111' : '#ffffff'

    // Expand curtain from center
    await curtainCtrl.start({
      clipPath:   'circle(150% at 50% 50%)',
      opacity:    1,
      transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
    })

    // Switch theme while screen is covered
    setDark(nextDark)
    const root = document.documentElement
    if (nextDark) root.classList.add('dark')
    else          root.classList.remove('dark')

    // Contract curtain
    await curtainCtrl.start({
      clipPath:   'circle(0% at 50% 50%)',
      transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
    })

    setBusy(false)

    // Reset so next toggle colour is ready
    curtainCtrl.set({ backgroundColor: curtainBg })
  }

  return (
    <>
      <button
        onClick={toggle}
        disabled={busy}
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[#f7f7f6] border border-[#B9B6AD]/30 disabled:pointer-events-none"
      >
        <AnimatePresence mode="wait">
          {dark ? (
            <motion.div
              key="sun"
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Sun size={14} className="text-amber-500" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Moon size={14} className="text-[#2D4E71]" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Full-screen curtain overlay */}
      <motion.div
        animate={curtainCtrl}
        initial={{ clipPath: 'circle(0% at 50% 50%)', opacity: 1 }}
        style={{ backgroundColor: dark ? '#ffffff' : '#111111' }}
        className="fixed inset-0 z-[999] pointer-events-none"
      />
    </>
  )
}
