-- ────────────────────────────────────────────────────────────────────────────
-- Migration: Board Custom Fields
-- Run in Supabase Dashboard → SQL Editor
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Custom field definitions per board
CREATE TABLE IF NOT EXISTS board_fields (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  field_type  TEXT        NOT NULL DEFAULT 'text',
  -- field_type: text | number | select | date | checkbox | url
  options     JSONB       NOT NULL DEFAULT '[]',
  -- For "select": [{ "value": "Backlog", "color": "#64748b" }, ...]
  position    INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Store custom field values per task (keyed by field id)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS custom_values JSONB NOT NULL DEFAULT '{}';

-- 3. RLS on board_fields
ALTER TABLE board_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Members can view board fields"
  ON board_fields FOR SELECT
  USING (
    board_id IN (
      SELECT board_id FROM board_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Owners can manage board fields"
  ON board_fields FOR ALL
  USING (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
