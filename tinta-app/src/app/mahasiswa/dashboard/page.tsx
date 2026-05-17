'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { isPast, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Task, Session, Profile, Submission } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskRow {
  enrollmentId: string
  task: Task
  sessions: Session[]
  submission: Submission | null
}

interface SessionWithTask extends Session {
  task: Task
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function deadlineInfo(deadline: string): { label: string; cls: string } {
  const d = new Date(deadline)
  if (isPast(d)) return { label: 'Overdue', cls: 'bg-red-100 text-red-700' }
  const days = differenceInDays(d, new Date())
  if (days === 0) {
    const hours = differenceInHours(d, new Date())
    if (hours === 0) {
      const mins = differenceInMinutes(d, new Date())
      return { label: `${mins}m left`, cls: 'bg-red-100 text-red-700' }
    }
    return { label: `${hours}h left`, cls: 'bg-orange-100 text-orange-700' }
  }
  if (days <= 2) return { label: `${days} days left`, cls: 'bg-orange-100 text-orange-700' }
  return { label: `${days} days left`, cls: 'bg-tinta-main/10 text-tinta-main' }
}

function lesBandColor(band: string | null): string {
  switch (band) {
    case 'Baik':            return 'text-green-700 bg-green-50 border-green-200'
    case 'Cukup':           return 'text-blue-700 bg-blue-50 border-blue-200'
    case 'Perlu Tinjauan':  return 'text-amber-700 bg-amber-50 border-amber-200'
    case 'Perlu Perhatian': return 'text-red-700 bg-red-50 border-red-200'
    default:                return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

function lesBandLabel(band: string | null): string {
  switch (band) {
    case 'Baik':            return 'Good'
    case 'Cukup':           return 'Adequate'
    case 'Perlu Tinjauan':  return 'Under Review'
    case 'Perlu Perhatian': return 'Needs Attention'
    default:                return 'Pending'
  }
}

function reviewStatusInfo(status: string): { label: string; cls: string } {
  switch (status) {
    case 'cleared':           return { label: 'Cleared', cls: 'text-green-700 bg-green-50 border-green-200' }
    case 'minta_klarifikasi': return { label: 'Clarification Requested', cls: 'text-amber-700 bg-amber-50 border-amber-200' }
    case 'eskalasi':          return { label: 'Under Scrutiny', cls: 'text-red-700 bg-red-50 border-red-200' }
    default:                  return { label: 'Pending Review', cls: 'text-gray-600 bg-gray-50 border-gray-200' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MahasiswaDashboard() {
  const router = useRouter()
  const [profile,   setProfile]   = useState<Profile | null>(null)
  const [taskRows,  setTaskRows]  = useState<TaskRow[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: prof }, { data: enrollments }, { data: submissions }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase
          .from('task_enrollments')
          .select('id, enrolled_at, tasks(*)')
          .eq('student_id', user.id)
          .order('enrolled_at', { ascending: false }),
        supabase
          .from('submissions')
          .select('*')
          .eq('student_id', user.id),
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

      const subByTask: Record<string, Submission> = {}
      for (const sub of (submissions ?? []) as Submission[]) {
        subByTask[sub.task_id] = sub
      }

      setTaskRows(
        rows.map(e => ({
          enrollmentId: e.id as string,
          task:         e.tasks as Task,
          sessions:     byTask[e.tasks.id] ?? [],
          submission:   subByTask[e.tasks.id] ?? null,
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

  const activeTasks    = taskRows.filter(r => !r.submission && !isPast(new Date(r.task.deadline)))
  const submittedTasks = taskRows.filter(r =>  r.submission)
  const expiredTasks   = taskRows.filter(r => !r.submission && isPast(new Date(r.task.deadline)))

<<<<<<< HEAD
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
=======
  // Flat list of all sessions, newest first
  const recentSessions: SessionWithTask[] = taskRows
    .flatMap(r => r.sessions.map(s => ({ ...s, task: r.task })))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 8)
>>>>>>> db7c24a75140555146751fd59005393b88aff93d

  const activeSessionId = recentSessions.find(s => !s.ended_at)?.id ?? null

  // Alert: any clarification requests
  const hasClarification = submittedTasks.some(
    r => r.submission?.dosen_review_status === 'minta_klarifikasi' ||
         r.submission?.dosen_review_status === 'eskalasi'
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-tinta-warm text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5] font-dm-sans">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-tinta-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <span className="font-playfair text-xl font-bold text-tinta-main tracking-tight select-none">
            TINTA
          </span>
          <div className="flex items-center gap-5">
            <Link href="/mahasiswa/references" className="text-sm text-tinta-warm hover:text-tinta-dark transition-colors hidden sm:block">
              References
            </Link>
            <span className="text-sm text-tinta-dark hidden sm:block">
              {profile?.full_name}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-tinta-warm hover:text-tinta-dark transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-12">

        {/* ── Welcome ──────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-semibold text-tinta-dark">
            Hello, {profile?.full_name?.split(' ')[0] ?? 'Student'}.
          </h1>
          <div className="rounded-2xl bg-[#2A4D88] p-2 w-fit min-w-[120px] items-center justify-center text-center mt-2">
            <p className="text-sm font-semibold text-white">
              {profile?.university ?? 'TINTA Mahasiswa Panel'}
            </p>
          </div>
        </div>

        {/* ── Clarification Alert ───────────────────────────────────────────── */}
        {hasClarification && (
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="text-amber-600 text-lg leading-none shrink-0">⚠</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Action Required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Your lecturer has requested clarification on one or more submissions. Please check your submitted tasks below.
              </p>
            </div>
          </div>
        )}

        {/* ── Active Tasks ─────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Active Tasks</SectionLabel>

          {activeTasks.length === 0 ? (
            <p className="text-sm text-tinta-warm">No active tasks right now.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeTasks.map(({ task, sessions }) => {
                const dl           = deadlineInfo(task.deadline)
                const doneSessions = sessions.filter(s => !!s.ended_at).length
                const progress     = Math.min(100, (doneSessions / Math.max(task.min_sessions, 1)) * 100)
                const lastSession  = sessions.find(s => s.ended_at)

                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl border border-tinta-border p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-tinta-dark leading-snug flex-1">
                        {task.title}
                      </h3>
                      <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${dl.cls}`}>
                        {dl.label}
                      </span>
                    </div>

                    <p className="text-xs text-tinta-warm -mt-2">
                      Deadline: {format(new Date(task.deadline), 'dd MMM yyyy, HH:mm')}
                    </p>

                    {/* Session progress */}
                    <div>
                      <div className="flex justify-between text-[10px] text-tinta-warm mb-1.5">
                        <span>{doneSessions} of {task.min_sessions} sessions minimum</span>
                        <span className={doneSessions >= task.min_sessions ? 'text-tinta-main font-medium' : ''}>
                          {doneSessions >= task.min_sessions ? '✓ Met' : `${task.min_sessions - doneSessions} to go`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-tinta-border/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-tinta-main rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Last session delta */}
                    {lastSession && (
                      <div className="flex items-center gap-3 text-[11px] font-mono">
                        <span className="text-green-600 font-medium">+{lastSession.line_insertions ?? 0}</span>
                        <span className="text-red-500 font-medium">-{lastSession.line_deletions ?? 0}</span>
                        <span className="text-tinta-warm ml-auto">
                          {format(new Date(lastSession.started_at), 'd MMM')}
                        </span>
                      </div>
                    )}

                    <Link
                      href={`/mahasiswa/task/${task.id}/write`}
                      className="mt-auto text-center text-sm font-medium bg-tinta-main hover:bg-tinta-accent-hover active:scale-[0.98] text-white px-4 py-2 rounded-lg transition-all"
                    >
                      Write Now →
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Submitted Tasks ───────────────────────────────────────────────── */}
        {submittedTasks.length > 0 && (
          <section>
            <SectionLabel>Submitted Tasks</SectionLabel>
            <div className="space-y-3">
              {submittedTasks.map(({ task, submission, sessions }) => {
                if (!submission) return null
                const reviewStatus = reviewStatusInfo(submission.dosen_review_status)
                const needsAction  = submission.dosen_review_status === 'minta_klarifikasi' ||
                                     submission.dosen_review_status === 'eskalasi'
                const sessionCount = sessions.filter(s => !!s.ended_at).length

                return (
                  <div
                    key={task.id}
                    className={`bg-white rounded-xl border p-5 ${needsAction ? 'border-amber-300' : 'border-tinta-border'}`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-tinta-dark">{task.title}</p>
                          {submission.les_band && (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${lesBandColor(submission.les_band)}`}>
                              {lesBandLabel(submission.les_band)}
                              {submission.les_score != null && ` · ${submission.les_score}`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${reviewStatus.cls}`}>
                            {reviewStatus.label}
                          </span>
                          <span className="text-xs text-tinta-warm">
                            {sessionCount} session{sessionCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-tinta-warm">
                            Submitted {format(new Date(submission.submitted_at), 'd MMM yyyy')}
                          </span>
                        </div>

                        {/* Grade display if finalized */}
                        {submission.finalized && (submission.nilai_konten != null || submission.nilai_proses != null) && (
                          <div className="flex items-center gap-3 mt-2">
                            {submission.nilai_konten != null && (
                              <span className="text-xs text-tinta-dark">
                                Content: <span className="font-semibold">{submission.nilai_konten}</span>
                              </span>
                            )}
                            {submission.nilai_proses != null && (
                              <span className="text-xs text-tinta-dark">
                                Process: <span className="font-semibold">{submission.nilai_proses}</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Clarification note */}
                        {needsAction && submission.dosen_note && (
                          <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <span className="font-medium">Lecturer note:</span> {submission.dosen_note}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Link
                          href={`/mahasiswa/submissions/${submission.id}`}
                          className="text-xs text-tinta-main hover:text-tinta-accent-hover transition-colors font-medium whitespace-nowrap"
                        >
                          View Details →
                        </Link>
                        <Link
                          href={`/mahasiswa/task/${task.id}/replay`}
                          className="text-xs text-tinta-warm hover:text-tinta-dark transition-colors whitespace-nowrap"
                        >
                          ▶ Replay
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Recent Sessions ───────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Recent Sessions</SectionLabel>

          {recentSessions.length === 0 ? (
            <p className="text-sm text-tinta-warm">
              No sessions recorded yet. Start writing to record your first session.
            </p>
          ) : (
            <div className="space-y-2">
              {recentSessions.map(session => {
                const isActive = session.id === activeSessionId
                const startStr = format(new Date(session.started_at), 'EEEE, d MMM yyyy, HH:mm')
                const endTime  = isActive
                  ? null
                  : session.ended_at
                  ? new Date(session.ended_at)
                  : new Date(new Date(session.started_at).getTime() + (session.duration_active_ms || 0))
                const endStr   = isActive
                  ? 'In Progress'
                  : endTime
                  ? format(endTime, 'HH:mm')
                  : '—'
                const dur = session.duration_active_ms > 0
                  ? fmtDuration(session.duration_active_ms)
                  : null

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
                          {dur && !isActive && ` · ${dur} active`}
                        </p>
                      </div>
                      {isActive && (
                        <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                          Active
                        </span>
                      )}
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
                          {Math.round(session.final_doc_length / 5.5).toLocaleString('en')} words
                        </span>
                      )}
                    </div>

                    {/* Replay link */}
                    {!isActive && session.ended_at && (
                      <div className="mt-2 pt-2 border-t border-tinta-border/40">
                        <Link
                          href={`/mahasiswa/task/${session.task.id}/replay`}
                          className="text-[11px] text-tinta-main hover:text-tinta-accent-hover transition-colors font-medium flex items-center gap-1"
                        >
                          ▶ Watch Replay
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Expired Tasks (no submission) ─────────────────────────────────── */}
        {expiredTasks.length > 0 && (
          <section>
            <SectionLabel>Expired Tasks</SectionLabel>
            <div className="space-y-2">
              {expiredTasks.map(({ task, sessions }) => {
                const closedSessions = sessions.filter(s => !!s.ended_at).length
                const last = sessions.find(s => !!s.ended_at)

                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg border border-tinta-border px-5 py-4 flex items-center justify-between gap-4 opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-tinta-dark truncate">{task.title}</p>
                      <p className="text-xs text-tinta-warm mt-0.5">
                        {closedSessions} session{closedSessions !== 1 ? 's' : ''}
                        {last && ` · Last ${format(new Date(last.started_at), 'd MMM yyyy')}`}
                        {' · '}
                        <span className="text-red-600">Not submitted</span>
                      </p>
                    </div>
                    <Link
                      href={`/mahasiswa/task/${task.id}/replay`}
                      className="text-xs text-tinta-warm hover:text-tinta-dark transition-colors shrink-0 whitespace-nowrap"
                    >
                      ▶ Replay
                    </Link>
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
