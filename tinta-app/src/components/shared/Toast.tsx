'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Store ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastStore {
  toasts: ToastItem[]
  addToast: (message: string, variant?: ToastVariant) => void
  removeToast: (id: string) => void
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, variant = 'info') =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: crypto.randomUUID(), message, variant },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

// ─── Visual config ────────────────────────────────────────────────────────────

const variantConfig: Record<
  ToastVariant,
  { bg: string; icon: React.ReactNode }
> = {
  success: {
    bg: 'bg-emerald-600 text-white',
    icon: <CheckCircle2 size={16} className="shrink-0" />,
  },
  error: {
    bg: 'bg-tinta-danger text-white',
    icon: <AlertCircle size={16} className="shrink-0" />,
  },
  info: {
    bg: 'bg-tinta-main text-white',
    icon: <Info size={16} className="shrink-0" />,
  },
}

// ─── Single toast item ────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onRemove,
}: {
  toast: ToastItem
  onRemove: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 4000)
    return () => clearTimeout(timer)
  }, [onRemove])

  const { bg, icon } = variantConfig[toast.variant]

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
        'min-w-[280px] max-w-sm animate-slide-in-up',
        bg
      )}
    >
      {icon}
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        onClick={onRemove}
        className="opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Tutup notifikasi"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Container rendered in root layout ───────────────────────────────────────

export function Toast() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-label="Notifikasi"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}
