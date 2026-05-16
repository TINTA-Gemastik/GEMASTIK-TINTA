-- ═══════════════════════════════════════════════════════════════════
-- TINTA — Safe Migration (profiles already exists)
-- Paste this entire block into Supabase SQL Editor → Run
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- 1. REMAINING TABLES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dosen_id          UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  deadline          TIMESTAMPTZ NOT NULL,
  min_sessions      INT NOT NULL DEFAULT 1,
  max_paste_ratio   FLOAT NOT NULL DEFAULT 0.5,
  allow_paste       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_enrollments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, student_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id             UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  duration_active_ms  BIGINT NOT NULL DEFAULT 0,
  chars_typed         INT NOT NULL DEFAULT 0,
  chars_deleted       INT NOT NULL DEFAULT 0,
  chars_pasted        INT NOT NULL DEFAULT 0,
  paste_event_count   INT NOT NULL DEFAULT 0,
  net_chars_added     INT NOT NULL DEFAULT 0,
  undo_count          INT NOT NULL DEFAULT 0,
  tab_switch_count    INT NOT NULL DEFAULT 0,
  idle_periods        INT NOT NULL DEFAULT 0,
  final_doc_length    INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id          UUID NOT NULL,
  event_type        TEXT NOT NULL,
  timestamp         BIGINT NOT NULL,
  session_id        UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  task_id           UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  cursor_position   INT,
  doc_length_before INT,
  doc_length_after  INT,
  payload           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id                 UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  student_id              UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  final_doc_text          TEXT,
  les_score               FLOAT,
  les_band                TEXT,
  revision_depth          FLOAT,
  session_count           INT,
  organic_ratio           FLOAT,
  paste_declaration_rate  FLOAT,
  velocity_consistency    FLOAT,
  tab_switch_score        FLOAT,
  ai_likelihood_estimate  FLOAT,
  flag_count              INT NOT NULL DEFAULT 0,
  dosen_review_status     TEXT NOT NULL DEFAULT 'pending',
  dosen_note              TEXT,
  nilai_konten            FLOAT,
  nilai_proses            FLOAT,
  finalized               BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS paste_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  submission_id     UUID REFERENCES submissions (id) ON DELETE SET NULL,
  student_id        UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  task_id           UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  pasted_text       TEXT NOT NULL,
  pasted_char_count INT NOT NULL,
  declared_type     TEXT,
  source_title      TEXT,
  source_author     TEXT,
  source_url        TEXT,
  source_year       TEXT,
  ai_likelihood     FLOAT,
  auto_classified   BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp         BIGINT NOT NULL
);

