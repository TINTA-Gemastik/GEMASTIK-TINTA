'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { DocumentReference, Task } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReferenceWithTask extends DocumentReference {
  task?: Task
}

interface GroupedRefs {
  task: Task
  submissionId: string
  refs: DocumentReference[]
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ReferencesPage() {
  const router = useRouter()
  const [groups,  setGroups]  = useState<GroupedRefs[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Fetch all references for this student, joined with submission+task
      const { data: refs } = await supabase
        .from('document_references')
        .select('*, submissions(id, task_id, tasks(*))')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })

      if (!refs?.length) { setLoading(false); return }

      // Group by submission / task
      const bySubmission: Record<string, GroupedRefs> = {}

      for (const r of refs as ReferenceWithTask[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = r as any
        const submission = raw.submissions
        if (!submission) continue

        const sid  = submission.id as string
        const task = submission.tasks as Task

        if (!bySubmission[sid]) {
          bySubmission[sid] = { task, submissionId: sid, refs: [] }
        }

        // Strip joined fields before storing
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { submissions: _s, ...refOnly } = raw
        bySubmission[sid].refs.push(refOnly as DocumentReference)
      }

      setGroups(Object.values(bySubmission))
      setLoading(false)
    }

    load()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F7F5] text-[#B9B6AD] text-sm">
        Loading references…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-[#B9B6AD]/30 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/mahasiswa/dashboard" className="text-[#B9B6AD] hover:text-[#111111] text-sm transition-colors">
            ← Dashboard
          </Link>
          <span className="text-[#B9B6AD]/40">/</span>
          <span className="text-sm font-medium text-[#111111]">References</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">

        <div className="mb-8">
          <h1 className="text-xl font-bold text-[#111111]">Your References</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            All sources you declared across your submissions. Transparent citation builds trust.
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-16 text-[#B9B6AD]">
            <p className="text-3xl mb-3">📚</p>
            <p className="text-sm font-medium">No references found.</p>
            <p className="text-xs mt-1">References appear here when you declare paste sources while writing.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(({ task, submissionId, refs }) => {
              const declaredCount   = refs.filter(r => r.confirmed).length
              const pasteCount      = refs.filter(r => r.is_paste_derived).length

              return (
                <div key={submissionId} className="bg-white border border-[#B9B6AD]/30 rounded-2xl overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#B9B6AD]/20">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111111] truncate">{task.title}</p>
                      <p className="text-xs text-[#B9B6AD] mt-0.5">
                        {refs.length} reference{refs.length !== 1 ? 's' : ''}
                        {pasteCount > 0 && ` · ${pasteCount} from pastes`}
                        {declaredCount > 0 && ` · ${declaredCount} confirmed`}
                      </p>
                    </div>
                    <Link
                      href={`/mahasiswa/submissions/${submissionId}`}
                      className="text-xs text-[#2D4E71] hover:text-[#1e3a56] font-medium transition-colors shrink-0"
                    >
                      View submission →
                    </Link>
                  </div>

                  {/* Reference list */}
                  <div className="divide-y divide-[#B9B6AD]/10">
                    {refs.map((ref, idx) => (
                      <div key={ref.id} className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <span className="text-[10px] text-[#B9B6AD] shrink-0 mt-0.5 w-5 text-right">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            {/* Quote */}
                            <blockquote className="text-xs text-[#374151] italic leading-relaxed border-l-2 border-[#AABED6] pl-2.5 mb-2">
                              &ldquo;{ref.sentence_text}&rdquo;
                            </blockquote>

                            {/* Source metadata */}
                            <div className="flex items-start gap-2 flex-wrap">
                              {(ref.source_title || ref.source_author) && (
                                <p className="text-[10px] text-[#6b7280]">
                                  {ref.source_author && `${ref.source_author}. `}
                                  <span className="font-medium">{ref.source_title}</span>
                                  {ref.source_year && ` (${ref.source_year})`}
                                </p>
                              )}
                              {ref.source_url && (
                                <a
                                  href={ref.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-[#2D4E71] hover:underline truncate max-w-xs"
                                >
                                  {ref.source_url}
                                </a>
                              )}
                            </div>

                            {/* Badges */}
                            <div className="flex items-center gap-2 mt-2">
                              {ref.is_paste_derived && (
                                <span className="text-[9px] font-semibold bg-[#AABED6]/20 text-[#2D4E71] px-1.5 py-0.5 rounded-full">
                                  From paste
                                </span>
                              )}
                              {ref.confirmed && (
                                <span className="text-[9px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                                  Confirmed
                                </span>
                              )}
                              <span className="text-[9px] text-[#B9B6AD] ml-auto">
                                {format(new Date(ref.created_at), 'd MMM yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
