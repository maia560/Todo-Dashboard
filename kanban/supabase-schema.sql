-- =============================================
-- Supabase Schema for Kanban Board
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================

-- 1. Tasks table
CREATE TABLE tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  position REAL NOT NULL,
  due_date TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_status_position ON tasks (status, position);

-- 2. Tags table
CREATE TABLE tags (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6c8eef',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Task-Tags join table
CREATE TABLE task_tags (
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- 4. Subtasks table
CREATE TABLE subtasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  position REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subtasks_task_position ON subtasks (task_id, position);

-- 5. Enable RLS with open policies (single user, no auth)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tags" ON tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on task_tags" ON task_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on subtasks" ON subtasks FOR ALL USING (true) WITH CHECK (true);

-- 6. Replica identity FULL so DELETE realtime events include the old row
ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE tags REPLICA IDENTITY FULL;
ALTER TABLE task_tags REPLICA IDENTITY FULL;
ALTER TABLE subtasks REPLICA IDENTITY FULL;

-- 7. Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE tags;
ALTER PUBLICATION supabase_realtime ADD TABLE task_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE subtasks;
