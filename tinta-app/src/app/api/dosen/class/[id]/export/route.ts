import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function row(values: unknown[]): string {
  return values.map(escapeCsv).join(',')
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const taskId  = params.id
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify this task belongs to the dosen
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('dosen_id', user.id)
    .single()

  if (!task) {
    return NextResponse.json({ error: 'Task not found or access denied' }, { status: 403 })
  }

  // Fetch enrollments + profiles
  const { data: enrollments } = await supabase
    .from('task_enrollments')
    .select('student_id, profiles(*)')
    .eq('task_id', taskId)

  if (!enrollments?.length) {
    return new NextResponse('No students enrolled.', { status: 200 })
  }

  const studentIds = enrollments.map((e: { student_id: string }) => e.student_id)

  const [
    { data: submissions },
    { data: sessions },
    { data: flags },
  ] = await Promise.all([
    supabase.from('submissions').select('*').eq('task_id', taskId).in('student_id', studentIds),
    supabase.from('sessions').select('*').eq('task_id', taskId).in('user_id', studentIds),
    supabase.from('anomaly_flags').select('*').eq('task_id', taskId),
  ])

  // Build maps
  const subMap: Record<string, Record<string, unknown>> = {}
  for (const s of (submissions ?? []) as Record<string, unknown>[]) {
    subMap[s.student_id as string] = s
  }

  const sessMap: Record<string, { totalMs: number; count: number; insertions: number; deletions: number }> = {}
  for (const s of (sessions ?? []) as Record<string, unknown>[]) {
    const uid = s.user_id as string
    if (!sessMap[uid]) sessMap[uid] = { totalMs: 0, count: 0, insertions: 0, deletions: 0 }
    sessMap[uid].totalMs    += (s.duration_active_ms as number) ?? 0
    sessMap[uid].count      += 1
    sessMap[uid].insertions += (s.line_insertions as number) ?? 0
    sessMap[uid].deletions  += (s.line_deletions  as number) ?? 0
  }

  const flagMap: Record<string, string[]> = {}
  for (const f of (flags ?? []) as Record<string, unknown>[]) {
    const sub = (submissions ?? []).find((s: Record<string, unknown>) => s.id === f.submission_id) as Record<string, unknown> | undefined
    if (!sub) continue
    const sid = sub.student_id as string
    if (!flagMap[sid]) flagMap[sid] = []
    flagMap[sid].push(f.flag_type as string)
  }

  // CSV header
  const HEADERS = [
    'student_id', 'student_name', 'student_npm', 'university', 'task_title',
    'submission_time', 'les_score', 'les_band',
    'session_count', 'total_active_time_minutes',
    'line_insertions', 'line_deletions',
    'paste_event_count', 'source_compliance_rate',
    'behavioral_ai_likelihood', 'flag_count', 'flag_descriptions',
    'dosen_review_status', 'content_grade', 'process_grade', 'lecturer_notes',
  ]

  const lines: string[] = [HEADERS.join(',')]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of (enrollments as unknown as { student_id: string; profiles: Record<string, unknown> }[])) {
    const sid     = e.student_id
    const profile = e.profiles
    const sub     = subMap[sid] ?? null
    const sess    = sessMap[sid] ?? null
    const flagArr = flagMap[sid] ?? []

    lines.push(row([
      sid,
      profile?.full_name,
      profile?.npm,
      profile?.university,
      task.title,
      sub?.submitted_at ? format(new Date(sub.submitted_at as string), 'yyyy-MM-dd HH:mm') : '',
      sub?.les_score,
      sub?.les_band,
      sess?.count ?? 0,
      sess ? Math.round(sess.totalMs / 60_000) : 0,
      sess?.insertions ?? 0,
      sess?.deletions  ?? 0,
      sub?.paste_event_count,
      sub?.paste_declaration_rate !== null && sub?.paste_declaration_rate !== undefined
        ? Math.round((sub.paste_declaration_rate as number) * 100)
        : '',
      sub?.ai_likelihood_estimate !== null && sub?.ai_likelihood_estimate !== undefined
        ? Math.round((sub.ai_likelihood_estimate as number) * 100)
        : '',
      sub?.flag_count ?? 0,
      flagArr.join('; '),
      sub?.dosen_review_status ?? 'pending',
      sub?.nilai_konten,
      sub?.nilai_proses,
      sub?.dosen_note,
    ]))
  }

  const csv      = lines.join('\n')
  const dateStr  = format(new Date(), 'yyyyMMdd')
  const filename = `TINTA_${task.title.replace(/\s+/g, '_').slice(0, 40)}_${dateStr}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
