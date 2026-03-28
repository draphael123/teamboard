-- ────────────────────────────────────────────────────────────────────────────
-- Migration v2: Activity log, board settings, task completed_at
-- Run in Supabase Dashboard → SQL Editor
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Task activity / history log
CREATE TABLE IF NOT EXISTS task_activity (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  board_id    UUID        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id),
  action      TEXT        NOT NULL,  -- created | moved | assigned | updated | commented
  field       TEXT,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Board members can view task activity"
  ON task_activity FOR SELECT
  USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Board members can insert task activity"
  ON task_activity FOR INSERT
  WITH CHECK (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));

-- 2. Board settings (WIP limits, etc.)
ALTER TABLE boards ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
-- settings format: { "wip": { "todo": null, "in_progress": 5, "done": null } }

-- 3. Task completion timestamp (for velocity analytics)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
