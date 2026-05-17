type Band = 'Perlu Perhatian' | 'Perlu Tinjauan' | 'Cukup' | 'Baik'

interface LESBadgeProps {
  score: number | null
  band?:  Band | null
  compact?: boolean
}

function bandFrom(score: number): Band {
  if (score >= 76) return 'Baik'
  if (score >= 56) return 'Cukup'
  if (score >= 31) return 'Perlu Tinjauan'
  return 'Perlu Perhatian'
}

function barColor(score: number): string {
  if (score >= 76) return 'bg-green-500'
  if (score >= 56) return 'bg-yellow-400'
  if (score >= 31) return 'bg-amber-500'
  return 'bg-red-500'
}

function textColor(score: number): string {
  if (score >= 76) return 'text-green-700'
  if (score >= 56) return 'text-yellow-700'
  if (score >= 31) return 'text-amber-700'
  return 'text-red-600'
}

export function LESBadge({ score, band, compact = false }: LESBadgeProps) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-[#B9B6AD]">Not submitted</span>
  }

  const resolvedBand = band ?? bandFrom(score)
  const pct          = Math.min(100, Math.max(0, score))

  if (compact) {
    return (
      <span className={`text-sm font-bold ${textColor(score)}`}>
        {score}
        <span className="text-[10px] font-normal ml-1 opacity-70">{resolvedBand}</span>
      </span>
    )
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-bold ${textColor(score)}`}>{score}</span>
        <span className={`text-[11px] font-medium ${textColor(score)}`}>{resolvedBand}</span>
      </div>
      <div className="h-2 w-full bg-[#F8F7F5] rounded-full overflow-hidden border border-[#B9B6AD]/20">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
