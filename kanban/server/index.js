const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initDb, getDb, save } = require('./db');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// =====================
// DB HELPERS
// =====================

function all(sql, params = []) {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  getDb().run(sql, params);
  save();
}

function runAndGetId(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  save();
  return id;
}

function getTaskTags(taskId) {
  return all(
    `SELECT t.* FROM tags t
     JOIN task_tags tt ON tt.tag_id = t.id
     WHERE tt.task_id = ?
     ORDER BY t.name`,
    [taskId]
  );
}

function getTaskSubtasks(taskId) {
  return all(
    'SELECT * FROM subtasks WHERE task_id = ? ORDER BY position',
    [taskId]
  );
}

function getTaskFull(id) {
  const task = get('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!task) return null;
  task.tags = getTaskTags(id);
  task.subtasks = getTaskSubtasks(id);
  return task;
}

function attachExtras(tasks) {
  return tasks.map((task) => ({
    ...task,
    tags: getTaskTags(task.id),
    subtasks: getTaskSubtasks(task.id),
  }));
}

// =====================
// TASK ENDPOINTS
// =====================

app.get('/api/tasks', (req, res) => {
  const tasks = all('SELECT * FROM tasks ORDER BY status, position');
  res.json({ tasks: attachExtras(tasks) });
});

app.post('/api/tasks', (req, res) => {
  const { title, status = 'todo', due_date = null, subtasks = [], tagIds = [] } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const validStatuses = ['todo', 'in-progress', 'done'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const row = get('SELECT MAX(position) as maxPos FROM tasks WHERE status = ?', [status]);
  const position = (row?.maxPos ?? 0) + 1;

  const taskId = runAndGetId(
    'INSERT INTO tasks (title, status, position, due_date) VALUES (?, ?, ?, ?)',
    [title.trim(), status, position, due_date]
  );

  // Batch-create subtasks in one go
  for (let i = 0; i < subtasks.length; i++) {
    const st = subtasks[i];
    if (st && st.trim()) {
      run(
        'INSERT INTO subtasks (task_id, title, position) VALUES (?, ?, ?)',
        [taskId, st.trim(), i + 1]
      );
    }
  }

  // Batch-assign tags in one go
  for (const tagId of tagIds) {
    const tag = get('SELECT * FROM tags WHERE id = ?', [Number(tagId)]);
    if (tag) {
      const existing = get('SELECT * FROM task_tags WHERE task_id = ? AND tag_id = ?', [taskId, Number(tagId)]);
      if (!existing) {
        run('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', [taskId, Number(tagId)]);
      }
    }
  }

  // Return the full task with all subtasks and tags already attached
  const task = getTaskFull(taskId);

  io.emit('task:created', task);
  res.status(201).json({ task });
});

// PATCH /api/tasks/:id — handles title AND due_date
app.patch('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, due_date } = req.body;

  const existing = get('SELECT * FROM tasks WHERE id = ?', [Number(id)]);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const newTitle = title !== undefined ? title.trim() : existing.title;
  const newDueDate = due_date !== undefined ? due_date : existing.due_date;

  if (!newTitle) {
    return res.status(400).json({ error: 'Title cannot be empty' });
  }

  run('UPDATE tasks SET title = ?, due_date = ? WHERE id = ?', [newTitle, newDueDate, Number(id)]);
  const task = getTaskFull(Number(id));

  io.emit('task:updated', task);
  res.json({ task });
});

app.patch('/api/tasks/:id/move', (req, res) => {
  const { id } = req.params;
  const { status, position } = req.body;

  const validStatuses = ['todo', 'in-progress', 'done'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (typeof position !== 'number') {
    return res.status(400).json({ error: 'Position is required' });
  }

  const existing = get('SELECT * FROM tasks WHERE id = ?', [Number(id)]);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }

  run('UPDATE tasks SET status = ?, position = ? WHERE id = ?', [status, position, Number(id)]);
  const task = getTaskFull(Number(id));

  io.emit('task:moved', task);
  res.json({ task });
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;

  const existing = get('SELECT * FROM tasks WHERE id = ?', [Number(id)]);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }

  run('DELETE FROM tasks WHERE id = ?', [Number(id)]);

  io.emit('task:deleted', { id: Number(id) });
  res.json({ id: Number(id) });
});

