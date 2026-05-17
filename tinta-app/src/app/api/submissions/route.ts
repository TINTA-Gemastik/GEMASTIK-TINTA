import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { TintaEvent, Session, PasteEvent } from '@/types'
import { computeLES }        from '@/lib/signals/lesCalculator'
import { detectAnomalies }   from '@/lib/signals/anomalyDetector'

// ─── Supabase factory ─────────────────────────────────────────────────────────

function makeSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()               { return cookieStore.getAll() },
        setAll(cookiesToSet)   {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// ─── GPTZero / AI likelihood ──────────────────────────────────────────────────

async function fetchAILikelihood(docText: string): Promise<number> {
  const apiKey = process.env.GPTZERO_API_KEY
  if (!apiKey) {
    console.warn('[Submissions] GPTZERO_API_KEY not set — using mock 0.0')
    return 0
  }

  try {
    const res = await fetch('https://api.gptzero.me/v2/predict/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    apiKey,
      },
      body: JSON.stringify({ document: docText }),
    })
    if (!res.ok) {
      console.warn('[Submissions] GPTZero request failed:', res.status)
      return 0
    }
    const json = await res.json()
    return json?.documents?.[0]?.average_generated_prob ?? 0
  } catch (err) {
    console.warn('[Submissions] GPTZero fetch error:', err)
    return 0
  }
}

// ─── POST /api/submissions ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = makeSupabase()

  // Authenticate
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { task_id } = body as { task_id: string }
  if (!task_id) {
    return NextResponse.json({ error: 'task_id is required' }, { status: 400 })
  }

  const studentId = user.id

  // ── Fetch raw events ────────────────────────────────────────────────────────
  const { data: eventsData, error: evErr } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', studentId)
    .eq('task_id', task_id)
    .order('timestamp', { ascending: true })

  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 })
  const events = (eventsData ?? []) as TintaEvent[]

  // ── Fetch sessions ──────────────────────────────────────────────────────────
  const { data: sessionsData, error: sessErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', studentId)
    .eq('task_id', task_id)
    .order('started_at', { ascending: true })

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 })
  const sessions = (sessionsData ?? []) as Session[]

  // ── Fetch paste events ──────────────────────────────────────────────────────
  const { data: pastesData, error: pasteErr } = await supabase
    .from('paste_events')
    .select('*')
    .eq('student_id', studentId)
    .eq('task_id', task_id)

  if (pasteErr) return NextResponse.json({ error: pasteErr.message }, { status: 500 })
  const pasteEvents = (pastesData ?? []) as PasteEvent[]

  // ── Compute LES ─────────────────────────────────────────────────────────────
  const les = computeLES(events, sessions, pasteEvents)

  // ── Fetch previous LES for historical comparison ────────────────────────────
  const { data: prevSubs } = await supabase
    .from('submissions')
    .select('les_score')
    .eq('student_id', studentId)
    .not('les_score', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(5)

  const prevScores  = (prevSubs ?? [])
    .map(s => s.les_score as number)
    .filter(n => typeof n === 'number')
  const previousLES = prevScores.length > 0
    ? prevScores.reduce((a, b) => a + b, 0) / prevScores.length
    : undefined

  // ── Detect anomalies ────────────────────────────────────────────────────────
  const anomalies = detectAnomalies(events, sessions, pasteEvents, les.total, previousLES)

  // ── Rebuild final document text ─────────────────────────────────────────────
  // Use the last non-empty doc snapshot from events (doc text not stored in events,
  // so we reconstruct the final text length; actual text comes from client body if provided)
  const finalDocText: string = body.final_doc_text ?? ''

  // ── AI likelihood ────────────────────────────────────────────────────────────
  const aiLikelihood = finalDocText.length > 50
    ? await fetchAILikelihood(finalDocText)
    : 0

  // ── Insert submission ────────────────────────────────────────────────────────
  const { data: sub, error: subErr } = await supabase
    .from('submissions')
    .insert({
      task_id,
      student_id:             studentId,
      final_doc_text:         finalDocText || null,
      les_score:              les.total,
      les_band:               les.band,
      revision_depth:         les.components.revisionDepth,
      session_count:          sessions.length,
      organic_ratio:          les.components.organicRatio,
      paste_declaration_rate: les.components.pasteDeclarationRate,
      velocity_consistency:   les.components.velocityConsistency,
      tab_switch_score:       les.components.tabSwitchScore,
      ai_likelihood_estimate: aiLikelihood,
      flag_count:             anomalies.length,
      dosen_review_status:    'pending',
    })
    .select('id')
    .single()

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })

  // ── Insert anomaly flags ─────────────────────────────────────────────────────
  if (anomalies.length > 0) {
    await supabase.from('anomaly_flags').insert(
      anomalies.map(f => ({
        submission_id:    sub!.id,
        student_id:       studentId,
        flag_type:        f.flag_type,
        flag_description: f.flag_description,
        severity:         f.severity,
      }))
    )
  }

  return NextResponse.json({ submission_id: sub!.id }, { status: 201 })
}
