-- TINTA Migration 001
-- Run in Supabase SQL editor

-- 1. Add line diff columns to sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS line_insertions INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_deletions  INT NOT NULL DEFAULT 0;

-- 2. Create drafts table for Save & Close persistence
CREATE TABLE IF NOT EXISTS drafts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  content_html TEXT NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '',
  word_count   INT  NOT NULL DEFAULT 0,
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_drafts_task_student ON drafts (task_id, student_id);

-- RLS for drafts
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own drafts" ON drafts
  FOR ALL USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
