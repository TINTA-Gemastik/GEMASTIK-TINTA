'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { Task, Profile, Submission } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskStats {
  task: Task
  enrollmentCount: number
  submissionCount: number
  flaggedCount: number
  avgLes: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lesBandCls(score: number | null): string {
  if (score === null) return 'text-tinta-warm'
  if (score >= 76) return 'text-green-600'
  if (score >= 56) return 'text-yellow-600'
  if (score >= 31) return 'text-orange-500'
  return 'text-red-600'
}

function lesBandLabel(score: number | null): string {
  if (score === null) return '—'
  if (score >= 76) return 'Baik'
  if (score >= 56) return 'Cukup'
  if (score >= 31) return 'Perlu Tinjauan'
  return 'Perlu Perhatian'
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DosenDashboard() {
  const router = useRouter()
  const [profile, setProfile]     = useState<Profile | null>(null)
  const [taskStats, setTaskStats] = useState<TaskStats[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: prof }, { data: tasks }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('tasks').select('*').eq('dosen_id', user.id).order('created_at', { ascending: false }),
      ])

      setProfile(prof as Profile | null)

      if (!tasks?.length) { setLoading(false); return }

      const taskIds = tasks.map(t => t.id)

      const [{ data: enrollments }, { data: submissions }] = await Promise.all([
        supabase.from('task_enrollments').select('task_id').in('task_id', taskIds),
        supabase
          .from('submissions')
          .select('task_id, les_score, flag_count')
          .in('task_id', taskIds),
      ])

      // Group counts by task_id
      const enrollByTask: Record<string, number> = {}
      for (const e of enrollments ?? []) {
        enrollByTask[e.task_id] = (enrollByTask[e.task_id] ?? 0) + 1
      }

      const subsByTask: Record<string, Submission[]> = {}
      for (const s of (submissions ?? []) as Submission[]) {
        if (!subsByTask[s.task_id]) subsByTask[s.task_id] = []
        subsByTask[s.task_id].push(s)
      }

      setTaskStats(
        tasks.map(task => {
          const subs     = subsByTask[task.id] ?? []
          const scores   = subs.map(s => s.les_score).filter((v): v is number => v !== null)
          const avgLes   = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

          return {
            task: task as Task,
            enrollmentCount: enrollByTask[task.id] ?? 0,
            submissionCount: subs.length,
            flaggedCount: subs.filter(s => s.flag_count > 0).length,
            avgLes,
          }
        })
      )

      setLoading(false)
    }

    load()
  }, [router])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Summary stats
  const totalTasks       = taskStats.length
  const totalStudents    = taskStats.reduce((s, t) => s + t.enrollmentCount, 0)
  const totalSubmissions = taskStats.reduce((s, t) => s + t.submissionCount, 0)
  const totalFlagged     = taskStats.reduce((s, t) => s + t.flaggedCount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-tinta-warm text-sm">
        Memuat…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5] font-dm-sans">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-tinta-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <span className="font-playfair text-xl font-bold text-tinta-main tracking-tight select-none">
            TINTA
          </span>
          <div className="flex items-center gap-5">
            <span className="text-sm text-tinta-dark hidden sm:block">
              {profile?.full_name}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-tinta-warm hover:text-tinta-dark transition-colors"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-12">

        {/* ── Welcome ──────────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-semibold text-tinta-dark">
            Selamat datang, {profile?.full_name?.split(' ')[0] ?? 'Dosen'}.
          </h1>
          <p className="text-sm text-tinta-warm mt-1">
            {profile?.university ?? 'TINTA Dosen Panel'}
          </p>
        </div>

        {/* ── Stat Cards ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Tugas Dibuat"    value={totalTasks}       />
          <StatCard label="Total Mahasiswa" value={totalStudents}    />
          <StatCard label="Submission"      value={totalSubmissions} />
          <StatCard
            label="Perlu Perhatian"
            value={totalFlagged}
            valueClass={totalFlagged > 0 ? 'text-red-600' : undefined}
          />
        </div>

        {/* ── Task Table ───────────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Ringkasan Tugas</SectionLabel>

          {taskStats.length === 0 ? (
            <p className="text-sm text-tinta-warm">
              Belum ada tugas. Buat tugas pertama untuk mulai merekam proses menulis mahasiswa.
            </p>
          ) : (
            <div className="bg-white rounded-xl border border-tinta-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tinta-border bg-[#F8F7F5]">
                    <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-tinta-warm px-5 py-3">
                      Judul Tugas
                    </th>
                    <th className="text-left text-[11px] font-semibold tracking-wider uppercase text-tinta-warm px-4 py-3 hidden sm:table-cell">
                      Deadline
                    </th>
                    <th className="text-center text-[11px] font-semibold tracking-wider uppercase text-tinta-warm px-4 py-3">
                      Mahasiswa
                    </th>
                    <th className="text-center text-[11px] font-semibold tracking-wider uppercase text-tinta-warm px-4 py-3">
                      Submission
                    </th>
                    <th className="text-center text-[11px] font-semibold tracking-wider uppercase text-tinta-warm px-4 py-3 hidden md:table-cell">
                      Avg LES
                    </th>
                    <th className="text-center text-[11px] font-semibold tracking-wider uppercase text-tinta-warm px-4 py-3">
                      Flagged
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {taskStats.map(({ task, enrollmentCount, submissionCount, flaggedCount, avgLes }, i) => (
                    <tr
                      key={task.id}
                      className={`border-b border-tinta-border last:border-0 hover:bg-tinta-main/5 transition-colors ${i % 2 === 0 ? '' : 'bg-[#FAFAF9]'}`}
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium text-tinta-dark">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-tinta-warm mt-0.5 truncate max-w-xs">
                            {task.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-tinta-warm whitespace-nowrap hidden sm:table-cell">
                        {format(new Date(task.deadline), 'dd MMM yyyy', { locale: idLocale })}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-mono text-tinta-dark">
                        {enrollmentCount}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-mono text-tinta-dark">
                        {submissionCount}
                      </td>
                      <td className="px-4 py-4 text-center hidden md:table-cell">
                        {avgLes !== null ? (
                          <span className={`text-sm font-semibold ${lesBandCls(avgLes)}`}>
                            {avgLes}
                            <span className="text-xs font-normal ml-1 opacity-70">
                              {lesBandLabel(avgLes)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-tinta-warm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {flaggedCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            ⚠ {flaggedCount}
                          </span>
                        ) : (
                          <span className="text-xs text-tinta-warm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Flagged Submissions ───────────────────────────────────────────────── */}
        {totalFlagged > 0 && (
          <section>
            <SectionLabel>Submission Perlu Perhatian</SectionLabel>
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <p className="text-sm text-red-800 font-medium">
                ⚠ {totalFlagged} submission memiliki anomali yang perlu ditinjau.
              </p>
              <p className="text-xs text-red-600 mt-1">
                Klik tugas pada tabel di atas untuk melihat detail per mahasiswa. (Fitur review akan tersedia di versi berikutnya.)
              </p>
            </div>
          </section>
        )}

      </main>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-widest uppercase text-tinta-warm mb-4">
      {children}
    </h2>
  )
}

function StatCard({
  label,
  value,
  valueClass,
}: {
  label: string
  value: number
  valueClass?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-tinta-border px-5 py-5">
      <p className="text-[11px] font-semibold tracking-wider uppercase text-tinta-warm">
        {label}
      </p>
      <p className={`text-3xl font-semibold mt-2 ${valueClass ?? 'text-tinta-dark'}`}>
        {value}
      </p>
    </div>
  )
}
