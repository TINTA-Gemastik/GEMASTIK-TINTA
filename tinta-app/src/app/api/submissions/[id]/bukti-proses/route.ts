import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import type { Session, PasteEvent, DocumentReference, AnomalyFlag } from '@/types'

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
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
    case 'Baik':            return '#16a34a'
    case 'Cukup':           return '#2563eb'
    case 'Perlu Tinjauan':  return '#d97706'
    case 'Perlu Perhatian': return '#dc2626'
    default:                return '#6b7280'
  }
}

function pct(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`
}

function bar(v: number | null, inverted = false): string {
  if (v === null || v === undefined) return '<div style="height:6px;background:#f3f4f6;border-radius:999px;"></div>'
  const raw = Math.min(1, Math.max(0, v))
  const p   = Math.round(raw * 100)
  const val = inverted ? 1 - raw : raw
  const color = val >= 0.7 ? '#16a34a' : val >= 0.4 ? '#f59e0b' : '#ef4444'
  return `
    <div style="height:6px;background:#f3f4f6;border-radius:999px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="height:100%;width:${p}%;background:${color};border-radius:999px;"></div>
    </div>`
}

function esc(s: unknown): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const submissionId = params.id
  const supabase     = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch submission + task + student profile
  const { data: sub } = await supabase
    .from('submissions')
    .select('*, tasks(*), profiles(*)')
    .eq('id', submissionId)
    .eq('student_id', user.id)
    .single()

  if (!sub) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = sub as any
  const task    = s.tasks
  const profile = s.profiles

  // Parallel data fetches
  const [
    { data: sessions },
    { data: pastes },
    { data: refs },
    { data: flags },
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select('*')
      .eq('task_id', task.id)
      .eq('user_id', user.id)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: true }),
    supabase
      .from('paste_events')
      .select('*')
      .eq('submission_id', submissionId),
    supabase
      .from('document_references')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true }),
    supabase
      .from('anomaly_flags')
      .select('*')
      .eq('submission_id', submissionId),
  ])

  const closedSessions = (sessions ?? []) as Session[]
  const pasteEvents    = (pastes ?? []) as PasteEvent[]
  const docRefs        = (refs ?? []) as DocumentReference[]
  const anomalyFlags   = (flags ?? []) as AnomalyFlag[]

  const totalActiveMs = closedSessions.reduce((a, sess) => a + (sess.duration_active_ms ?? 0), 0)
  const wordCount     = s.final_doc_text
    ? s.final_doc_text.trim().split(/\s+/).length
    : Math.round((closedSessions[closedSessions.length - 1]?.final_doc_length ?? 0) / 5.5)

  const submittedAt  = format(new Date(s.submitted_at), 'EEEE, d MMMM yyyy, HH:mm')
  const printedAt    = format(new Date(), 'd MMMM yyyy, HH:mm')
  const bandColor    = lesBandColor(s.les_band)

  // ── Build sessions table rows ──────────────────────────────────────────────
  const sessionRows = closedSessions.map((sess, i) => {
    const start = format(new Date(sess.started_at), 'EEE d MMM, HH:mm')
    const end   = sess.ended_at ? format(new Date(sess.ended_at), 'HH:mm') : '—'
    const dur   = sess.duration_active_ms > 0 ? fmtDuration(sess.duration_active_ms) : '—'
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(start)} – ${esc(end)}</td>
        <td>${esc(dur)}</td>
        <td style="color:#16a34a;font-family:monospace;">+${sess.line_insertions ?? 0}</td>
        <td style="color:#dc2626;font-family:monospace;">-${sess.line_deletions ?? 0}</td>
        <td>${sess.paste_event_count ?? 0}</td>
        <td>${sess.undo_count ?? 0}</td>
        <td>${Math.round((sess.final_doc_length ?? 0) / 5.5).toLocaleString('en')}</td>
      </tr>`
  }).join('')

  // ── References rows ────────────────────────────────────────────────────────
  const refRows = docRefs.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-style:italic;">&ldquo;${esc(r.sentence_text)}&rdquo;</td>
      <td>${esc(r.source_title ?? '—')}</td>
      <td>${esc(r.source_author ?? '—')}</td>
      <td>${esc(r.source_year ?? '—')}</td>
    </tr>`
  ).join('')

  // ── HTML ──────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proof of Work — ${esc(task.title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', serif;
      color: #111111;
      background: white;
      padding: 40px 60px;
      max-width: 900px;
      margin: 0 auto;
      font-size: 12px;
      line-height: 1.6;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { margin: 20mm; }
    }
    h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
    h2 { font-size: 13px; font-weight: bold; margin: 24px 0 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    .header { border-bottom: 2px solid #111111; padding-bottom: 16px; margin-bottom: 24px; }
    .header .logo { font-size: 11px; font-weight: bold; letter-spacing: 0.15em; text-transform: uppercase; color: #2D4E71; margin-bottom: 10px; }
    .meta { display: flex; gap: 40px; flex-wrap: wrap; margin-top: 10px; }
    .meta-item { }
    .meta-item .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; }
    .meta-item .value { font-weight: bold; font-size: 13px; margin-top: 2px; }
    .les-box { display: inline-block; padding: 8px 16px; border: 2px solid ${bandColor}; border-radius: 8px; text-align: center; }
    .les-box .score { font-size: 32px; font-weight: 900; color: ${bandColor}; }
    .les-box .band  { font-size: 10px; color: ${bandColor}; font-weight: bold; }
    .stat-row { display: flex; gap: 32px; flex-wrap: wrap; margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
    .stat { text-align: center; }
    .stat .sv { font-size: 20px; font-weight: 900; }
    .stat .sl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-top: 2px; }
    .signal-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .signal-row .sig-label { width: 180px; font-size: 11px; flex-shrink: 0; }
    .signal-row .sig-bar { flex: 1; }
    .signal-row .sig-pct { width: 36px; text-align: right; font-size: 11px; font-weight: bold; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { background: #f9fafb; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #2D4E71; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px; font-family: sans-serif; }
    .print-btn:hover { background: #1e3a56; }
    .flag-item { display: flex; gap: 8px; padding: 6px 10px; background: #fef9c3; border: 1px solid #fde047; border-radius: 6px; margin-bottom: 6px; font-size: 11px; }
  </style>
</head>
<body>

  <button class="no-print print-btn" onclick="window.print()">Print / Save PDF</button>

  <div class="header">
    <div class="logo">TINTA — Writing Integrity Platform</div>
    <h1>${esc(task.title)}</h1>
    <div class="meta">
      <div class="meta-item">
        <div class="label">Student</div>
        <div class="value">${esc(profile?.full_name ?? user.email)}</div>
      </div>
      ${profile?.npm ? `<div class="meta-item"><div class="label">NPM</div><div class="value">${esc(profile.npm)}</div></div>` : ''}
      ${profile?.university ? `<div class="meta-item"><div class="label">University</div><div class="value">${esc(profile.university)}</div></div>` : ''}
      <div class="meta-item">
        <div class="label">Submitted</div>
        <div class="value">${submittedAt}</div>
      </div>
      ${s.les_score != null ? `
      <div class="meta-item">
        <div class="les-box">
          <div class="score">${s.les_score}</div>
          <div class="band">${lesBandLabel(s.les_band)}</div>
        </div>
      </div>` : ''}
    </div>
  </div>

  <!-- Stats -->
  <div class="stat-row">
    <div class="stat"><div class="sv">${closedSessions.length}</div><div class="sl">Sessions</div></div>
    <div class="stat"><div class="sv">${totalActiveMs > 0 ? fmtDuration(totalActiveMs) : '—'}</div><div class="sl">Active Time</div></div>
    <div class="stat"><div class="sv">${wordCount.toLocaleString('en')}</div><div class="sl">Words</div></div>
    <div class="stat"><div class="sv">${pasteEvents.length}</div><div class="sl">Pastes</div></div>
    <div class="stat"><div class="sv">${docRefs.length}</div><div class="sl">References</div></div>
  </div>

  ${s.les_score != null ? `
  <h2>Writing Integrity Signals</h2>
  <div style="margin-top:12px;">
    <div class="signal-row">
      <div class="sig-label">Revision Depth</div>
      <div class="sig-bar">${bar(s.revision_depth)}</div>
      <div class="sig-pct">${pct(s.revision_depth)}</div>
    </div>
    <div class="signal-row">
      <div class="sig-label">Organic Writing Rate</div>
      <div class="sig-bar">${bar(s.organic_ratio)}</div>
      <div class="sig-pct">${pct(s.organic_ratio)}</div>
    </div>
    <div class="signal-row">
      <div class="sig-label">Reference Transparency</div>
      <div class="sig-bar">${bar(s.paste_declaration_rate)}</div>
      <div class="sig-pct">${pct(s.paste_declaration_rate)}</div>
    </div>
    <div class="signal-row">
      <div class="sig-label">Typing Consistency</div>
      <div class="sig-bar">${bar(s.velocity_consistency)}</div>
      <div class="sig-pct">${pct(s.velocity_consistency)}</div>
    </div>
    <div class="signal-row">
      <div class="sig-label">Focus Score</div>
      <div class="sig-bar">${bar(s.tab_switch_score)}</div>
      <div class="sig-pct">${pct(s.tab_switch_score)}</div>
    </div>
    ${s.ai_likelihood_estimate != null ? `
    <div class="signal-row">
      <div class="sig-label">AI Likelihood (lower=better)</div>
      <div class="sig-bar">${bar(s.ai_likelihood_estimate, true)}</div>
      <div class="sig-pct">${pct(s.ai_likelihood_estimate)}</div>
    </div>` : ''}
  </div>
  ` : ''}

  <h2>Session Log</h2>
  ${closedSessions.length === 0 ? '<p style="color:#9ca3af;font-size:11px;">No sessions found.</p>' : `
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Time</th>
        <th>Active</th>
        <th>Insertions</th>
        <th>Deletions</th>
        <th>Pastes</th>
        <th>Undo</th>
        <th>Words</th>
      </tr>
    </thead>
    <tbody>${sessionRows}</tbody>
  </table>`}

  ${docRefs.length > 0 ? `
  <h2>Declared References</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Quote</th>
        <th>Title</th>
        <th>Author</th>
        <th>Year</th>
      </tr>
    </thead>
    <tbody>${refRows}</tbody>
  </table>` : ''}

  ${anomalyFlags.length > 0 ? `
  <h2>Flagged Patterns</h2>
  <p style="color:#6b7280;font-size:11px;margin-bottom:10px;">
    The following patterns were automatically detected. Flags do not imply misconduct — they are reviewed by the lecturer.
  </p>
  ${anomalyFlags.map(f => `
    <div class="flag-item">
      <span style="font-weight:bold;text-transform:capitalize;">${esc(f.flag_type.replace(/_/g, ' '))}:</span>
      <span>${esc(f.flag_description)}</span>
    </div>`).join('')}
  ` : ''}

  <div class="footer">
    <span>TINTA Proof of Work · ${esc(task.title)}</span>
    <span>Generated ${printedAt}</span>
  </div>

</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
