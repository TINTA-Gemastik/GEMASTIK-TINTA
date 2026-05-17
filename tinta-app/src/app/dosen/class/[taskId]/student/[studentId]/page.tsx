'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ChevronLeft, Play, ChevronDown, ChevronUp,
  CheckCircle2, MessageSquare, AlertOctagon, Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LESBadge }  from '@/components/dashboard/LESBadge'
import { FlagBadge } from '@/components/dashboard/FlagBadge'
import { ReplayPopup } from '@/components/replay/ReplayPopup'
import { buildDocumentTimeline } from '@/lib/replay/reconstructor'
import { TimelineGraph }  from '@/components/replay/TimelineGraph'
import type {
  Task, Profile, Submission, Session,
  PasteEvent, AnomalyFlag, TintaEvent,
} from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function pasteTypeBadge(type: string | null) {
  if (type === 'citation')  return 'bg-green-50 border-green-200 text-green-700'
  if (type === 'own_text')  return 'bg-blue-50 border-blue-200 text-blue-700'
  if (type === 'benign')    return 'bg-slate-50 border-slate-200 text-slate-500'
  return 'bg-amber-50 border-amber-200 text-amber-700'
}

function pasteTypeLabel(type: string | null) {
  if (type === 'citation')  return 'Citation'
  if (type === 'own_text')  return 'Own text'
  if (type === 'benign')    return 'Benign'
  return 'Undeclared'
}

