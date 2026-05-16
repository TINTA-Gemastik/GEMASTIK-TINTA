import { createClient } from '@/lib/supabase/client'
import type { TintaEventInsert } from '@/types'

const FLUSH_INTERVAL_MS = 3_000
const BEACON_URL        = '/api/events/flush'

// ─── EventSender ─────────────────────────────────────────────────────────────
// Singleton that batches events in memory and flushes them to Supabase every
// 3 seconds. On tab close, sendBeaconFlush() fires a non-blocking POST.

class EventSender {
  private queue: TintaEventInsert[]        = []
  private timer: ReturnType<typeof setInterval> | null = null
  private flushing = false

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => { this.flush() }, FLUSH_INTERVAL_MS)
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  // ── Queue management ──────────────────────────────────────────────────────

  enqueue(event: TintaEventInsert): void {
    this.queue.push(event)
  }

  // ── Flush to Supabase (with retry on failure) ─────────────────────────────

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return
    this.flushing = true

    // Drain atomically so concurrent flushes don't double-send
    const batch = this.queue.splice(0, this.queue.length)

    try {
      const supabase = createClient()
      const { error } = await supabase.from('events').insert(batch)

      if (error) {
        // Re-queue at the front for next cycle
        this.queue.unshift(...batch)
        console.error('[EventSender] flush failed, will retry:', error.message)
      }
    } catch (err) {
      this.queue.unshift(...batch)
      console.error('[EventSender] flush error:', err)
    } finally {
      this.flushing = false
    }
  }

  // ── Beacon flush (tab close / navigation) ─────────────────────────────────
  // navigator.sendBeacon is fire-and-forget — browser queues it even after
  // the page is gone. The server route handles persistence.

  sendBeaconFlush(): void {
    if (this.queue.length === 0) return
    const batch = this.queue.splice(0, this.queue.length)
    const blob  = new Blob([JSON.stringify(batch)], { type: 'application/json' })
    navigator.sendBeacon(BEACON_URL, blob)
  }
}

export const eventSender = new EventSender()
