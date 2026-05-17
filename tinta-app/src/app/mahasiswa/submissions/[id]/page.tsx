'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Submission, Task, Session, PasteEvent, DocumentReference, AnomalyFlag } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmissionDetail {
  submission:  Submission
  task:        Task
  sessions:    Session[]
  pastes:      PasteEvent[]
  references:  DocumentReference[]
  flags:       AnomalyFlag[]
  dosenNote:   string | null
  reviewStatus: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function signalColor(value: number, inverted = false): string {
  const v = inverted ? 1 - value : value
  if (v >= 0.7) return 'bg-green-500'
  if (v >= 0.4) return 'bg-amber-400'
  return 'bg-red-400'
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

function lesBandColor(band: string | null): string {
  switch (band) {
    case 'Baik':            return 'text-green-700 bg-green-50'
    case 'Cukup':           return 'text-blue-700 bg-blue-50'
    case 'Perlu Tinjauan':  return 'text-amber-700 bg-amber-50'
    case 'Perlu Perhatian': return 'text-red-700 bg-red-50'
    default:                return 'text-gray-600 bg-gray-50'
  }
}

function reviewStatusInfo(status: string): { label: string; cls: string; icon: string } {
  switch (status) {
    case 'cleared':           return { label: 'Cleared',                  cls: 'text-green-700 bg-green-50 border-green-200',  icon: '✓' }
    case 'minta_klarifikasi': return { label: 'Clarification Requested',  cls: 'text-amber-700 bg-amber-50 border-amber-200',  icon: '⚠' }
    case 'eskalasi':          return { label: 'Under Scrutiny',           cls: 'text-red-700 bg-red-50 border-red-200',        icon: '🔴' }
    default:                  return { label: 'Pending Review',           cls: 'text-gray-600 bg-gray-50 border-gray-200',     icon: '⏳' }
  }
}

function flagSeverityColor(severity: string): string {
  switch (severity) {
    case 'high':   return 'border-red-300 bg-red-50 text-red-800'
    case 'medium': return 'border-amber-300 bg-amber-50 text-amber-800'
    default:       return 'border-blue-200 bg-blue-50 text-blue-800'
  }
}

// ─── Signal Row ───────────────────────────────────────────────────────────────

function SignalRow({
  label, description, value, inverted = false
}: {
  label: string; description: string; value: number | null; inverted?: boolean
}) {
  if (value === null || value === undefined) return null
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  const barColor = signalColor(value, inverted)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#111111]">{label}</span>
        <span className="text-[11px] text-[#6b7280]">{pct}%</span>
      </div>
      <div className="h-1.5 bg-[#F8F7F5] rounded-full overflow-hidden border border-[#B9B6AD]/20">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-[#B9B6AD]">{description}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SubmissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [data,    setData]    = useState<SubmissionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Fetch submission + task
      const { data: sub, error: subErr } = await supabase
        .from('submissions')
        .select('*, tasks(*)')
        .eq('id', id)
        .eq('student_id', user.id)
        .single()

      if (subErr || !sub) {
        setError('Submission not found.')
        setLoading(false)
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const submission = sub as any
      const task       = submission.tasks as Task

      // Parallel fetches
      const [
        { data: sessions },
        { data: pastes },
        { data: refs },
        { data: flags },
        { data: reviews },
      ] = await Promise.all([
        supabase
          .from('sessions')
          .select('*')
          .eq('task_id', task.id)
          .eq('user_id', user.id)
          .order('started_at', { ascending: true }),
        supabase
          .from('paste_events')
          .select('*')
          .eq('submission_id', id)
          .order('timestamp', { ascending: true }),
        supabase
          .from('document_references')
          .select('*')
          .eq('submission_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('anomaly_flags')
          .select('*')
          .eq('submission_id', id),
        supabase
          .from('dosen_reviews')
          .select('*')
          .eq('submission_id', id)
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      const latestReview = reviews?.[0] ?? null

      setData({
        submission:   sub as unknown as Submission,
        task,
        sessions:     (sessions ?? []) as Session[],
        pastes:       (pastes ?? []) as PasteEvent[],
        references:   (refs ?? []) as DocumentReference[],
        flags:        (flags ?? []) as AnomalyFlag[],
        dosenNote:    latestReview?.note ?? sub.dosen_note ?? null,
        reviewStatus: sub.dosen_review_status,
      })

      setLoading(false)
    }

    load()
  }, [id, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F7F5] text-[#B9B6AD] text-sm">
        Loading submission…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F7F5] gap-3">
        <p className="text-sm text-[#6b7280]">{error ?? 'Something went wrong.'}</p>
        <Link href="/mahasiswa/dashboard" className="text-sm text-[#2D4E71] hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  const { submission, task, sessions, pastes, references, flags, dosenNote, reviewStatus } = data

  const closedSessions    = sessions.filter(s => !!s.ended_at)
  const totalActiveMs     = closedSessions.reduce((s, sess) => s + (sess.duration_active_ms ?? 0), 0)
  const wordCount         = submission.final_doc_text
    ? Math.round(submission.final_doc_text.trim().split(/\s+/).length)
    : Math.round((closedSessions[closedSessions.length - 1]?.final_doc_length ?? 0) / 5.5)
  const undeclaredPastes  = pastes.filter(p => !p.declared_type)
  const review            = reviewStatusInfo(reviewStatus)
  const needsAction       = reviewStatus === 'minta_klarifikasi' || reviewStatus === 'eskalasi'

  return (
    <div className="min-h-screen bg-[#F8F7F5]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-[#B9B6AD]/30 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/mahasiswa/dashboard" className="text-[#B9B6AD] hover:text-[#111111] text-sm transition-colors shrink-0">
              ← Dashboard
            </Link>
            <span className="text-[#B9B6AD]/40">/</span>
            <span className="text-sm font-medium text-[#111111] truncate">{task.title}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/mahasiswa/task/${task.id}/replay`}
              className="text-xs text-[#2D4E71] hover:text-[#1e3a56] font-medium transition-colors"
            >
              ▶ Watch Replay
            </Link>
            <a
              href={`/api/submissions/${id}/bukti-proses`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#6b7280] hover:text-[#111111] transition-colors"
            >
              ⬇ Proof of Work PDF
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* ── A: Proof of Work Hero ─────────────────────────────────────────── */}
        <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#B9B6AD] uppercase tracking-widest font-semibold mb-1">Submission</p>
              <h1 className="text-xl font-bold text-[#111111] leading-snug">{task.title}</h1>
              <p className="text-sm text-[#6b7280] mt-1">
                Submitted {format(new Date(submission.submitted_at), 'EEEE, d MMMM yyyy, HH:mm')}
              </p>
            </div>

            {/* LES Badge */}
            {submission.les_score != null ? (
              <div className="flex flex-col items-end gap-1 shrink-0">
                <p className="text-[10px] text-[#B9B6AD] uppercase tracking-widest">LES Score</p>
                <div className={`text-3xl font-black ${
                  submission.les_score >= 76 ? 'text-green-600' :
                  submission.les_score >= 56 ? 'text-blue-600' :
                  submission.les_score >= 31 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {submission.les_score}
                </div>
                {submission.les_band && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${lesBandColor(submission.les_band)}`}>
                    {lesBandLabel(submission.les_band)}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1 shrink-0">
                <p className="text-[10px] text-[#B9B6AD] uppercase tracking-widest">LES Score</p>
                <span className="text-sm text-[#B9B6AD]">Pending</span>
              </div>
            )}
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#B9B6AD]/20">
            <StatPill label="Sessions" value={String(closedSessions.length)} />
            <StatPill label="Active Time" value={totalActiveMs > 0 ? fmtDuration(totalActiveMs) : '—'} />
            <StatPill label="Words" value={wordCount.toLocaleString('en')} />
            <StatPill label="References" value={String(references.length)} />
          </div>

          {/* Review status */}
          <div className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${review.cls}`}>
            <span>{review.icon}</span>
            <span className="font-medium">{review.label}</span>
            {submission.finalized && (
              <span className="ml-auto text-xs opacity-70">Finalized</span>
            )}
          </div>
        </div>

        {/* ── F: Clarification Section (shows only when needed) ─────────────── */}
        {needsAction && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <p className="text-sm font-semibold text-amber-800 mb-2">
              {reviewStatus === 'eskalasi' ? '🔴 This submission is under further scrutiny' : '⚠ Your lecturer has requested clarification'}
            </p>
            {dosenNote && (
              <blockquote className="text-sm text-amber-800 border-l-2 border-amber-400 pl-3 italic">
                &ldquo;{dosenNote}&rdquo;
              </blockquote>
            )}
            <p className="text-xs text-amber-700 mt-3">
              Please contact your lecturer directly or respond through the provided channel. TINTA records your writing process transparently so you can show your work at any time.
            </p>
            <a
              href={`/mahasiswa/task/${task.id}/replay`}
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
            >
              ▶ Show them your replay
            </a>
          </div>
        )}

        {/* ── G: Grade (if finalized) ──────────────────────────────────────── */}
        {submission.finalized && (submission.nilai_konten != null || submission.nilai_proses != null) && (
          <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-6">
            <p className="text-[11px] text-[#B9B6AD] uppercase tracking-widest font-semibold mb-4">Grade</p>
            <div className="flex items-center gap-8 flex-wrap">
              {submission.nilai_konten != null && (
                <div>
                  <p className="text-[10px] text-[#B9B6AD] uppercase tracking-wide mb-1">Content</p>
                  <p className="text-4xl font-black text-[#2D4E71]">{submission.nilai_konten}</p>
                </div>
              )}
              {submission.nilai_proses != null && (
                <div>
                  <p className="text-[10px] text-[#B9B6AD] uppercase tracking-wide mb-1">Process</p>
                  <p className="text-4xl font-black text-[#2D4E71]">{submission.nilai_proses}</p>
                </div>
              )}
              {submission.nilai_konten != null && submission.nilai_proses != null && (
                <div className="ml-auto">
                  <p className="text-[10px] text-[#B9B6AD] uppercase tracking-wide mb-1">Combined</p>
                  <p className="text-4xl font-black text-[#111111]">
                    {Math.round((submission.nilai_konten + submission.nilai_proses) / 2)}
                  </p>
                </div>
              )}
            </div>
            {dosenNote && reviewStatus === 'cleared' && (
              <blockquote className="text-sm text-[#6b7280] border-l-2 border-[#B9B6AD]/40 pl-3 mt-4 italic">
                &ldquo;{dosenNote}&rdquo;
              </blockquote>
            )}
          </div>
        )}

        {/* ── B: LES Breakdown ────────────────────────────────────────────────── */}
        {submission.les_score != null && (
          <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[11px] text-[#B9B6AD] uppercase tracking-widest font-semibold">Writing Integrity Signals</p>
              <span className="text-[10px] text-[#B9B6AD]">How your LES was computed</span>
            </div>

            <div className="space-y-4">
              <SignalRow
                label="Revision Depth"
                description="How much you edited vs. how much you typed. Higher = more authentic revision process."
                value={submission.revision_depth}
              />
              <SignalRow
                label="Organic Writing Rate"
                description="Proportion of your final document written keystroke-by-keystroke. Higher = more original typing."
                value={submission.organic_ratio}
              />
              <SignalRow
                label="Reference Transparency"
                description="How consistently you declared your paste sources. Higher = better citation practice."
                value={submission.paste_declaration_rate}
              />
              <SignalRow
                label="Typing Consistency"
                description="Regularity of your typing speed across sessions. Higher = natural writing pattern."
                value={submission.velocity_consistency}
              />
              <SignalRow
                label="Focus Score"
                description="How focused you were during writing (fewer tab switches = higher score)."
                value={submission.tab_switch_score}
              />
              {submission.ai_likelihood_estimate != null && (
                <SignalRow
                  label="AI Likelihood"
                  description="Estimated probability that text was AI-generated. Lower is better."
                  value={submission.ai_likelihood_estimate}
                  inverted
                />
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-[#B9B6AD]/20 flex items-start gap-2 bg-[#AABED6]/10 rounded-xl px-3 py-2.5">
              <span className="text-[#2D4E71] text-sm shrink-0">ℹ</span>
              <p className="text-[10px] text-[#374151] leading-relaxed">
                TINTA uses these signals to support your lecturer, not to automatically judge your work. All data reflects your actual writing sessions in this environment.
              </p>
            </div>
          </div>
        )}

        {/* ── D: Session History ──────────────────────────────────────────────── */}
        <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-6">
          <p className="text-[11px] text-[#B9B6AD] uppercase tracking-widest font-semibold mb-4">Session History</p>

          {closedSessions.length === 0 ? (
            <p className="text-sm text-[#B9B6AD]">No completed sessions found.</p>
          ) : (
            <div className="space-y-2">
              {closedSessions.map((sess, i) => {
                const startFmt = format(new Date(sess.started_at), 'EEE, d MMM yyyy')
                const startTime = format(new Date(sess.started_at), 'HH:mm')
                const endTime   = sess.ended_at ? format(new Date(sess.ended_at), 'HH:mm') : '—'
                const dur       = sess.duration_active_ms > 0 ? fmtDuration(sess.duration_active_ms) : null

                return (
                  <div
                    key={sess.id}
                    className="flex items-start gap-4 px-4 py-3 rounded-xl bg-[#F8F7F5] border border-[#B9B6AD]/15"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2D4E71]/10 text-[#2D4E71] text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-[#374151]">
                        {startFmt} · {startTime} – {endTime}
                        {dur && <span className="text-[#B9B6AD] font-normal"> · {dur} active</span>}
                      </p>
                      <div className="flex items-center gap-4 mt-1.5 text-[11px] font-mono">
                        <span className="text-green-600">+{sess.line_insertions ?? 0}</span>
                        <span className="text-red-500">-{sess.line_deletions ?? 0}</span>
                        {sess.paste_event_count > 0 && (
                          <span className="text-[#B9B6AD]">{sess.paste_event_count} paste{sess.paste_event_count !== 1 ? 's' : ''}</span>
                        )}
                        {sess.undo_count > 0 && (
                          <span className="text-[#B9B6AD]">{sess.undo_count} undo</span>
                        )}
                        {sess.final_doc_length > 0 && (
                          <span className="text-[#B9B6AD] ml-auto">
                            {Math.round(sess.final_doc_length / 5.5).toLocaleString('en')} words
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── E: References & Pastes ─────────────────────────────────────────── */}
        {(references.length > 0 || pastes.length > 0) && (
          <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] text-[#B9B6AD] uppercase tracking-widest font-semibold">References & Sources</p>
              {undeclaredPastes.length > 0 && (
                <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {undeclaredPastes.length} undeclared paste{undeclaredPastes.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {references.length > 0 && (
              <div className="space-y-2 mb-4">
                {references.map(ref => (
                  <div
                    key={ref.id}
                    className="px-4 py-3 rounded-xl bg-[#F8F7F5] border border-[#B9B6AD]/15"
                  >
                    <p className="text-xs text-[#111111] leading-snug">
                      &ldquo;{ref.sentence_text}&rdquo;
                    </p>
                    {(ref.source_title || ref.source_author) && (
                      <p className="text-[10px] text-[#6b7280] mt-1">
                        {ref.source_author && `${ref.source_author}. `}
                        {ref.source_title}
                        {ref.source_year && ` (${ref.source_year})`}
                      </p>
                    )}
                    {ref.source_url && (
                      <a href={ref.source_url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-[#2D4E71] hover:underline truncate block">
                        {ref.source_url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {pastes.length > 0 && references.length === 0 && (
              <div className="space-y-2">
                {pastes.map(p => (
                  <div
                    key={p.id}
                    className={`px-4 py-3 rounded-xl border ${
                      !p.declared_type ? 'bg-amber-50 border-amber-200' : 'bg-[#F8F7F5] border-[#B9B6AD]/15'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-[#111111] leading-snug line-clamp-2">
                        {p.pasted_text}
                      </p>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
                        !p.declared_type ? 'bg-amber-200 text-amber-800' : 'bg-green-100 text-green-700'
                      }`}>
                        {p.declared_type ?? 'Undeclared'}
                      </span>
                    </div>
                    {p.source_title && (
                      <p className="text-[10px] text-[#6b7280] mt-1">{p.source_title}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/mahasiswa/references"
              className="inline-flex items-center gap-1 mt-4 text-xs text-[#2D4E71] hover:text-[#1e3a56] font-medium transition-colors"
            >
              Manage all references →
            </Link>
          </div>
        )}

        {/* ── Anomaly Flags (show only if present) ────────────────────────────── */}
        {flags.length > 0 && (
          <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-6">
            <p className="text-[11px] text-[#B9B6AD] uppercase tracking-widest font-semibold mb-4">Flags Detected</p>
            <p className="text-xs text-[#6b7280] mb-3">
              These patterns were automatically flagged by TINTA. They do not automatically mean wrongdoing — your lecturer reviews each one.
            </p>
            <div className="space-y-2">
              {flags.map(flag => (
                <div
                  key={flag.id}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${flagSeverityColor(flag.severity)}`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 shrink-0 opacity-60" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold capitalize">{flag.flag_type.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{flag.flag_description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-[#B9B6AD] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-bold text-[#111111]">{value}</p>
    </div>
  )
}
