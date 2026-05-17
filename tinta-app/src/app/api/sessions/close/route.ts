import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Called via navigator.sendBeacon when the tab closes without Save & Close.
// Uses service role key so it can write without a user session cookie.
export async function POST(req: NextRequest) {
  try {
    const body       = await req.json() as { session_id?: string; ended_at?: string }
    const sessionId  = body.session_id
    const endedAt    = body.ended_at ?? new Date().toISOString()

    if (!sessionId) return NextResponse.json({ ok: false })

    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key || key === 'YOUR_SUPABASE_SERVICE_ROLE_KEY') {
      // Service role key not configured — silently succeed (createSession will
      // clean up orphans next time the student opens the editor)
      return NextResponse.json({ ok: true, note: 'service_key_missing' })
    }

    const supabase = createClient(url, key)
    await supabase
      .from('sessions')
      .update({ ended_at: endedAt })
      .eq('id', sessionId)
      .is('ended_at', null)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
