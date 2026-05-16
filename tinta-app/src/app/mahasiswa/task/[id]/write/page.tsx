'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { TintaEditor, type TintaEditorHandle } from '@/components/editor/TintaEditor'
import type { Task } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`
}

// ─────────────────────────────────────────────────────────────────────────────

export default function WritePage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [userId, setUserId]   = useState<string | null>(null)
  const [task,   setTask]     = useState<Task   | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [closing, setClosing] = useState(false)

  const editorRef = useRef<TintaEditorHandle>(null)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()
      setTask(data ?? null)
    }

    init()

    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [taskId, router])

  const handleClose = async () => {
    if (closing) return
    setClosing(true)
    try {
      await editorRef.current?.close()
    } catch (err) {
      console.error('Close failed:', err)
    }
    router.push('/mahasiswa/dashboard')
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tinta-dark text-tinta-warm text-sm">
        Memuat…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">

      <header className="shrink-0 flex items-center justify-between gap-4 px-6 py-3 border-b border-tinta-border bg-white">
        <div className="flex flex-col min-w-0">
          <h1 className="text-sm font-semibold text-tinta-dark truncate">
            {task?.title ?? 'Memuat tugas…'}
          </h1>
          {task?.deadline && (
            <p className="text-xs text-tinta-warm">
              Deadline: {format(new Date(task.deadline), 'dd MMM yyyy, HH:mm')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <span className="font-mono text-sm tabular-nums text-tinta-main">
            {formatElapsed(elapsed)}
          </span>

          <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Rekaman Aktif
          </div>

          <button
            onClick={handleClose}
            disabled={closing}
            className="text-sm bg-tinta-main hover:bg-tinta-accent-hover active:scale-[0.98] text-white px-4 py-1.5 rounded-md transition-all disabled:opacity-60"
          >
            {closing ? 'Menyimpan…' : 'Simpan & Tutup'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <TintaEditor
          ref={editorRef}
          taskId={taskId}
          userId={userId}
        />
      </main>
    </div>
  )
}
