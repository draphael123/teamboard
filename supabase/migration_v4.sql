-- Migration v4: time tracking, voting, custom fields, notifications, webhooks, templates, board backgrounds

-- Board-level additions
ALTER TABLE boards ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS background TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS template_name TEXT;

-- Task voting (array of user UUIDs who upvoted)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS votes UUID[] DEFAULT '{}';

-- Time entries
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  seconds INT GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INT
      ELSE NULL
    END
  ) STORED,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select" ON time_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = time_entries.board_id
        AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "time_entries_insert" ON time_entries
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = time_entries.board_id
        AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "time_entries_update" ON time_entries
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "time_entries_delete" ON time_entries
  FOR DELETE USING (user_id = auth.uid());

-- Custom fields per board
CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','number','date','dropdown')),
  options JSONB DEFAULT '[]',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_fields_select" ON custom_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = custom_fields.board_id
        AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "custom_fields_write" ON custom_fields
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM boards b
      WHERE b.id = custom_fields.board_id
        AND b.owner_id = auth.uid()
    )
  );

-- Custom field values per task
CREATE TABLE IF NOT EXISTS task_custom_values (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, field_id)
);

ALTER TABLE task_custom_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_custom_values_select" ON task_custom_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN board_members bm ON bm.board_id = t.board_id
      WHERE t.id = task_custom_values.task_id
        AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "task_custom_values_write" ON task_custom_values
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN board_members bm ON bm.board_id = t.board_id
      WHERE t.id = task_custom_values.task_id
        AND bm.user_id = auth.uid()
    )
  );

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- Index for fast unread counts
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read) WHERE read = false;
