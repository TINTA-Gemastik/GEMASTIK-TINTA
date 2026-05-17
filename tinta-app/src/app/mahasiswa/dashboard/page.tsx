'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, isPast, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { Task, Session, Profile } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskRow {
  enrollmentId: string
  task: Task
  sessions: Session[]
}

interface SessionWithTask extends Session {
  task: Task
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}j ${m}m`
  return `${m}m`
}

function deadlineInfo(deadline: string): { label: string; cls: string } {
  const d = new Date(deadline)
  if (isPast(d)) return { label: 'Terlewat', cls: 'bg-red-100 text-red-700' }
  const days = differenceInDays(d, new Date())
  if (days === 0) {
    const hours = differenceInHours(d, new Date())
    if (hours === 0) {
      const mins = differenceInMinutes(d, new Date())
      return { label: `${mins}m lagi`, cls: 'bg-red-100 text-red-700' }
    }
    return { label: `${hours}j lagi`, cls: 'bg-orange-100 text-orange-700' }
  }
  if (days <= 2) return { label: `${days} hari lagi`, cls: 'bg-orange-100 text-orange-700' }
  return { label: `${days} hari lagi`, cls: 'bg-tinta-main/10 text-tinta-main' }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MahasiswaDashboard() {
  const router = useRouter()
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [taskRows, setTaskRows] = useState<TaskRow[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: prof }, { data: enrollments }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase
          .from('task_enrollments')
          .select('id, enrolled_at, tasks(*)')
          .eq('student_id', user.id)
          .order('enrolled_at', { ascending: false }),
      ])

      setProfile(prof as Profile | null)

      if (!enrollments?.length) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = enrollments as any[]
      const taskIds: string[] = rows.map(e => e.tasks.id)

      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .in('task_id', taskIds)
        .order('started_at', { ascending: false })

      const byTask: Record<string, Session[]> = {}
      for (const s of (sessions ?? []) as Session[]) {
        if (!byTask[s.task_id]) byTask[s.task_id] = []
        byTask[s.task_id].push(s)
      }

      setTaskRows(
        rows.map(e => ({
          enrollmentId: e.id as string,
          task: e.tasks as Task,
          sessions: byTask[e.tasks.id] ?? [],
        }))
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

  const activeTasks = taskRows.filter(r => !isPast(new Date(r.task.deadline)))
  const pastTasks   = taskRows.filter(r =>  isPast(new Date(r.task.deadline)))

  const recentSessions: SessionWithTask[] = (() => {
    const allSessions = taskRows
      .flatMap(r => r.sessions.map(s => ({ ...s, task: r.task })))
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

    // Deduplicate: keep only the most recent session per task
    const seenTaskIds = new Set<string>()
    return allSessions
      .filter(s => {
        if (seenTaskIds.has(s.task_id)) return false
        seenTaskIds.add(s.task_id)
        return true
      })
      .slice(0, 8)
  })()

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
          <h1 className="text-3xl font-bold text-tinta-dark">
            Halo, {profile?.full_name ?? 'Mahasiswa'}.
          </h1>
          <div className="rounded-2xl bg-[#2A4D88] p-2 w-[25%] items-center justify-center text-center border border-1 border-black mt-2">
            <p className="text-base font-semibold text-white">
              {profile?.university ?? 'TINTA Mahasiswa Panel'}
            </p>
          </div>
        </div>

        {/* ── Active Tasks ─────────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Tugas Aktif</SectionLabel>

          {activeTasks.length === 0 ? (
            <p className="text-sm text-tinta-warm">Tidak ada tugas aktif saat ini.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeTasks.map(({ task, sessions }) => {
                const dl          = deadlineInfo(task.deadline)
                const doneSessions = sessions.filter(s => !!s.ended_at).length
                const progress    = Math.min(100, (doneSessions / Math.max(task.min_sessions, 1)) * 100)

                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl border border-tinta-border p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow"
                  >
                    {/* Title + deadline badge */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-tinta-dark leading-snug flex-1">
                        {task.title}
                      </h3>
                      <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${dl.cls}`}>
                        {dl.label}
                      </span>
                    </div>

                    <p className="text-xs text-tinta-warm -mt-2">
                      Deadline: {format(new Date(task.deadline), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                    </p>

                    {/* Session progress */}
                    <div>
                      <div className="flex justify-between text-[10px] text-tinta-warm mb-1.5">
                        <span>{doneSessions} dari {task.min_sessions} sesi minimum</span>
                        <span className={doneSessions >= task.min_sessions ? 'text-tinta-main font-medium' : ''}>
                          {doneSessions >= task.min_sessions ? '✓ Terpenuhi' : `${task.min_sessions - doneSessions} sesi lagi`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-tinta-border/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-tinta-main rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <Link
                      href={`/mahasiswa/task/${task.id}/write`}
                      className="mt-auto text-center text-sm font-medium bg-tinta-main hover:bg-tinta-accent-hover active:scale-[0.98] text-white px-4 py-2 rounded-lg transition-all"
                    >
                      Tulis Sekarang →
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Recent Session Feed ───────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Riwayat Sesi Terbaru</SectionLabel>

          {recentSessions.length === 0 ? (
            <p className="text-sm text-tinta-warm">
              Belum ada sesi tercatat. Mulai menulis untuk merekam sesi pertamamu.
            </p>
          ) : (
            <div className="space-y-2">
              {recentSessions.map(session => {
                const startStr = format(new Date(session.started_at), 'EEEE, d MMM yyyy, HH:mm', { locale: idLocale })
                const endStr   = session.ended_at
                  ? format(new Date(session.ended_at), 'HH:mm')
                  : 'Berlangsung'
                const dur = session.duration_active_ms > 0
                  ? fmtDuration(session.duration_active_ms)
                  : null
                const isOpen = !session.ended_at

                return (
                  <div
                    key={session.id}
                    className="bg-white rounded-lg border border-tinta-border px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-tinta-main truncate">
                          {session.task.title}
                        </p>
                        <p className="text-xs text-tinta-warm mt-0.5">
                          {startStr} – {endStr}
                          {dur && ` · ${dur} aktif`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isOpen && (
                          <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            Aktif
                          </span>
                        )}
                        <Link
                          href={`/mahasiswa/task/${session.task_id}/replay`}
                          className="text-[11px] font-medium text-[#2D4E71] hover:text-[#1e3a56] bg-[#2D4E71]/8 hover:bg-[#2D4E71]/15 px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
                        >
                          ▶ Watch Replay
                        </Link>
                      </div>
                    </div>

                    {/* Git-style delta */}
                    <div className="flex items-center gap-4 mt-2.5 text-xs font-mono flex-wrap">
                      <span className="text-green-600 font-medium">
                        +{session.line_insertions ?? 0} insertions(+)
                      </span>
                      <span className="text-red-500 font-medium">
                        -{session.line_deletions ?? 0} deletions(-)
                      </span>
                      {session.paste_event_count > 0 && (
                        <span className="text-tinta-warm">
                          {session.paste_event_count} paste
                        </span>
                      )}
                      {session.undo_count > 0 && (
                        <span className="text-tinta-warm">
                          {session.undo_count} undo
                        </span>
                      )}
                      {session.final_doc_length > 0 && (
                        <span className="text-tinta-warm ml-auto">
                          {session.final_doc_length.toLocaleString('id')} karakter
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Past Tasks ───────────────────────────────────────────────────────── */}
        {pastTasks.length > 0 && (
          <section>
            <SectionLabel>Tugas Selesai</SectionLabel>
            <div className="space-y-2">
              {pastTasks.map(({ task, sessions }) => {
                const closedSessions = sessions.filter(s => !!s.ended_at).length
                const last = sessions[0]

                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg border border-tinta-border px-5 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-tinta-dark truncate">{task.title}</p>
                      <p className="text-xs text-tinta-warm mt-0.5">
                        {closedSessions} sesi
                        {last && ` · Terakhir ${format(new Date(last.started_at), 'd MMM yyyy', { locale: idLocale })}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Link
                        href={`/mahasiswa/task/${task.id}/replay`}
                        className="text-[11px] font-medium text-[#2D4E71] hover:text-[#1e3a56] transition-colors whitespace-nowrap"
                      >
                        ▶ Replay
                      </Link>
                      <Link
                        href={`/mahasiswa/task/${task.id}/write`}
                        className="text-xs text-tinta-main hover:text-tinta-accent-hover transition-colors shrink-0 whitespace-nowrap"
                      >
                        Buka →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-widest uppercase text-tinta-warm mb-4">
      {children}
    </h2>
  )
}
