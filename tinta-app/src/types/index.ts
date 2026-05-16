// ─────────────────────────────────────────────
// Enums / Literals
// ─────────────────────────────────────────────

export type UserRole = 'mahasiswa' | 'dosen'

export type EventType =
  | 'keystroke'
  | 'paste'
  | 'delete'
  | 'select'
  | 'undo'
  | 'redo'
  | 'focus'
  | 'blur'
  | 'idle'
  | 'scroll'
  | 'window_hidden'
  | 'window_visible'

export type LesBand = 'Perlu Perhatian' | 'Perlu Tinjauan' | 'Cukup' | 'Baik'

export type DosenReviewStatus = 'pending' | 'cleared' | 'minta_klarifikasi' | 'eskalasi'

export type DosenDecision = 'cleared' | 'minta_klarifikasi' | 'eskalasi'

export type AnomalySeverity = 'low' | 'medium' | 'high'

// ─────────────────────────────────────────────
// Table Interfaces
// ─────────────────────────────────────────────

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  npm: string | null
  university: string | null
  email: string
  created_at: string
}

export interface Task {
  id: string
  dosen_id: string
  title: string
  description: string | null
  deadline: string
  min_sessions: number
  max_paste_ratio: number
  allow_paste: boolean
  created_at: string
}

export interface TaskEnrollment {
  id: string
  task_id: string
  student_id: string
  enrolled_at: string
}

export interface Session {
  id: string
  task_id: string
  user_id: string
  started_at: string
  ended_at: string | null
  duration_active_ms: number
  chars_typed: number
  chars_deleted: number
  chars_pasted: number
  paste_event_count: number
  net_chars_added: number
  undo_count: number
  tab_switch_count: number
  idle_periods: number
  final_doc_length: number
}

export interface EventPayloadKeystroke {
  key: string
  is_delete_key: boolean
}

export interface EventPayloadPaste {
  pasted_text: string
  pasted_char_count: number
  declared_type: string | null
  source_url: string | null
}

export interface EventPayloadDelete {
  deleted_text: string
  deleted_char_count: number
  was_selection: boolean
}

export interface EventPayloadSelect {
  selected_text: string
  selection_start: number
  selection_end: number
}

export interface EventPayloadUndo {
  chars_restored: number
  chars_removed: number
}

export interface EventPayloadRedo {
  chars_restored: number
  chars_removed: number
}

export interface EventPayloadIdle {
  idle_duration_ms: number
}

export interface EventPayloadWindowHidden {
  duration_before_return_ms: number | null
}

export type EventPayload =
  | EventPayloadKeystroke
  | EventPayloadPaste
  | EventPayloadDelete
  | EventPayloadSelect
  | EventPayloadUndo
  | EventPayloadRedo
  | EventPayloadIdle
  | EventPayloadWindowHidden
  | Record<string, unknown>

export interface TintaEvent {
  id: string
  event_id: string
  event_type: EventType
  timestamp: number
  session_id: string
  user_id: string
  task_id: string
  cursor_position: number | null
  doc_length_before: number | null
  doc_length_after: number | null
  payload: EventPayload | null
  created_at: string
}

export interface Submission {
  id: string
  task_id: string
  student_id: string
  submitted_at: string
  final_doc_text: string | null
  les_score: number | null
  les_band: LesBand | null
  revision_depth: number | null
  session_count: number | null
  organic_ratio: number | null
  paste_declaration_rate: number | null
  velocity_consistency: number | null
  tab_switch_score: number | null
  ai_likelihood_estimate: number | null
  flag_count: number
  dosen_review_status: DosenReviewStatus
  dosen_note: string | null
  nilai_konten: number | null
  nilai_proses: number | null
  finalized: boolean
}

export interface PasteEvent {
  id: string
  session_id: string
  submission_id: string | null
  student_id: string
  task_id: string
  pasted_text: string
  pasted_char_count: number
  declared_type: string | null
  source_title: string | null
  source_author: string | null
  source_url: string | null
  source_year: string | null
  ai_likelihood: number | null
  auto_classified: boolean
  timestamp: number
}

export interface Reference {
  id: string
  submission_id: string
  student_id: string
  sentence_text: string
  source_title: string | null
  source_author: string | null
  source_url: string | null
  source_year: string | null
  is_paste_derived: boolean
  confirmed: boolean
  created_at: string
}

export interface AnomalyFlag {
  id: string
  submission_id: string
  student_id: string
  flag_type: string
  flag_description: string
  severity: AnomalySeverity
  created_at: string
}

export interface DosenReview {
  id: string
  submission_id: string
  dosen_id: string
  decision: DosenDecision
  note: string | null
  created_at: string
}

// ─────────────────────────────────────────────
// Joined / View Types
// ─────────────────────────────────────────────

export interface SubmissionWithStudent extends Submission {
  profiles: Profile
}

export interface SessionWithEvents extends Session {
  events: TintaEvent[]
}

export interface TaskWithEnrollments extends Task {
  task_enrollments: TaskEnrollment[]
}
