import { cn } from '@/lib/utils'

interface AuthCardProps {
  children: React.ReactNode
  className?: string
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div
        className={cn(
          'w-full max-w-md bg-white rounded-2xl shadow-2xl p-8',
          className
        )}
      >
        {/* Wordmark */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-tinta-dark font-geist">
            TINTA
          </h1>
          <p className="text-xs text-tinta-warm mt-1 tracking-wide">
            Tracking Integritas dan Navigasi Tulisan Asli
          </p>
        </div>

        {children}
      </div>
    </div>
  )
}