// =====================
// TASK-TAG ENDPOINTS
// =====================

app.post('/api/tasks/:id/tags', (req, res) => {
  const taskId = Number(req.params.id);
  const { tagId } = req.body;

  const task = get('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const tag = get('SELECT * FROM tags WHERE id = ?', [Number(tagId)]);
  if (!tag) return res.status(404).json({ error: 'Tag not found' });

  const existing = get('SELECT * FROM task_tags WHERE task_id = ? AND tag_id = ?', [taskId, Number(tagId)]);
  if (existing) return res.json({ taskId, tag });

  run('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', [taskId, Number(tagId)]);

  io.emit('task:tagAdded', { taskId, tag });
  res.status(201).json({ taskId, tag });
});

app.delete('/api/tasks/:id/tags/:tagId', (req, res) => {
  const taskId = Number(req.params.id);
  const tagId = Number(req.params.tagId);

  run('DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?', [taskId, tagId]);

  io.emit('task:tagRemoved', { taskId, tagId });
  res.json({ taskId, tagId });
});

// =====================
// TAG ENDPOINTS
// =====================

app.get('/api/tags', (req, res) => {
  const tags = all('SELECT * FROM tags ORDER BY name');
  res.json({ tags });
});

app.post('/api/tags', (req, res) => {
  const { name, color } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return res.status(400).json({ error: 'Valid hex color is required (e.g. #FF5733)' });
  }

  const existing = get('SELECT * FROM tags WHERE name = ?', [name.trim()]);
  if (existing) {
    return res.status(409).json({ error: 'Tag name already exists' });
  }

  const tagId = runAndGetId('INSERT INTO tags (name, color) VALUES (?, ?)', [name.trim(), color]);

  const tag = get('SELECT * FROM tags WHERE id = ?', [tagId]);

  io.emit('tag:created', tag);
  res.status(201).json({ tag });
});

app.patch('/api/tags/:id', (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  const existing = get('SELECT * FROM tags WHERE id = ?', [Number(id)]);
  if (!existing) {
    return res.status(404).json({ error: 'Tag not found' });
  }

  const newName = name !== undefined ? name.trim() : existing.name;
  const newColor = color !== undefined ? color : existing.color;

  if (!newName) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(newColor)) {
    return res.status(400).json({ error: 'Valid hex color is required' });
  }

  if (newName !== existing.name) {
    const dup = get('SELECT * FROM tags WHERE name = ? AND id != ?', [newName, Number(id)]);
    if (dup) return res.status(409).json({ error: 'Tag name already exists' });
  }

  run('UPDATE tags SET name = ?, color = ? WHERE id = ?', [newName, newColor, Number(id)]);
  const tag = get('SELECT * FROM tags WHERE id = ?', [Number(id)]);

  io.emit('tag:updated', tag);
  res.json({ tag });
});

app.delete('/api/tags/:id', (req, res) => {
  const { id } = req.params;

  const existing = get('SELECT * FROM tags WHERE id = ?', [Number(id)]);
  if (!existing) {
    return res.status(404).json({ error: 'Tag not found' });
  }

  run('DELETE FROM tags WHERE id = ?', [Number(id)]);

  io.emit('tag:deleted', { id: Number(id) });
  res.json({ id: Number(id) });
});

// =====================
// SUBTASK ENDPOINTS
// =====================

app.get('/api/tasks/:id/subtasks', (req, res) => {
  const taskId = Number(req.params.id);
  const subtasks = all('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position', [taskId]);
  res.json({ subtasks });
});

