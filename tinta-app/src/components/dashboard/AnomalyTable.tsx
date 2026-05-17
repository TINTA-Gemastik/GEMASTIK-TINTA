import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { LESBadge } from './LESBadge'

interface AnomalyRow {
  studentId:       string
  studentName:     string
  studentNpm:      string | null
  taskId:          string
  lesScore:        number | null
  sourceRate:      number | null
  behavioralRisk:  number | null
  topFlag:         string | null
  flagSeverity:    'high' | 'medium' | 'low'
}

interface AnomalyTableProps {
  rows: AnomalyRow[]
}

export function AnomalyTable({ rows }: AnomalyTableProps) {
  if (rows.length === 0) return null

  return (
    <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#B9B6AD]/20 bg-[#f8fafc]">
            {['Student', 'LES Score', 'Source %', 'Behavioral Risk', 'Top Flag', ''].map(h => (
              <th
                key={h}
                className="text-left text-[11px] font-semibold tracking-wider uppercase text-[#B9B6AD] px-5 py-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.studentId}
              className="border-b border-[#B9B6AD]/10 last:border-0 hover:bg-red-50/40 transition-colors"
            >
              <td className="px-5 py-3.5">
                <p className="font-medium text-[#111111]">{row.studentName}</p>
                <p className="text-[11px] text-[#B9B6AD]">{row.studentNpm ?? ''}</p>
              </td>
              <td className="px-5 py-3.5 w-32">
                <LESBadge score={row.lesScore} compact />
              </td>
              <td className="px-5 py-3.5 text-xs font-mono text-[#111111]">
                {row.sourceRate !== null ? `${Math.round(row.sourceRate * 100)}%` : '—'}
              </td>
              <td className="px-5 py-3.5">
                {row.behavioralRisk !== null ? (
                  <span className={`text-xs font-semibold font-mono ${
                    (row.behavioralRisk ?? 0) > 0.6 ? 'text-red-600' :
                    (row.behavioralRisk ?? 0) > 0.3 ? 'text-amber-600' : 'text-[#B9B6AD]'
                  }`}>
                    {Math.round((row.behavioralRisk ?? 0) * 100)}%
                  </span>
                ) : <span className="text-[#B9B6AD] text-xs">—</span>}
              </td>
              <td className="px-5 py-3.5 max-w-xs">
                {row.topFlag ? (
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg border ${
                    row.flagSeverity === 'high'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : row.flagSeverity === 'medium'
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <AlertTriangle size={10} />
                    {row.topFlag}
                  </span>
                ) : <span className="text-[#B9B6AD] text-xs">—</span>}
              </td>
              <td className="px-5 py-3.5">
                <Link
                  href={`/dosen/class/${row.taskId}/student/${row.studentId}`}
                  className="text-xs font-semibold text-[#2D4E71] hover:text-[#1e3a56] transition-colors whitespace-nowrap"
                >
                  Review →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
