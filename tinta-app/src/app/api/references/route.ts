// References API — PRD §11 (References endpoints)
//
// NOTE: document_references.submission_id is currently NOT NULL in the schema.
// To allow pre-submission sentence tagging, run in Supabase SQL Editor:
//   ALTER TABLE document_references ALTER COLUMN submission_id DROP NOT NULL;
//
// Until that migration runs, POST will fail for write-phase tagging.
// Paste declarations (Step 3) update paste_events directly and are unaffected.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function makeSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()                    { return cookieStore.getAll() },
        setAll(cookiesToSet)        {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// ── POST /api/references — create a new reference ────────────────────────────
export async function POST(request: NextRequest) {
  const body = await request.json()

  const supabase = makeSupabase()
  const { data, error } = await supabase
    .from('document_references')
    .insert(body)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json(data, { status: 201 })
}

// ── GET /api/references?submission_id=… — list references ───────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const submissionId = searchParams.get('submission_id')

  const supabase = makeSupabase()
  let query = supabase.from('document_references').select('*')
  if (submissionId) query = query.eq('submission_id', submissionId)

  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json(data)
}

// ── PATCH /api/references — update an existing reference ────────────────────
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, ...updates } = body as { id: string; [key: string]: unknown }

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const supabase = makeSupabase()
  const { data, error } = await supabase
    .from('document_references')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json(data)
}