-- 'references' is a reserved PostgreSQL keyword — using document_references
CREATE TABLE IF NOT EXISTS document_references (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id    UUID NOT NULL REFERENCES submissions (id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  sentence_text    TEXT NOT NULL,
  source_title     TEXT,
  source_author    TEXT,
  source_url       TEXT,
  source_year      TEXT,
  is_paste_derived BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anomaly_flags (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id    UUID NOT NULL REFERENCES submissions (id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  flag_type        TEXT NOT NULL,
  flag_description TEXT NOT NULL,
  severity         TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dosen_reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions (id) ON DELETE CASCADE,
  dosen_id      UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  decision      TEXT NOT NULL CHECK (decision IN ('cleared', 'minta_klarifikasi', 'eskalasi')),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_events_session_id    ON events (session_id);
CREATE INDEX IF NOT EXISTS idx_events_task_id       ON events (task_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id       ON events (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_task_id     ON sessions (task_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id     ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task_id  ON submissions (task_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student  ON submissions (student_id);

-- ─────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

-- Safe to re-run even if already enabled
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_enrollments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE paste_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_flags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dosen_reviews       ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 4. RLS POLICIES  (drop-if-exists → recreate)
-- ─────────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- tasks
DROP POLICY IF EXISTS "tasks_dosen_all"      ON tasks;
DROP POLICY IF EXISTS "tasks_student_select" ON tasks;

CREATE POLICY "tasks_dosen_all" ON tasks
  FOR ALL TO authenticated
  USING (dosen_id = auth.uid())
  WITH CHECK (dosen_id = auth.uid());

CREATE POLICY "tasks_student_select" ON tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM task_enrollments
      WHERE task_enrollments.task_id   = tasks.id
        AND task_enrollments.student_id = auth.uid()
    )
  );

-- task_enrollments
DROP POLICY IF EXISTS "enrollments_dosen"          ON task_enrollments;
DROP POLICY IF EXISTS "enrollments_student_select" ON task_enrollments;

CREATE POLICY "enrollments_dosen" ON task_enrollments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_enrollments.task_id AND tasks.dosen_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_enrollments.task_id AND tasks.dosen_id = auth.uid())
  );

CREATE POLICY "enrollments_student_select" ON task_enrollments
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- sessions
DROP POLICY IF EXISTS "sessions_student_all"   ON sessions;
DROP POLICY IF EXISTS "sessions_dosen_select"  ON sessions;

CREATE POLICY "sessions_student_all" ON sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sessions_dosen_select" ON sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = sessions.task_id AND tasks.dosen_id = auth.uid())
  );

-- events
DROP POLICY IF EXISTS "events_student_all"  ON events;
DROP POLICY IF EXISTS "events_dosen_select" ON events;

CREATE POLICY "events_student_all" ON events
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "events_dosen_select" ON events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = events.task_id AND tasks.dosen_id = auth.uid())
  );

-- submissions
DROP POLICY IF EXISTS "submissions_student_all"   ON submissions;
DROP POLICY IF EXISTS "submissions_dosen_select"  ON submissions;
DROP POLICY IF EXISTS "submissions_dosen_update"  ON submissions;

CREATE POLICY "submissions_student_all" ON submissions
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "submissions_dosen_select" ON submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = submissions.task_id AND tasks.dosen_id = auth.uid())
  );

CREATE POLICY "submissions_dosen_update" ON submissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = submissions.task_id AND tasks.dosen_id = auth.uid())
  );

-- paste_events
DROP POLICY IF EXISTS "paste_events_student_all"  ON paste_events;
DROP POLICY IF EXISTS "paste_events_dosen_select" ON paste_events;

CREATE POLICY "paste_events_student_all" ON paste_events
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "paste_events_dosen_select" ON paste_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = paste_events.task_id AND tasks.dosen_id = auth.uid())
  );

-- document_references
DROP POLICY IF EXISTS "doc_refs_student_all"  ON document_references;
DROP POLICY IF EXISTS "doc_refs_dosen_select" ON document_references;

CREATE POLICY "doc_refs_student_all" ON document_references
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "doc_refs_dosen_select" ON document_references
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      JOIN tasks t ON t.id = s.task_id
      WHERE s.id = document_references.submission_id AND t.dosen_id = auth.uid()
    )
  );

-- anomaly_flags
DROP POLICY IF EXISTS "anomaly_flags_student_select" ON anomaly_flags;
DROP POLICY IF EXISTS "anomaly_flags_dosen_all"      ON anomaly_flags;

CREATE POLICY "anomaly_flags_student_select" ON anomaly_flags
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "anomaly_flags_dosen_all" ON anomaly_flags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      JOIN tasks t ON t.id = s.task_id
      WHERE s.id = anomaly_flags.submission_id AND t.dosen_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s
      JOIN tasks t ON t.id = s.task_id
      WHERE s.id = anomaly_flags.submission_id AND t.dosen_id = auth.uid()
    )
  );

-- dosen_reviews
DROP POLICY IF EXISTS "dosen_reviews_dosen_all"      ON dosen_reviews;
DROP POLICY IF EXISTS "dosen_reviews_student_select" ON dosen_reviews;

CREATE POLICY "dosen_reviews_dosen_all" ON dosen_reviews
  FOR ALL TO authenticated
  USING (dosen_id = auth.uid())
  WITH CHECK (dosen_id = auth.uid());

CREATE POLICY "dosen_reviews_student_select" ON dosen_reviews
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = dosen_reviews.submission_id AND s.student_id = auth.uid()
    )
  );
