import { AlertTriangle } from 'lucide-react'

type Severity = 'high' | 'medium' | 'low'

interface FlagBadgeProps {
  flagType:        string
  flagDescription: string
  severity:        Severity
}

const severityStyles: Record<Severity, string> = {
  high:   'bg-red-50 border-red-200 text-red-700',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  low:    'bg-slate-50 border-slate-200 text-slate-600',
}

const severityIcon: Record<Severity, string> = {
  high:   'text-red-500',
  medium: 'text-amber-500',
  low:    'text-slate-400',
}

export function FlagBadge({ flagType, flagDescription, severity }: FlagBadgeProps) {
  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-sm ${severityStyles[severity]}`}>
      <AlertTriangle size={14} className={`flex-shrink-0 mt-0.5 ${severityIcon[severity]}`} />
      <div className="min-w-0">
        <p className="font-semibold text-[12px] uppercase tracking-wide opacity-70">
          {flagType.replace(/_/g, ' ')}
        </p>
        <p className="text-[12px] leading-snug mt-0.5">{flagDescription}</p>
      </div>
      <span className="ml-auto shrink-0 text-[10px] font-bold uppercase opacity-50">{severity}</span>
    </div>
  )
}
