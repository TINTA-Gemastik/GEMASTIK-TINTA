'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Download, ChevronDown, Search, ArrowUpDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { StatCard }    from '@/components/dashboard/StatCard'
import { LESBadge }   from '@/components/dashboard/LESBadge'
import { AnomalyTable } from '@/components/dashboard/AnomalyTable'
import type { Task, Profile, Submission, Session, AnomalyFlag } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentRow {
  profile:      Profile
  submission:   Submission | null
  sessions:     Session[]
  topFlag:      AnomalyFlag | null
}

type SortKey = 'name' | 'les' | 'submitted' | 'source' | 'flags'
type SortDir = 'asc' | 'desc'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LES_BANDS = [
  { label: '0–20',   min: 0,  max: 20,  color: '#ef4444' },
  { label: '21–40',  min: 21, max: 40,  color: '#f59e0b' },
  { label: '41–60',  min: 41, max: 60,  color: '#fbbf24' },
  { label: '61–80',  min: 61, max: 80,  color: '#a3e635' },
  { label: '81–100', min: 81, max: 100, color: '#16a34a' },
]

function fmtMs(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function statusBadge(sub: Submission | null, sessions: Session[]) {
  if (!sub) {
    if (sessions.length > 0) return { label: 'In Progress', cls: 'bg-amber-50 text-amber-700' }
    return { label: 'Not Started', cls: 'bg-[#F8F7F5] text-[#B9B6AD]' }
  }
  if (sub.finalized) return { label: 'Graded', cls: 'bg-green-50 text-green-700' }
  return { label: 'Submitted', cls: 'bg-blue-50 text-blue-700' }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DosenDashboard() {
  const router = useRouter()

  const [profile,      setProfile]      = useState<Profile | null>(null)
  const [tasks,        setTasks]        = useState<Task[]>([])
  const [activeTaskId, setActiveTaskId] = useState<string>('')
  const [rows,         setRows]         = useState<StudentRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [taskLoading,  setTaskLoading]  = useState(false)

  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [search,  setSearch]  = useState('')

  // ── Auth + tasks ──────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: prof }, { data: taskData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('tasks').select('*').eq('dosen_id', user.id).order('created_at', { ascending: false }),
      ])

      setProfile(prof as Profile | null)
      const taskList = (taskData ?? []) as Task[]
      setTasks(taskList)
      if (taskList.length > 0) setActiveTaskId(taskList[0].id)
      setLoading(false)
    }
    load()
  }, [router])

  // ── Students for active task ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeTaskId) return
    const supabase = createClient()
    const load = async () => {
      setTaskLoading(true)

      const [{ data: enrollments }, { data: submissions }, { data: sessions }, { data: flags }] =
        await Promise.all([
          supabase.from('task_enrollments').select('student_id, profiles(*)').eq('task_id', activeTaskId),
          supabase.from('submissions').select('*').eq('task_id', activeTaskId),
          supabase.from('sessions').select('*').eq('task_id', activeTaskId),
          supabase.from('anomaly_flags').select('*').eq('task_id', activeTaskId).order('created_at', { ascending: true }),
        ])

      const subMap: Record<string, Submission> = {}
      for (const s of (submissions ?? []) as Submission[]) subMap[s.student_id] = s

      const sessMap: Record<string, Session[]> = {}
      for (const s of (sessions ?? []) as Session[]) {
        if (!sessMap[s.user_id]) sessMap[s.user_id] = []
        sessMap[s.user_id].push(s)
      }

      const flagMap: Record<string, AnomalyFlag[]> = {}
      for (const f of (flags ?? []) as AnomalyFlag[]) {
        const sub = (submissions ?? []).find((s: { id: string }) => s.id === f.submission_id) as Submission | undefined
        if (!sub) continue
        if (!flagMap[sub.student_id]) flagMap[sub.student_id] = []
        flagMap[sub.student_id].push(f)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRows((enrollments ?? []).map((e: any) => ({
        profile:    e.profiles as Profile,
        submission: subMap[e.student_id] ?? null,
        sessions:   sessMap[e.student_id] ?? [],
        topFlag:    flagMap[e.student_id]?.[0] ?? null,
      })))
      setTaskLoading(false)
    }
    load()
  }, [activeTaskId])

  // ── Derived stats ─────────────────────────────────────────────────────────
  const submitted  = rows.filter(r => r.submission !== null)
  const flagged    = rows.filter(r => (r.submission?.flag_count ?? 0) > 0)
  const verified   = rows.filter(r => r.submission?.dosen_review_status !== 'pending' && r.submission !== null)

  const avgLes = useMemo(() => {
    const scores = submitted.map(r => r.submission!.les_score).filter((s): s is number => s !== null)
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  }, [submitted])

  const avgSource = useMemo(() => {
    const rates = submitted.map(r => r.submission!.paste_declaration_rate).filter((v): v is number => v !== null)
    return rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length * 100) : null
  }, [submitted])

  // LES distribution
  const lesDistribution = useMemo(() =>
    LES_BANDS.map(band => ({
      ...band,
      count: submitted.filter(r => {
        const s = r.submission!.les_score
        return s !== null && s >= band.min && s <= band.max
      }).length,
    })),
  [submitted])

  // Anomaly table rows
  const anomalyRows = useMemo(() =>
    flagged.map(r => ({
      studentId:      r.profile.id,
      studentName:    r.profile.full_name,
      studentNpm:     r.profile.npm,
      taskId:         activeTaskId,
      lesScore:       r.submission?.les_score ?? null,
      sourceRate:     r.submission?.paste_declaration_rate ?? null,
      behavioralRisk: r.submission?.ai_likelihood_estimate ?? null,
      topFlag:        r.topFlag ? r.topFlag.flag_type.replace(/_/g, ' ') : null,
      flagSeverity:   (r.topFlag?.severity ?? 'low') as 'high' | 'medium' | 'low',
    })),
  [flagged, activeTaskId])

  // Sorted + filtered full class table
  const filteredRows = useMemo(() => {
    let list = [...rows]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.profile.full_name.toLowerCase().includes(q) ||
        (r.profile.npm ?? '').toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':      cmp = a.profile.full_name.localeCompare(b.profile.full_name); break
        case 'les':       cmp = (a.submission?.les_score ?? -1) - (b.submission?.les_score ?? -1); break
        case 'submitted': cmp = a.submission ? 1 : -1; break
        case 'source':    cmp = (a.submission?.paste_declaration_rate ?? -1) - (b.submission?.paste_declaration_rate ?? -1); break
        case 'flags':     cmp = (a.submission?.flag_count ?? 0) - (b.submission?.flag_count ?? 0); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [rows, search, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const activeTask = tasks.find(t => t.id === activeTaskId) ?? null

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] text-[#B9B6AD] text-sm">
        Loading…
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc]">

      {/* ── Sticky header ── */}
      <header className="bg-white border-b border-[#B9B6AD]/20 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="font-playfair text-xl font-bold text-[#2D4E71] tracking-tight select-none">
              TINTA
            </span>
            <div className="w-px h-5 bg-[#B9B6AD]/30" />
            <span className="text-sm font-medium text-[#111111]">{profile?.full_name}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-[#6b7280] hover:text-[#111111] transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">

        {/* ── Page title + task selector ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">
              {activeTask ? `${activeTask.title} — Class Overview` : 'Dashboard'}
            </h1>
            {activeTask?.deadline && (
              <p className="text-sm text-[#6b7280] mt-1">
                Deadline: {format(new Date(activeTask.deadline), 'dd MMMM yyyy, HH:mm', { locale: idLocale })}
              </p>
            )}
          </div>

          {tasks.length > 1 && (
            <div className="relative">
              <select
                value={activeTaskId}
                onChange={e => setActiveTaskId(e.target.value)}
                className="appearance-none bg-white border border-[#B9B6AD]/30 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#2D4E71]/20 cursor-pointer"
              >
                {tasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#B9B6AD] pointer-events-none" />
            </div>
          )}
        </div>

        {taskLoading ? (
          <div className="text-sm text-[#B9B6AD] py-20 text-center">Loading class data…</div>
        ) : tasks.length === 0 ? (
          <div className="text-sm text-[#B9B6AD]">No tasks created yet.</div>
        ) : (
          <>
            {/* ── ROW 2: Stat cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Avg Learning Evidence Score"
                value={avgLes !== null ? avgLes : '—'}
                subtext={`${submitted.length} submissions received`}
                color={avgLes === null ? 'blue' : avgLes >= 70 ? 'green' : avgLes >= 50 ? 'amber' : 'red'}
              />
              <StatCard
                label="Source Compliance Rate"
                value={avgSource !== null ? `${avgSource}%` : '—'}
                subtext="% of paste events declared with source"
                color="blue"
              />
              <StatCard
                label="Needs Attention"
                value={flagged.length}
                subtext="submissions with significant anomalies"
                color={flagged.length > 0 ? 'red' : 'green'}
              />
              <StatCard
                label="Verified"
                value={`${verified.length}/${submitted.length}`}
                subtext={`${verified.length} reviewed, ${submitted.length} total submitted`}
                color="blue"
              />
            </div>

            {/* ── ROW 3: LES Distribution chart ── */}
            {submitted.length > 0 && (
              <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl p-6">
                <p className="text-[11px] font-semibold tracking-widest uppercase text-[#B9B6AD] mb-5">
                  LES Distribution — {activeTask?.title}
                </p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={lesDistribution} barSize={32}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#B9B6AD' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#B9B6AD' }}
                      axisLine={false}
                      tickLine={false}
                      width={24}
                    />
                    <Tooltip
                      formatter={(v) => [v, 'Students']}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {lesDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── ROW 4: Anomaly table ── */}
            {anomalyRows.length > 0 && (
              <section>
                <SectionLabel>Needs Attention ({anomalyRows.length})</SectionLabel>
                <AnomalyTable rows={anomalyRows} />
              </section>
            )}

            {/* ── ROW 5: Full class table ── */}
            <section>
              <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                <SectionLabel>All Students ({rows.length})</SectionLabel>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B9B6AD]" />
                  <input
                    type="text"
                    placeholder="Search by name or NPM…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 pr-4 py-1.5 text-sm bg-white border border-[#B9B6AD]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D4E71]/20 w-56"
                  />
                </div>
              </div>

              {filteredRows.length === 0 ? (
                <p className="text-sm text-[#B9B6AD]">No students match your search.</p>
              ) : (
                <div className="bg-white border border-[#B9B6AD]/30 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#B9B6AD]/20 bg-[#f8fafc]">
                        {[
                          { key: 'name',      label: 'Student' },
                          { key: 'les',       label: 'LES' },
                          { key: null,        label: 'Sessions' },
                          { key: null,        label: 'Active Time' },
                          { key: 'source',    label: 'Source %' },
                          { key: 'submitted', label: 'Status' },
                          { key: 'flags',     label: 'Flags' },
                          { key: null,        label: '' },
                        ].map(({ key, label }) => (
                          <th
                            key={label}
                            onClick={() => key && toggleSort(key as SortKey)}
                            className={`text-left text-[11px] font-semibold tracking-wider uppercase text-[#B9B6AD] px-4 py-3 ${key ? 'cursor-pointer hover:text-[#111111] select-none' : ''}`}
                          >
                            <span className="flex items-center gap-1">
                              {label}
                              {key && <ArrowUpDown size={10} />}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map(({ profile, submission, sessions, topFlag }) => {
                        const st  = statusBadge(submission, sessions)
                        const totalMs = sessions.reduce((s, se) => s + (se.duration_active_ms ?? 0), 0)

                        return (
                          <tr
                            key={profile.id}
                            className="border-b border-[#B9B6AD]/10 last:border-0 hover:bg-[#f8fafc] transition-colors"
                          >
                            <td className="px-4 py-3.5">
                              <p className="font-medium text-[#111111]">{profile.full_name}</p>
                              <p className="text-[11px] text-[#B9B6AD]">{profile.npm ?? profile.email}</p>
                            </td>
                            <td className="px-4 py-3.5 w-28">
                              <LESBadge score={submission?.les_score ?? null} compact />
                            </td>
                            <td className="px-4 py-3.5 text-xs font-mono text-[#111111]">
                              {sessions.length}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-mono text-[#6b7280]">
                              {totalMs > 0 ? fmtMs(totalMs) : '—'}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-mono text-[#111111]">
                              {submission?.paste_declaration_rate !== null && submission?.paste_declaration_rate !== undefined
                                ? `${Math.round(submission.paste_declaration_rate * 100)}%`
                                : '—'}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                                {st.label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              {(submission?.flag_count ?? 0) > 0 ? (
                                <span className="text-xs font-semibold text-red-600">
                                  ⚠ {submission!.flag_count}
                                </span>
                              ) : (
                                <span className="text-[#B9B6AD] text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <Link
                                href={`/dosen/class/${activeTaskId}/student/${profile.id}`}
                                className="text-xs font-semibold text-[#2D4E71] hover:text-[#1e3a56] transition-colors whitespace-nowrap"
                              >
                                Review →
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── ROW 6: Export bar ── */}
            {submitted.length > 0 && (
              <div className="flex justify-end">
                <a
                  href={`/api/dosen/class/${activeTaskId}/export`}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2D4E71] text-[#2D4E71] text-sm font-semibold hover:bg-[#2D4E71] hover:text-white transition-colors"
                >
                  <Download size={14} />
                  Export Class Data (.csv)
                </a>
              </div>
            )}
          </>
        )}
      </main>
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
