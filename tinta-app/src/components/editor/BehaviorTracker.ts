import { v4 as uuidv4 } from 'uuid'
import type { TintaEventInsert } from '@/types'

interface BehaviorTrackerOptions {
  sessionId: string
  userId: string
  taskId: string
  onEvent: (event: TintaEventInsert) => void
  /** How long with no events before emitting idle. Default: 90 000 ms */
  idleThresholdMs?: number
}

// ─── BehaviorTracker ──────────────────────────────────────────────────────────
// Plain class (not a TipTap extension).
// Tracks tab visibility changes and idle periods independently of the editor.

export class BehaviorTracker {
  private readonly sessionId: string
  private readonly userId: string
  private readonly taskId: string
  private readonly onEvent: (e: TintaEventInsert) => void
  private readonly idleThresholdMs: number

  private hiddenAt: number | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private _tabSwitchCount = 0

  constructor(opts: BehaviorTrackerOptions) {
    this.sessionId      = opts.sessionId
    this.userId         = opts.userId
    this.taskId         = opts.taskId
    this.onEvent        = opts.onEvent
    this.idleThresholdMs = opts.idleThresholdMs ?? 90_000

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.resetIdleTimer()
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private makeBase(): Omit<TintaEventInsert, 'event_type' | 'payload'> {
    return {
      event_id:          uuidv4(),
      timestamp:         Date.now(),
      session_id:        this.sessionId,
      user_id:           this.userId,
      task_id:           this.taskId,
      cursor_position:   null,
      doc_length_before: null,
      doc_length_after:  null,
    }
  }

  private handleVisibilityChange() {
    if (document.hidden) {
      this.hiddenAt = Date.now()
      this._tabSwitchCount++
    } else if (this.hiddenAt !== null) {
      const durationMs = Date.now() - this.hiddenAt
      this.hiddenAt    = null
      this.onEvent({
        ...this.makeBase(),
        event_type: 'window_hidden',
        payload:    { duration_before_return_ms: durationMs },
      })
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Call whenever ANY editor event fires to reset the idle countdown. */
  resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => {
      this.onEvent({
        ...this.makeBase(),
        event_type: 'idle',
        payload:    { idle_duration_ms: this.idleThresholdMs },
      })
    }, this.idleThresholdMs)
  }

  get tabSwitchCount(): number {
    return this._tabSwitchCount
  }

  /** Remove all listeners and timers. Call on component unmount. */
  destroy(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
  }
}
