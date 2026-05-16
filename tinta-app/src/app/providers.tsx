'use client'

import { Toast } from '@/components/shared/Toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toast />
    </>
  )
}
