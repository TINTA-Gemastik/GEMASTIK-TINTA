import { TrendingUp, TrendingDown } from 'lucide-react'

type Color = 'blue' | 'amber' | 'red' | 'green'

interface StatCardProps {
  label:    string
  value:    string | number
  subtext?: string
  delta?:   number
  color?:   Color
}

const colorMap: Record<Color, string> = {
  blue:  'bg-[#2D4E71]/8 text-[#2D4E71]',
  amber: 'bg-amber-50 text-amber-700',
  red:   'bg-red-50 text-red-600',
  green: 'bg-green-50 text-green-700',
}

export function StatCard({ label, value, subtext, delta, color = 'blue' }: StatCardProps) {
  return (
    <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-6 flex flex-col gap-2">
      <p className="text-[11px] font-semibold tracking-widest uppercase text-[#B9B6AD]">{label}</p>
      <div className="flex items-end gap-3">
        <p className="text-3xl font-bold text-[#111111] leading-none">{value}</p>
        {delta !== undefined && (
          <span
            className={`mb-0.5 flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
              delta >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}
          >
            {delta >= 0
              ? <TrendingUp size={11} />
              : <TrendingDown size={11} />}
            {Math.abs(delta)}
          </span>
        )}
        {color && (
          <span className={`mb-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
            color === 'blue'  ? 'bg-[#2D4E71]' :
            color === 'green' ? 'bg-green-500' :
            color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
          }`} />
        )}
      </div>
      {subtext && <p className="text-xs text-[#6b7280]">{subtext}</p>}
      <div className={`mt-1 self-start text-[10px] font-medium px-2 py-0.5 rounded-full ${colorMap[color]}`}>
        {color === 'blue'  ? 'Info'    :
         color === 'green' ? 'Good'    :
         color === 'amber' ? 'Monitor' : 'Alert'}
      </div>
    </div>
  )
}