const SIGNAL_META = [
  {
    key:  'revision_depth',
    label: 'Revision Depth',
    desc:  'How much text was edited or deleted relative to what was typed. Higher revision = more organic thinking.',
    getValue: (s: Submission) => {
      if (s.revision_depth === null) return null
      return Math.min(1, s.revision_depth / 40)
    },
    display: (s: Submission) => s.revision_depth !== null ? `${s.revision_depth}%` : '—',
  },
  {
    key:  'session_distribution',
    label: 'Session Distribution',
    desc:  'Whether the student wrote across multiple sessions over multiple days.',
    getValue: (s: Submission) => {
      if (s.session_count === null) return null
      return Math.min(1, (s.session_count - 1) / 4)
    },
    display: (s: Submission) => s.session_count !== null ? `${s.session_count} sessions` : '—',
  },
  {
    key:  'organic_writing',
    label: 'Organic Writing Ratio',
    desc:  'What percentage of the final document was typed directly (not pasted).',
    getValue: (s: Submission) => s.organic_ratio,
    display: (s: Submission) => s.organic_ratio !== null ? `${Math.round(s.organic_ratio * 100)}%` : '—',
  },
  {
    key:  'source_declaration',
    label: 'Source Declaration',
    desc:  'What percentage of paste events had a source declared.',
    getValue: (s: Submission) => s.paste_declaration_rate,
    display: (s: Submission) => s.paste_declaration_rate !== null ? `${Math.round(s.paste_declaration_rate * 100)}%` : '—',
  },
  {
    key:  'velocity_consistency',
    label: 'Writing Velocity',
    desc:  'Whether typing speed was consistent (uniform = suspicious) or naturally varied.',
    getValue: (s: Submission) => s.velocity_consistency,
    display: (s: Submission) => s.velocity_consistency !== null ? `${Math.round(s.velocity_consistency * 100)}%` : '—',
  },
  {
    key:  'tab_switch_score',
    label: 'Tab Switch Pattern',
    desc:  'Whether tab-switching correlated with immediate typing bursts (read-then-type pattern).',
    getValue: (s: Submission) => s.tab_switch_score,
    display: (s: Submission) => s.tab_switch_score !== null ? `${Math.round(s.tab_switch_score * 100)}%` : '—',
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

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

  // Section G — review
  const [reviewStatus,  setReviewStatus]  = useState<string>('pending')
  const [reviewNote,    setReviewNote]    = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [reviewSaving,  setReviewSaving]  = useState(false)
  const [reviewToast,   setReviewToast]   = useState<string | null>(null)

  // Section H — grading
  const [gradeContent,   setGradeContent]   = useState<string>('')
  const [gradeProcess,   setGradeProcess]   = useState<string>('')
  const [gradeNote,      setGradeNote]      = useState<string>('')
  const [gradeFinalized, setGradeFinalized] = useState(false)
  const [gradeSaving,    setGradeSaving]    = useState(false)
  const [gradeToast,     setGradeToast]     = useState<string | null>(null)
  const [showGradeConfirm, setShowGradeConfirm] = useState(false)

  // Expandable sessions
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Data load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: taskData }, { data: studentData }] = await Promise.all([
        supabase.from('tasks').select('*').eq('id', taskId).single(),
        supabase.from('profiles').select('*').eq('id', studentId).single(),
      ])
      if (!taskData) { router.push('/dosen/dashboard'); return }
      setTask(taskData as Task)
      setStudent(studentData as Profile | null)

      const [{ data: subData }, { data: sessData }] = await Promise.all([
        supabase.from('submissions').select('*').eq('task_id', taskId).eq('student_id', studentId).maybeSingle(),
        supabase.from('sessions').select('*').eq('task_id', taskId).eq('user_id', studentId).order('started_at', { ascending: true }),
      ])
      const sub  = subData as Submission | null
      const sess = (sessData ?? []) as Session[]
      setSubmission(sub)
      setSessions(sess)
      if (sub) {
        setReviewStatus(sub.dosen_review_status ?? 'pending')
        setGradeContent(sub.nilai_konten?.toString() ?? '')
        setGradeProcess(sub.nilai_proses?.toString() ?? '')
        setGradeNote(sub.dosen_note ?? '')
        setGradeFinalized(sub.finalized ?? false)
      }

      if (sess.length === 0) { setLoading(false); return }
      const sessionIds = sess.map(s => s.id)

      const [{ data: evData }, { data: peData }, { data: afData }] = await Promise.all([
        supabase.from('events').select('*').in('session_id', sessionIds).order('timestamp', { ascending: true }),
        supabase.from('paste_events').select('*').eq('task_id', taskId).eq('student_id', studentId).order('timestamp', { ascending: true }),
        sub
          ? supabase.from('anomaly_flags').select('*').eq('submission_id', sub.id).order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ])
      setEvents((evData ?? []) as TintaEvent[])
      setPasteEvents((peData ?? []) as PasteEvent[])
      setAnomalyFlags((afData ?? []) as AnomalyFlag[])
      setLoading(false)
    }
    load()
  }, [taskId, studentId, router])

  // ── Toast helper ──────────────────────────────────────────────────────────
  function showToast(setter: (v: string | null) => void, msg: string) {
    setter(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setter(null), 3000)
  }

  // ── Review actions ────────────────────────────────────────────────────────
  async function submitReview(decision: 'cleared' | 'minta_klarifikasi' | 'eskalasi') {
    if (!submission) return
    setReviewSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await Promise.all([
      supabase.from('submissions').update({ dosen_review_status: decision }).eq('id', submission.id),
      supabase.from('dosen_reviews').insert({
        submission_id: submission.id,
        dosen_id:      user!.id,
        decision,
        note:          reviewNote || null,
      }),
    ])
    setReviewStatus(decision)
    setShowNoteInput(false)
    setReviewSaving(false)
    showToast(setReviewToast, `Decision saved: ${decision.replace(/_/g, ' ')}`)
  }

  // ── Grade save ────────────────────────────────────────────────────────────
  async function saveGrade(finalize: boolean) {
    if (!submission) return
    setGradeSaving(true)
    const supabase = createClient()
    await supabase.from('submissions').update({
      nilai_konten: gradeContent ? parseInt(gradeContent) : null,
      nilai_proses: gradeProcess ? parseInt(gradeProcess) : null,
      dosen_note:   gradeNote || null,
      finalized:    finalize,
    }).eq('id', submission.id)
    setGradeFinalized(finalize)
    setGradeSaving(false)
    setShowGradeConfirm(false)
    showToast(setGradeToast, finalize ? 'Grade finalized.' : 'Draft saved.')
  }

  // ── Timeline data ─────────────────────────────────────────────────────────
  const timeline = events.length > 0 ? buildDocumentTimeline(events, sessions) : []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] text-[#B9B6AD] text-sm">
        Loading…
      </div>
    )
  }

  const totalActiveMs  = sessions.reduce((s, se) => s + (se.duration_active_ms ?? 0), 0)
  const totalInserts   = sessions.reduce((s, se) => s + (se.line_insertions ?? 0), 0)
  const totalDeletes   = sessions.reduce((s, se) => s + (se.line_deletions  ?? 0), 0)

  // Paste events grouped by session id
  const pasteBySession: Record<string, PasteEvent[]> = {}
  for (const pe of pasteEvents) {
    const sess = sessions.find(s =>
      pe.timestamp >= new Date(s.started_at).getTime() &&
      (!s.ended_at || pe.timestamp <= new Date(s.ended_at).getTime())
    )
    const sid = sess?.id ?? 'unknown'
    if (!pasteBySession[sid]) pasteBySession[sid] = []
    pasteBySession[sid].push(pe)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">

      {/* ── Header ── */}
      <header className="bg-white border-b border-[#B9B6AD]/20 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            href={`/dosen/class/${taskId}`}
            className="flex items-center gap-1 text-sm text-[#B9B6AD] hover:text-[#111111] transition-colors"
          >
            <ChevronLeft size={16} />Back to Class
          </Link>
          <div className="w-px h-5 bg-[#B9B6AD]/30" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-[#111111] truncate">{student?.full_name}</h1>
            <p className="text-xs text-[#B9B6AD]">{task?.title}</p>
          </div>
          {sessions.length > 0 && (
            <button
              onClick={() => setReplayOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2D4E71] text-white text-sm font-semibold hover:bg-[#1e3a56] transition-colors shrink-0"
            >
              <Play size={14} />
              Watch Replay
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* ── SECTION A: Header card ── */}
        <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-[#111111]">{student?.full_name}</h2>
              <p className="text-sm text-[#6b7280]">{student?.npm ?? student?.email}</p>
              {student?.university && <p className="text-xs text-[#B9B6AD] mt-0.5">{student.university}</p>}
            </div>
            <div className="text-right shrink-0">
              {submission ? (
                <>
                  <p className="text-xs text-[#B9B6AD]">Submitted</p>
                  <p className="text-sm font-medium text-[#111111]">
                    {format(new Date(submission.submitted_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#B9B6AD]">Not submitted</p>
              )}
            </div>
          </div>
          <LESBadge score={submission?.les_score ?? null} band={submission?.les_band ?? null} />
          <div className="flex gap-4 text-xs text-[#6b7280] font-mono pt-1">
            <span>{sessions.length} sessions</span>
            <span>{fmtMs(totalActiveMs)} active</span>
            <span className="text-green-600">+{totalInserts} ins</span>
            <span className="text-red-500">−{totalDeletes} del</span>
          </div>
        </div>

        {/* ── SECTION B: Behavioral Signal Breakdown ── */}
        <section>
          <SectionLabel>Learning Evidence Signals</SectionLabel>
          <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl divide-y divide-[#B9B6AD]/10 overflow-hidden">
            {SIGNAL_META.map(sig => {
              const val = submission ? sig.getValue(submission) : null
              const pct = val !== null ? Math.round(Math.min(1, Math.max(0, val)) * 100) : 0

              return (
                <div key={sig.key} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-36 shrink-0">
                    <p className="text-xs font-semibold text-[#111111]">{sig.label}</p>
                    <p className="text-[10px] text-[#B9B6AD] mt-0.5">
                      {submission ? sig.display(submission) : '—'}
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 bg-[#F8F7F5] rounded-full overflow-hidden border border-[#B9B6AD]/20">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-8 text-right">
                    <span className="text-xs font-mono text-[#6b7280]">{val !== null ? `${pct}%` : '—'}</span>
                  </div>
                  <div className="w-4 shrink-0 group relative">
                    <Info size={13} className="text-[#B9B6AD] cursor-help" />
                    <div className="absolute right-0 top-5 w-56 bg-[#111111] text-white text-[11px] leading-snug p-2.5 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
                      {sig.desc}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* AI Likelihood + Confidence rows */}
            {submission?.ai_likelihood_estimate !== null && (
              <div className="px-5 py-4 flex items-center gap-4 bg-amber-50/40">
                <div className="w-36 shrink-0">
                  <p className="text-xs font-semibold text-[#111111]">Behavioral AI Likelihood</p>
                  <p className="text-[10px] text-[#B9B6AD] mt-0.5">
                    {submission?.ai_likelihood_estimate != null
                      ? `${Math.round((submission.ai_likelihood_estimate) * 100)}%`
                      : '—'}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-[#6b7280] italic">
                    Estimated from keystroke patterns. Not a definitive verdict — dosen judgment required.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── SECTION C: Session History ── */}
        <section>
          <SectionLabel>Writing Sessions ({sessions.length})</SectionLabel>
          {sessions.length === 0 ? (
            <p className="text-sm text-[#B9B6AD]">No sessions recorded.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((sess, i) => {
                const isExpanded = expandedSession === sess.id
                const sessPastes = pasteBySession[sess.id] ?? []

                return (
                  <div
                    key={sess.id}
                    className="bg-white border border-[#B9B6AD]/30 rounded-2xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedSession(isExpanded ? null : sess.id)}
                      className="w-full text-left px-5 py-4 hover:bg-[#f8fafc] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[#111111]">
                            Session {i + 1} — {format(new Date(sess.started_at), 'EEEE, d MMM yyyy')}
                            <span className="font-normal text-[#6b7280] ml-2 text-xs">
                              {format(new Date(sess.started_at), 'HH:mm')}
                              {sess.ended_at && ` – ${format(new Date(sess.ended_at), 'HH:mm')}`}
                              {' '}({fmtMs(sess.duration_active_ms)} active)
                            </span>
                          </p>
                          <div className="flex gap-4 mt-1.5 font-mono text-xs flex-wrap">
                            <span className="text-green-600 font-medium">+{sess.line_insertions ?? 0} insertions(+)</span>
                            <span className="text-red-500 font-medium">−{sess.line_deletions ?? 0} deletions(-)</span>
                            {sess.paste_event_count > 0 && <span className="text-[#6b7280]">{sess.paste_event_count} pastes</span>}
                            {sess.undo_count > 0 && <span className="text-[#6b7280]">{sess.undo_count} undo</span>}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-[#B9B6AD] shrink-0" /> : <ChevronDown size={16} className="text-[#B9B6AD] shrink-0" />}
                      </div>
                    </button>

                    {isExpanded && sessPastes.length > 0 && (
                      <div className="border-t border-[#B9B6AD]/20 px-5 py-3 bg-[#f8fafc] space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#B9B6AD] mb-2">Pastes in this session</p>
                        {sessPastes.map((pe, pi) => (
                          <div key={pe.id ?? pi} className="flex items-center gap-3 text-xs">
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-md border font-medium text-[11px] ${pasteTypeBadge(pe.declared_type)}`}>
                              {pasteTypeLabel(pe.declared_type)}
                            </span>
                            <span className="text-[#111111] truncate">{pe.pasted_text.slice(0, 80)}{pe.pasted_text.length > 80 ? '…' : ''}</span>
                            <span className="text-[#B9B6AD] ml-auto shrink-0">{pe.pasted_char_count} chars</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {isExpanded && sessPastes.length === 0 && (
                      <div className="border-t border-[#B9B6AD]/20 px-5 py-3 bg-[#f8fafc]">
                        <p className="text-xs text-[#B9B6AD]">No paste events in this session.</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── SECTION D: Timeline Graph ── */}
        {timeline.length > 0 && (
          <section>
            <SectionLabel>Writing Timeline</SectionLabel>
            <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-5 overflow-hidden">
              <TimelineGraph
                timeline={timeline}
                pasteEvents={pasteEvents}
                sessions={sessions}
                anomalyFlags={anomalyFlags}
                currentTimestamp={timeline[0]?.timestamp ?? 0}
                onSeek={() => {}}
              />
            </div>
          </section>
        )}

        {/* ── SECTION E: Paste Audit Table ── */}
        {pasteEvents.length > 0 && (
          <section>
            <SectionLabel>Paste Events ({pasteEvents.length})</SectionLabel>
            <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#B9B6AD]/20 bg-[#f8fafc]">
                    {['Time', 'Preview', 'Length', 'Type', 'Source', 'AI Risk'].map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold tracking-wider uppercase text-[#B9B6AD] px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pasteEvents.map((pe, i) => {
                    const aiRisk = pe.ai_likelihood ?? null
                    const isHighRisk = aiRisk !== null && aiRisk > 0.6

                    return (
                      <tr key={pe.id ?? i} className="border-b border-[#B9B6AD]/10 last:border-0 hover:bg-[#f8fafc] transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-[#6b7280] whitespace-nowrap">
                          {format(new Date(pe.timestamp), 'dd MMM, HH:mm')}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-xs text-[#111111] truncate">{pe.pasted_text.slice(0, 60)}{pe.pasted_text.length > 60 ? '…' : ''}</p>
                          {pe.source_title && (
                            <p className="text-[10px] text-[#B9B6AD] truncate">{pe.source_title}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-[#B9B6AD]">{pe.pasted_char_count}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md border ${pasteTypeBadge(pe.declared_type)}`}>
                            {pasteTypeLabel(pe.declared_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#6b7280] max-w-[120px] truncate">
                          {pe.source_title ?? pe.source_url ?? <span className="text-[#B9B6AD]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {aiRisk !== null ? (
                            <span className={`text-xs font-mono font-semibold ${isHighRisk ? 'text-red-600' : 'text-[#6b7280]'}`}>
                              {Math.round(aiRisk * 100)}%
                            </span>
                          ) : <span className="text-[#B9B6AD] text-xs">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── SECTION F: Anomaly Flags ── */}
        <section>
          <SectionLabel>Anomaly Flags</SectionLabel>
          {anomalyFlags.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
              <CheckCircle2 size={16} />
              No anomalies detected for this submission.
            </div>
          ) : (
            <div className="space-y-2">
              {anomalyFlags.map(flag => (
                <FlagBadge
                  key={flag.id}
                  flagType={flag.flag_type}
                  flagDescription={flag.flag_description}
                  severity={flag.severity}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── SECTION G: Flag Review Panel ── */}
        {submission && (
          <section>
            <SectionLabel>Review Decision</SectionLabel>
            <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-6 space-y-4">
              {reviewStatus !== 'pending' ? (
                <div className="space-y-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${
                    reviewStatus === 'cleared'            ? 'bg-green-50 text-green-700 border border-green-200' :
                    reviewStatus === 'minta_klarifikasi'  ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {reviewStatus === 'cleared'           ? '✅ No Issue — Cleared' :
                     reviewStatus === 'minta_klarifikasi' ? '💬 Clarification Requested' :
                     '🚨 Escalated'}
                  </div>
                  {reviewNote && <p className="text-sm text-[#6b7280]">{reviewNote}</p>}
                  <button
                    onClick={() => setReviewStatus('pending')}
                    className="text-xs text-[#2D4E71] hover:underline"
                  >
                    Change decision
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-[#6b7280]">Choose a review outcome for this submission:</p>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => submitReview('cleared')}
                      disabled={reviewSaving}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 size={15} />
                      No Issue
                    </button>
                    <button
                      onClick={() => setShowNoteInput(true)}
                      disabled={reviewSaving}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                      <MessageSquare size={15} />
                      Request Clarification
                    </button>
                    <button
                      onClick={() => submitReview('eskalasi')}
                      disabled={reviewSaving}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <AlertOctagon size={15} />
                      Escalate
                    </button>
                  </div>

                  {showNoteInput && (
                    <div className="space-y-2">
                      <textarea
                        value={reviewNote}
                        onChange={e => setReviewNote(e.target.value)}
                        placeholder="Message to student (optional)…"
                        rows={3}
                        className="w-full text-sm border border-[#B9B6AD]/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#2D4E71]/20 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitReview('minta_klarifikasi')}
                          disabled={reviewSaving}
                          className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50"
                        >
                          {reviewSaving ? 'Saving…' : 'Send Request'}
                        </button>
                        <button onClick={() => setShowNoteInput(false)} className="px-4 py-2 rounded-xl border border-[#B9B6AD]/30 text-sm text-[#6b7280] hover:bg-[#f8fafc] transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {reviewToast && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">{reviewToast}</p>
              )}
            </div>
          </section>
        )}

        {/* ── SECTION H: Grading Panel ── */}
        {submission && (
          <section>
            <SectionLabel>Grade This Submission</SectionLabel>
            <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-6 space-y-5">
              <p className="text-xs text-[#6b7280]">
                LES reference: <span className="font-semibold text-[#111111]">{submission.les_score ?? '—'}</span>
                {submission.les_band && ` (${submission.les_band})`} — use as context, not as the grade.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#6b7280]">Content Grade (0–100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={gradeContent}
                    onChange={e => setGradeContent(e.target.value)}
                    disabled={gradeFinalized}
                    placeholder="—"
                    className="w-full text-sm border border-[#B9B6AD]/30 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2D4E71]/20 disabled:bg-[#f8fafc] disabled:text-[#B9B6AD]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#6b7280]">Process Grade (0–100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={gradeProcess}
                    onChange={e => setGradeProcess(e.target.value)}
                    disabled={gradeFinalized}
                    placeholder="—"
                    className="w-full text-sm border border-[#B9B6AD]/30 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2D4E71]/20 disabled:bg-[#f8fafc] disabled:text-[#B9B6AD]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#6b7280]">Lecturer Notes</label>
                <textarea
                  value={gradeNote}
                  onChange={e => setGradeNote(e.target.value)}
                  disabled={gradeFinalized}
                  placeholder="Internal notes or feedback for student…"
                  rows={3}
                  className="w-full text-sm border border-[#B9B6AD]/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#2D4E71]/20 resize-none disabled:bg-[#f8fafc] disabled:text-[#B9B6AD]"
                />
              </div>

              {gradeFinalized ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl font-medium">
                    ✓ Grade finalized
                  </span>
                  <button
                    onClick={() => setGradeFinalized(false)}
                    className="text-xs text-[#2D4E71] hover:underline"
                  >
                    Reopen
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => saveGrade(false)}
                    disabled={gradeSaving}
                    className="px-4 py-2 rounded-xl border border-[#B9B6AD]/30 text-sm font-semibold text-[#6b7280] hover:bg-[#f8fafc] transition-colors disabled:opacity-50"
                  >
                    {gradeSaving ? 'Saving…' : 'Save Draft'}
                  </button>
                  <button
                    onClick={() => setShowGradeConfirm(true)}
                    disabled={gradeSaving}
                    className="px-4 py-2 rounded-xl bg-[#2D4E71] text-white text-sm font-semibold hover:bg-[#1e3a56] transition-colors disabled:opacity-50"
                  >
                    Finalize Grade
                  </button>
                </div>
              )}

              {showGradeConfirm && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
                  <p className="text-sm text-amber-800 font-medium">This grade will be visible to the student. Continue?</p>
                  <div className="flex gap-2">
                    <button onClick={() => saveGrade(true)} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors">
                      Yes, Finalize
                    </button>
                    <button onClick={() => setShowGradeConfirm(false)} className="px-3 py-1.5 rounded-lg border border-amber-200 text-xs text-amber-700 hover:bg-amber-100 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {gradeToast && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">{gradeToast}</p>
              )}
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
