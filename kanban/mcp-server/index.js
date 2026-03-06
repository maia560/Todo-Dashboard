import express from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ─── Supabase ────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ffykwfjvhvrbieerqnfm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_EtAJDRW8Op2KizpK4N-KeQ_2gnd88Nx';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Tool definitions ────────────────────────────────────────
const TOOLS = [
  {
    name: 'list_tasks',
    description: 'List all tasks from the Kanban board. Optionally filter by status. Returns tasks with their tags and subtasks.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['todo', 'in-progress', 'done'],
          description: 'Filter by status. Omit to return all tasks.',
        },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task on the Kanban board. Goes into the todo column by default.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title (required)' },
        status: {
          type: 'string',
          enum: ['todo', 'in-progress', 'done'],
          description: 'Status column. Defaults to todo.',
        },
        due_date: {
          type: 'string',
          description: 'Due date in ISO format, e.g. 2025-03-06 or 2025-03-06T14:00',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing task. You can change its title, status, and/or due date.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Task ID (required)' },
        title: { type: 'string', description: 'New title' },
        status: {
          type: 'string',
          enum: ['todo', 'in-progress', 'done'],
          description: 'New status',
        },
        due_date: {
          type: ['string', 'null'],
          description: 'New due date (ISO format) or null to clear',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task by its ID. This also removes all associated subtasks and tag links.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Task ID to delete (required)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_tags',
    description: 'List all available tags.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_tag_to_task',
    description: 'Assign a tag to a task. Use list_tags first to find the tag ID.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID (required)' },
        tag_id: { type: 'number', description: 'Tag ID (required)' },
      },
      required: ['task_id', 'tag_id'],
    },
  },
  {
    name: 'remove_tag_from_task',
    description: 'Remove a tag from a task.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID (required)' },
        tag_id: { type: 'number', description: 'Tag ID (required)' },
      },
      required: ['task_id', 'tag_id'],
    },
  },
];

// ─── Tool handlers ───────────────────────────────────────────
async function handleTool(name, args) {
  switch (name) {
    case 'list_tasks': {
      let query = supabase.from('tasks').select('*').order('status').order('position');
      if (args.status) query = query.eq('status', args.status);
      const { data: tasks, error } = await query;
      if (error) throw new Error(error.message);

      const taskIds = tasks.map((t) => t.id);
      if (taskIds.length === 0) return { tasks: [] };

      const { data: allTaskTags } = await supabase
        .from('task_tags')
        .select('task_id, tags(*)')
        .in('task_id', taskIds);

      const { data: allSubtasks } = await supabase
        .from('subtasks')
        .select('*')
        .in('task_id', taskIds)
        .order('position');

      const tagsByTask = {};
      for (const tt of allTaskTags || []) {
        if (!tagsByTask[tt.task_id]) tagsByTask[tt.task_id] = [];
        tagsByTask[tt.task_id].push(tt.tags);
      }
      const subtasksByTask = {};
      for (const st of allSubtasks || []) {
        if (!subtasksByTask[st.task_id]) subtasksByTask[st.task_id] = [];
        subtasksByTask[st.task_id].push(st);
      }

      const enriched = tasks.map((t) => ({
        ...t,
        tags: tagsByTask[t.id] || [],
        subtasks: subtasksByTask[t.id] || [],
      }));

      return { tasks: enriched };
    }

    case 'create_task': {
      const status = args.status || 'todo';
      const { data: maxRow } = await supabase
        .from('tasks')
        .select('position')
        .eq('status', status)
        .order('position', { ascending: false })
        .limit(1);

      const position = maxRow?.length ? maxRow[0].position + 1 : 1;

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title: args.title.trim(),
          status,
          position,
          due_date: args.due_date || null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return { task };
    }

    case 'update_task': {
      const updates = {};
      if (args.title !== undefined) updates.title = args.title.trim();
      if (args.status !== undefined) updates.status = args.status;
      if (args.due_date !== undefined) updates.due_date = args.due_date;

      if (args.status !== undefined) {
        const { data: maxRow } = await supabase
          .from('tasks')
          .select('position')
          .eq('status', args.status)
          .order('position', { ascending: false })
          .limit(1);
        updates.position = maxRow?.length ? maxRow[0].position + 1 : 1;
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', args.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return { task };
    }

    case 'delete_task': {
      const { error } = await supabase.from('tasks').delete().eq('id', args.id);
      if (error) throw new Error(error.message);
      return { deleted: true, id: args.id };
    }

    case 'list_tags': {
      const { data: tags, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');
      if (error) throw new Error(error.message);
      return { tags };
    }

    case 'add_tag_to_task': {
      const { error } = await supabase
        .from('task_tags')
        .upsert({ task_id: args.task_id, tag_id: args.tag_id });
      if (error) throw new Error(error.message);
      return { success: true, task_id: args.task_id, tag_id: args.tag_id };
    }

    case 'remove_tag_from_task': {
      const { error } = await supabase
        .from('task_tags')
        .delete()
        .eq('task_id', args.task_id)
        .eq('tag_id', args.tag_id);
      if (error) throw new Error(error.message);
      return { success: true, task_id: args.task_id, tag_id: args.tag_id };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP SSE Server ──────────────────────────────────────────
const app = express();
app.use(express.json());

// Store active SSE sessions
const sessions = new Map();

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// SSE endpoint — client connects here
app.get('/sse', (req, res) => {
  const sessionId = crypto.randomUUID();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  sessions.set(sessionId, res);

  // Send the endpoint URI so the client knows where to POST messages
  sendSSE(res, 'endpoint', `/message?sessionId=${sessionId}`);

  req.on('close', () => {
    sessions.delete(sessionId);
  });
});

// Message endpoint — receives JSON-RPC from Claude
app.post('/message', async (req, res) => {
  const sessionId = req.query.sessionId;
  const sseRes = sessions.get(sessionId);

  if (!sseRes) {
    return res.status(400).json({ error: 'Invalid or expired session' });
  }

  const { jsonrpc, id, method, params } = req.body;

  let result;

  switch (method) {
    case 'initialize':
      result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'kanban-mcp-server',
          version: '1.0.0',
        },
      };
      break;

    case 'notifications/initialized':
      // No response needed for notifications
      res.status(200).json({ jsonrpc: '2.0' });
      return;

    case 'tools/list':
      result = { tools: TOOLS };
      break;

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      try {
        const toolResult = await handleTool(toolName, toolArgs);
        result = {
          content: [
            {
              type: 'text',
              text: JSON.stringify(toolResult, null, 2),
            },
          ],
        };
      } catch (err) {
        result = {
          content: [
            {
              type: 'text',
              text: `Error: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
      break;
    }

    default:
      result = { error: { code: -32601, message: `Method not found: ${method}` } };
  }

  const response = { jsonrpc: '2.0', id, result };

  // Send via SSE to the client
  sendSSE(sseRes, 'message', response);

  // Also respond to the POST
  res.status(202).json({ jsonrpc: '2.0' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', tools: TOOLS.map((t) => t.name) });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Kanban MCP server running on http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Tools: ${TOOLS.map((t) => t.name).join(', ')}`);
});
