'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ChevronLeft, Play, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ReplayPopup } from '@/components/replay/ReplayPopup'
import type { Task, Profile, Submission, Session, PasteEvent, AnomalyFlag, TintaEvent } from '@/types'

function lesBandCls(score: number | null): string {
  if (score === null) return 'text-[#B9B6AD]'
  if (score >= 76) return 'text-green-600'
  if (score >= 56) return 'text-yellow-600'
  if (score >= 31) return 'text-orange-500'
  return 'text-red-600'
}

function lesBandBg(score: number | null): string {
  if (score === null) return 'bg-[#F8F7F5] text-[#B9B6AD]'
  if (score >= 76) return 'bg-green-50 text-green-700'
  if (score >= 56) return 'bg-yellow-50 text-yellow-700'
  if (score >= 31) return 'bg-orange-50 text-orange-700'
  return 'bg-red-50 text-red-700'
}

function lesBandLabel(score: number | null): string {
  if (score === null) return '—'
  if (score >= 76) return 'Baik'
  if (score >= 56) return 'Cukup'
  if (score >= 31) return 'Perlu Tinjauan'
  return 'Perlu Perhatian'
}

function fmtMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}j ${m}m`
  return `${m}m`
}

function severityCls(sev: string): string {
  if (sev === 'high')   return 'text-red-700 bg-red-50 border-red-200'
  if (sev === 'medium') return 'text-orange-700 bg-orange-50 border-orange-200'
  return 'text-yellow-700 bg-yellow-50 border-yellow-200'
}

function pasteTypeCls(type: string | null): string {
  if (type === 'citation')  return 'bg-green-50 text-green-700'
  if (type === 'own_text')  return 'bg-blue-50 text-blue-700'
  return 'bg-amber-50 text-amber-700'
}

export default function DosenStudentPage() {
  const params    = useParams()
  const router    = useRouter()
  const taskId    = params.taskId    as string
  const studentId = params.studentId as string

  const [task,         setTask]         = useState<Task | null>(null)
  const [student,      setStudent]      = useState<Profile | null>(null)
  const [submission,   setSubmission]   = useState<Submission | null>(null)
  const [sessions,     setSessions]     = useState<Session[]>([])
  const [events,       setEvents]       = useState<TintaEvent[]>([])
  const [pasteEvents,  setPasteEvents]  = useState<PasteEvent[]>([])
  const [anomalyFlags, setAnomalyFlags] = useState<AnomalyFlag[]>([])
  const [loading,      setLoading]      = useState(true)
  const [replayOpen,   setReplayOpen]   = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [
        { data: taskData },
        { data: studentData },
      ] = await Promise.all([
        supabase.from('tasks').select('*').eq('id', taskId).single(),
        supabase.from('profiles').select('*').eq('id', studentId).single(),
      ])

      if (!taskData) { router.push('/dosen/dashboard'); return }
      setTask(taskData as Task)
      setStudent(studentData as Profile | null)

      const [
        { data: submissionData },
        { data: sessionsData },
      ] = await Promise.all([
        supabase.from('submissions').select('*').eq('task_id', taskId).eq('student_id', studentId).maybeSingle(),
        supabase.from('sessions').select('*').eq('task_id', taskId).eq('user_id', studentId).order('started_at', { ascending: true }),
      ])

      setSubmission(submissionData as Submission | null)
      const sessArr = (sessionsData ?? []) as Session[]
      setSessions(sessArr)

      if (sessArr.length === 0) { setLoading(false); return }

      const sessionIds = sessArr.map(s => s.id)

      const [
        { data: eventsData },
        { data: pasteData },
        { data: flagsData },
      ] = await Promise.all([
        supabase.from('events').select('*').in('session_id', sessionIds).order('timestamp', { ascending: true }),
        supabase.from('paste_events').select('*').eq('task_id', taskId).eq('student_id', studentId).order('timestamp', { ascending: true }),
        submissionData
          ? supabase.from('anomaly_flags').select('*').eq('submission_id', submissionData.id).order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ])

      setEvents((eventsData ?? []) as TintaEvent[])
      setPasteEvents((pasteData ?? []) as PasteEvent[])
      setAnomalyFlags((flagsData ?? []) as AnomalyFlag[])
      setLoading(false)
    }

    load()
  }, [taskId, studentId, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F7F5] text-[#B9B6AD] text-sm">
        Loading…
      </div>
    )
  }

  const totalActiveMs = sessions.reduce((s, sess) => s + (sess.duration_active_ms ?? 0), 0)
  const totalCharsTyped  = sessions.reduce((s, sess) => s + (sess.chars_typed ?? 0), 0)
  const totalWordInserts = sessions.reduce((s, sess) => s + (sess.line_insertions ?? 0), 0)
  const totalWordDeletes = sessions.reduce((s, sess) => s + (sess.line_deletions  ?? 0), 0)

  return (
    <div className="min-h-screen bg-[#F8F7F5]">

      {/* ── Header ── */}
      <header className="bg-white border-b border-[#B9B6AD]/20 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            href={`/dosen/class/${taskId}`}
            className="flex items-center gap-1 text-sm text-[#B9B6AD] hover:text-[#111111] transition-colors"
          >
            <ChevronLeft size={16} />
            Kelas
          </Link>
          <div className="w-px h-5 bg-[#B9B6AD]/30" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-[#111111] truncate">
              {student?.full_name ?? '—'}
            </h1>
            <p className="text-xs text-[#B9B6AD]">{task?.title}</p>
          </div>
          {sessions.length > 0 && (
            <button
              onClick={() => setReplayOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2D4E71] text-white text-sm font-semibold hover:bg-[#1e3a56] transition-colors shrink-0"
            >
              <Play size={14} />
              Play Replay
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* ── Student + Submission Overview ── */}
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Student card */}
          <div className="bg-white rounded-xl border border-[#B9B6AD]/20 p-5 space-y-3">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-[#B9B6AD]">
              Mahasiswa
            </p>
            <div>
              <p className="text-lg font-semibold text-[#111111]">{student?.full_name}</p>
              <p className="text-sm text-[#B9B6AD]">{student?.npm ?? student?.email}</p>
              {student?.university && (
                <p className="text-xs text-[#B9B6AD] mt-0.5">{student.university}</p>
              )}
            </div>
            <div className="flex gap-4 pt-1 text-xs text-[#B9B6AD] font-mono">
              <span>{sessions.length} sesi</span>
              <span>{fmtMs(totalActiveMs)} aktif</span>
              <span>{totalCharsTyped.toLocaleString('id')} karakter</span>
            </div>
          </div>

          {/* Submission card */}
          <div className="bg-white rounded-xl border border-[#B9B6AD]/20 p-5 space-y-3">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-[#B9B6AD]">
              Submission
            </p>
            {submission ? (
              <>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-bold ${lesBandCls(submission.les_score)}`}>
                    {submission.les_score ?? '—'}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${lesBandBg(submission.les_score)}`}>
                    {lesBandLabel(submission.les_score)}
                  </span>
                  {submission.flag_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-red-600 font-medium ml-auto">
                      <AlertTriangle size={13} />
                      {submission.flag_count} flag
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#B9B6AD]">
                  Dikumpulkan {format(new Date(submission.submitted_at), 'dd MMM yyyy, HH:mm')}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  {submission.organic_ratio !== null && (
                    <div>
                      <span className="text-[#B9B6AD]">Organic ratio</span>
                      <p className="font-medium text-[#111111]">{Math.round((submission.organic_ratio ?? 0) * 100)}%</p>
                    </div>
                  )}
                  {submission.session_count !== null && (
                    <div>
                      <span className="text-[#B9B6AD]">Sesi tercatat</span>
                      <p className="font-medium text-[#111111]">{submission.session_count}</p>
                    </div>
                  )}
                  {submission.ai_likelihood_estimate !== null && (
                    <div>
                      <span className="text-[#B9B6AD]">AI likelihood</span>
                      <p className={`font-medium ${(submission.ai_likelihood_estimate ?? 0) > 0.6 ? 'text-red-600' : 'text-[#111111]'}`}>
                        {Math.round((submission.ai_likelihood_estimate ?? 0) * 100)}%
                      </p>
                    </div>
                  )}
                  {submission.revision_depth !== null && (
                    <div>
                      <span className="text-[#B9B6AD]">Revision depth</span>
                      <p className="font-medium text-[#111111]">{submission.revision_depth}</p>
                    </div>
                  )}
                </div>
              </>
            ) : sessions.length > 0 ? (
              <div className="flex items-center gap-2 text-amber-700">
                <Clock size={15} />
                <span className="text-sm font-medium">Sedang dikerjakan</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[#B9B6AD]">
                <CheckCircle2 size={15} />
                <span className="text-sm">Belum memulai</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Anomaly Flags ── */}
        {anomalyFlags.length > 0 && (
          <section>
            <SectionLabel>Anomali Terdeteksi</SectionLabel>
            <div className="space-y-2">
              {anomalyFlags.map(flag => (
                <div
                  key={flag.id}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${severityCls(flag.severity)}`}
                >
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">{flag.flag_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs opacity-80 mt-0.5">{flag.flag_description}</p>
                  </div>
                  <span className="ml-auto shrink-0 text-[11px] font-semibold uppercase opacity-60">
                    {flag.severity}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Session List ── */}
        <section>
          <SectionLabel>Sesi Penulisan ({sessions.length})</SectionLabel>

          {sessions.length === 0 ? (
            <p className="text-sm text-[#B9B6AD]">Belum ada sesi tercatat.</p>
          ) : (
            <div className="bg-white rounded-xl border border-[#B9B6AD]/20 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#B9B6AD]/20 bg-[#F8F7F5]">
                    {['#', 'Waktu Mulai', 'Durasi', 'Delta', 'Karakter', 'Paste', 'Undo'].map(h => (
                      <th
                        key={h}
                        className="text-left text-[11px] font-semibold tracking-wider uppercase text-[#B9B6AD] px-4 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((sess, i) => (
                    <tr key={sess.id} className="border-b border-[#B9B6AD]/10 last:border-0 hover:bg-[#F8F7F5] transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-[#B9B6AD]">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[#111111]">
                          {format(new Date(sess.started_at), 'dd MMM yyyy')}
                        </p>
                        <p className="text-[11px] text-[#B9B6AD]">
                          {format(new Date(sess.started_at), 'HH:mm')}
                          {sess.ended_at && ` – ${format(new Date(sess.ended_at), 'HH:mm')}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[#111111]">
                        {fmtMs(sess.duration_active_ms)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-green-600 font-mono text-xs font-medium">
                          +{sess.line_insertions ?? 0}
                        </span>
                        {' '}
                        <span className="text-red-500 font-mono text-xs font-medium">
                          -{sess.line_deletions ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[#111111]">
                        {sess.final_doc_length.toLocaleString('id')}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[#111111]">
                        {sess.paste_event_count}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[#111111]">
                        {sess.undo_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#B9B6AD]/20 bg-[#F8F7F5]">
                    <td colSpan={3} className="px-4 py-2 text-[11px] text-[#B9B6AD] font-semibold">Total</td>
                    <td className="px-4 py-2">
                      <span className="text-green-600 font-mono text-xs font-medium">+{totalWordInserts}</span>
                      {' '}
                      <span className="text-red-500 font-mono text-xs font-medium">-{totalWordDeletes}</span>
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-[#111111]">
                      {totalCharsTyped.toLocaleString('id')}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* ── Paste Audit ── */}
        {pasteEvents.length > 0 && (
          <section>
            <SectionLabel>Paste Audit ({pasteEvents.length})</SectionLabel>
            <div className="bg-white rounded-xl border border-[#B9B6AD]/20 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#B9B6AD]/20 bg-[#F8F7F5]">
                    {['Teks', 'Tipe', 'AI likelihood', 'Karakter'].map(h => (
                      <th
                        key={h}
                        className="text-left text-[11px] font-semibold tracking-wider uppercase text-[#B9B6AD] px-4 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pasteEvents.map((pe, i) => (
                    <tr key={pe.id ?? i} className="border-b border-[#B9B6AD]/10 last:border-0 hover:bg-[#F8F7F5] transition-colors">
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-[#111111] truncate">{pe.pasted_text}</p>
                        {pe.source_title && (
                          <p className="text-[11px] text-[#B9B6AD] mt-0.5 truncate">{pe.source_title}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${pasteTypeCls(pe.declared_type)}`}>
                          {pe.declared_type ?? 'undeclared'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {pe.ai_likelihood !== null ? (
                          <span className={`text-xs font-mono font-medium ${(pe.ai_likelihood ?? 0) > 0.6 ? 'text-red-600' : 'text-[#111111]'}`}>
                            {Math.round((pe.ai_likelihood ?? 0) * 100)}%
                          </span>
                        ) : (
                          <span className="text-xs text-[#B9B6AD]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[#B9B6AD]">
                        {pe.pasted_char_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Final Document ── */}
        {submission?.final_doc_text && (
          <section>
            <SectionLabel>Dokumen Final</SectionLabel>
            <div className="bg-white rounded-xl border border-[#B9B6AD]/20 p-5">
              <p className="text-sm text-[#111111] leading-relaxed whitespace-pre-wrap font-dm-sans">
                {submission.final_doc_text}
              </p>
            </div>
          </section>
        )}

      </main>

      {/* ── Replay Popup ── */}
      <ReplayPopup
        isOpen={replayOpen}
        onClose={() => setReplayOpen(false)}
        events={events}
        sessions={sessions}
        pasteEvents={pasteEvents}
        anomalyFlags={anomalyFlags}
        submission={submission}
        studentName={student?.full_name ?? 'Student'}
        taskTitle={task?.title ?? 'Assignment'}
      />
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#B9B6AD] mb-4">
      {children}
    </h2>
  )
}