app.post('/api/tasks/:id/subtasks', (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { title } = req.body;

    const task = get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const row = get('SELECT MAX(position) as maxPos FROM subtasks WHERE task_id = ?', [taskId]);
    const position = (row?.maxPos ?? 0) + 1;

    const subtaskId = runAndGetId(
      'INSERT INTO subtasks (task_id, title, position) VALUES (?, ?, ?)',
      [taskId, title.trim(), position]
    );

    const subtask = get('SELECT * FROM subtasks WHERE id = ?', [subtaskId]);

    io.emit('subtask:created', { taskId, subtask });
    res.status(201).json({ subtask });
  } catch (err) {
    console.error('Subtask creation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/subtasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, completed } = req.body;

  const existing = get('SELECT * FROM subtasks WHERE id = ?', [Number(id)]);
  if (!existing) {
    return res.status(404).json({ error: 'Subtask not found' });
  }

  const newTitle = title !== undefined ? title.trim() : existing.title;
  const newCompleted = completed !== undefined ? (completed ? 1 : 0) : existing.completed;

  if (!newTitle) {
    return res.status(400).json({ error: 'Title cannot be empty' });
  }

  run('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?', [newTitle, newCompleted, Number(id)]);
  const subtask = get('SELECT * FROM subtasks WHERE id = ?', [Number(id)]);

  io.emit('subtask:updated', { taskId: subtask.task_id, subtask });
  res.json({ subtask });
});

app.patch('/api/subtasks/:id/move', (req, res) => {
  const { id } = req.params;
  const { position } = req.body;

  if (typeof position !== 'number') {
    return res.status(400).json({ error: 'Position is required' });
  }

  const existing = get('SELECT * FROM subtasks WHERE id = ?', [Number(id)]);
  if (!existing) {
    return res.status(404).json({ error: 'Subtask not found' });
  }

  run('UPDATE subtasks SET position = ? WHERE id = ?', [position, Number(id)]);
  const subtask = get('SELECT * FROM subtasks WHERE id = ?', [Number(id)]);

  io.emit('subtask:moved', { taskId: subtask.task_id, subtask });
  res.json({ subtask });
});

app.delete('/api/subtasks/:id', (req, res) => {
  const { id } = req.params;

  const existing = get('SELECT * FROM subtasks WHERE id = ?', [Number(id)]);
  if (!existing) {
    return res.status(404).json({ error: 'Subtask not found' });
  }

  const taskId = existing.task_id;
  run('DELETE FROM subtasks WHERE id = ?', [Number(id)]);

  io.emit('subtask:deleted', { taskId, subtaskId: Number(id) });
  res.json({ id: Number(id) });
});

// =====================
// SEARCH ENDPOINT
// =====================

app.get('/api/search', (req, res) => {
  const { q } = req.query;

  if (!q || !q.trim()) {
    return res.json({ results: [] });
  }

  const term = `%${q.trim().toLowerCase()}%`;
  const results = [];
  const seenTaskIds = new Set();

  const titleMatches = all(
    'SELECT * FROM tasks WHERE LOWER(title) LIKE ? ORDER BY status, position',
    [term]
  );
  for (const task of titleMatches) {
    if (!seenTaskIds.has(task.id)) {
      seenTaskIds.add(task.id);
      const full = getTaskFull(task.id);
      results.push({ task: full, matchType: 'title', matchText: task.title });
    }
  }

  const tagTaskIds = all(
    `SELECT DISTINCT tt.task_id, t.name as tag_name FROM task_tags tt
     JOIN tags t ON t.id = tt.tag_id
     WHERE LOWER(t.name) LIKE ?`,
    [term]
  );
  for (const row of tagTaskIds) {
    if (!seenTaskIds.has(row.task_id)) {
      seenTaskIds.add(row.task_id);
      const full = getTaskFull(row.task_id);
      if (full) results.push({ task: full, matchType: 'tag', matchText: row.tag_name });
    }
  }

  const subtaskMatches = all(
    `SELECT DISTINCT task_id, title as subtask_title FROM subtasks
     WHERE LOWER(title) LIKE ?`,
    [term]
  );
  for (const row of subtaskMatches) {
    if (!seenTaskIds.has(row.task_id)) {
      seenTaskIds.add(row.task_id);
      const full = getTaskFull(row.task_id);
      if (full) results.push({ task: full, matchType: 'subtask', matchText: row.subtask_title });
    }
  }

  res.json({ results });
});

// =====================
// SOCKET.IO
// =====================

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// =====================
// START
// =====================

async function start() {
  await initDb();
  const PORT = 3001;
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
