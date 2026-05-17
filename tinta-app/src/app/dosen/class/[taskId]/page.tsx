'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Task, Profile, Submission, Session } from '@/types'

interface StudentRow {
  profile:    Profile
  submission: Submission | null
  sessions:   Session[]
}

function lesBandCls(score: number | null): string {
  if (score === null) return 'text-[#B9B6AD]'
  if (score >= 76) return 'text-green-600'
  if (score >= 56) return 'text-yellow-600'
  if (score >= 31) return 'text-orange-500'
  return 'text-red-600'
}

export default function DosenClassPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.taskId as string

  const [task,     setTask]     = useState<Task | null>(null)
  const [rows,     setRows]     = useState<StudentRow[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [
        { data: taskData },
        { data: enrollments },
      ] = await Promise.all([
        supabase.from('tasks').select('*').eq('id', taskId).single(),
        supabase
          .from('task_enrollments')
          .select('student_id, profiles(*)')
          .eq('task_id', taskId),
      ])

      if (!taskData) { router.push('/dosen/dashboard'); return }
      setTask(taskData as Task)

      if (!enrollments?.length) { setLoading(false); return }

      const studentIds = enrollments.map(e => e.student_id)

      const [{ data: submissions }, { data: sessions }] = await Promise.all([
        supabase.from('submissions').select('*').eq('task_id', taskId).in('student_id', studentIds),
        supabase.from('sessions').select('*').eq('task_id', taskId).in('user_id', studentIds)
          .order('started_at', { ascending: false }),
      ])

      const subMap: Record<string, Submission> = {}
      for (const s of (submissions ?? []) as Submission[]) subMap[s.student_id] = s

      const sessMap: Record<string, Session[]> = {}
      for (const s of (sessions ?? []) as Session[]) {
        if (!sessMap[s.user_id]) sessMap[s.user_id] = []
        sessMap[s.user_id].push(s)
      }

      setRows(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        enrollments.map((e: any) => ({
          profile:    e.profiles as Profile,
          submission: subMap[e.student_id] ?? null,
          sessions:   sessMap[e.student_id] ?? [],
        }))
      )
      setLoading(false)
    }

    load()
  }, [taskId, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F7F5] text-[#B9B6AD] text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5]">
      <header className="bg-white border-b border-[#B9B6AD]/20 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/dosen/dashboard"
            className="flex items-center gap-1 text-sm text-[#B9B6AD] hover:text-[#111111] transition-colors"
          >
            <ChevronLeft size={16} />
            Dashboard
          </Link>
          <div className="w-px h-5 bg-[#B9B6AD]/30" />
          <div>
            <h1 className="text-sm font-semibold text-[#111111]">{task?.title}</h1>
            {task?.deadline && (
              <p className="text-xs text-[#B9B6AD]">
                Deadline: {format(new Date(task.deadline), 'dd MMM yyyy, HH:mm')}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#B9B6AD]">
            Students ({rows.length})
          </h2>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-[#B9B6AD]">No students enrolled yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-[#B9B6AD]/20 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#B9B6AD]/20 bg-[#F8F7F5]">
                  {['Student', 'Sessions', 'LES Score', 'Status', ''].map(h => (
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
                {rows.map(({ profile, submission, sessions }) => (
                  <tr
                    key={profile.id}
                    className="border-b border-[#B9B6AD]/10 last:border-0 hover:bg-[#F8F7F5] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-[#111111]">{profile.full_name}</p>
                      <p className="text-xs text-[#B9B6AD]">{profile.npm ?? profile.email}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-mono text-[#111111]">
                      {sessions.length}
                    </td>
                    <td className="px-5 py-4">
                      {submission?.les_score != null ? (
                        <span className={`text-sm font-semibold ${lesBandCls(submission.les_score)}`}>
                          {submission.les_score}
                        </span>
                      ) : (
                        <span className="text-xs text-[#B9B6AD]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {submission ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                          Submitted
                        </span>
                      ) : sessions.length > 0 ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                          In Progress
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F8F7F5] text-[#B9B6AD] font-medium">
                          Not Started
                        </span>
                      )}
                      {submission && submission.flag_count > 0 && (
                        <span className="ml-2 text-[11px] text-red-600 inline-flex items-center gap-0.5">
                          <AlertTriangle size={11} />
                          {submission.flag_count}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/dosen/class/${taskId}/student/${profile.id}`}
                        className="text-xs font-medium text-[#2D4E71] hover:text-[#1e3a56] transition-colors"
                      >
                        View Detail →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
