-- ────────────────────────────────────────────────────────────────────────────
-- Migration v3: Dependencies, Recurrence, GitHub PR, Public token,
--               Inbox token, File attachments
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Task dependencies (array of task UUIDs this task is blocked by)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_by UUID[] DEFAULT '{}';

-- 2. Recurring tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recur_rule TEXT;  -- 'daily'|'weekly'|'monthly'
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recur_next TIMESTAMPTZ;

-- 3. GitHub PR URL
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS github_pr_url TEXT;

-- 4. Public read-only share token for boards
ALTER TABLE boards ADD COLUMN IF NOT EXISTS public_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS boards_public_token_idx ON boards(public_token)
  WHERE public_token IS NOT NULL;

-- 5. Email-to-task inbox token (unique per board)
ALTER TABLE boards ADD COLUMN IF NOT EXISTS inbox_token TEXT DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS boards_inbox_token_idx ON boards(inbox_token)
  WHERE inbox_token IS NOT NULL;

-- 6. File attachments
CREATE TABLE IF NOT EXISTS task_attachments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  board_id     UUID        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  uploaded_by  UUID        NOT NULL REFERENCES auth.users(id),
  filename     TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  content_type TEXT,
  size_bytes   BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_attachments' AND policyname='Board members can view attachments') THEN
    CREATE POLICY "Board members can view attachments" ON task_attachments FOR SELECT
      USING (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_attachments' AND policyname='Board members can upload attachments') THEN
    CREATE POLICY "Board members can upload attachments" ON task_attachments FOR INSERT
      WITH CHECK (board_id IN (SELECT board_id FROM board_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_attachments' AND policyname='Uploader can delete attachments') THEN
    CREATE POLICY "Uploader can delete attachments" ON task_attachments FOR DELETE
      USING (uploaded_by = auth.uid());
  END IF;
END $$;
