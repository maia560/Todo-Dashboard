#!/usr/bin/env node
/**
 * Kanban MCP Server — Supabase backend (stdio)
 * ==============================================
 * Runs as a Claude Desktop MCP server over stdin/stdout.
 *
 * Status flow:
 *   suggested → todo → in-progress → done
 *   suggested → dismissed (via move_task)
 *
 * Tables: tasks, tags, task_tags, subtasks, calendar_events
 *
 * Setup:
 *   1. npm install (no dependencies — uses built-in fetch + readline)
 *   2. Add to Claude Desktop config (see README)
 *   3. Done — Claude can now read/write your Kanban board
 */

import { createInterface } from "readline";

// ── Supabase config ─────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ffykwfjvhvrbieerqnfm.supabase.co";
const SUPABASE_KEY =
  "sb_publishable_EtAJDRW8Op2KizpK4N-KeQ_2gnd88Nx";

const VALID_STATUSES = ["suggested", "todo", "in-progress", "done"];

// ── Supabase helpers ────────────────────────────────────────────────────────

function sbHeaders(prefer = "return=representation") {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

async function sbRequest(path, method = "GET", data = null, prefer) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const opts = {
    method,
    headers: sbHeaders(prefer || "return=representation"),
  };
  if (data !== null) {
    opts.body = JSON.stringify(data);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null;
}

// ── Tool implementations ────────────────────────────────────────────────────

async function listTasks(status) {
  let path = "tasks?select=*&order=status,position";
  if (status) {
    path += `&status=eq.${status}`;
  } else {
    // Exclude dismissed by default
    path += "&status=neq.dismissed";
  }
  const tasks = (await sbRequest(path)) || [];

  // Bulk-fetch tags and subtasks
  const ids = tasks.map((t) => t.id);
  if (ids.length === 0) return [];

  const idList = `(${ids.join(",")})`;
  const [taskTags, subtasks] = await Promise.all([
    sbRequest(`task_tags?select=task_id,tags(*)&task_id=in.${idList}`) || [],
    sbRequest(
      `subtasks?select=*&task_id=in.${idList}&order=position`
    ) || [],
  ]);

  const tagsByTask = {};
  for (const tt of taskTags) {
    if (!tagsByTask[tt.task_id]) tagsByTask[tt.task_id] = [];
    tagsByTask[tt.task_id].push(tt.tags);
  }
  const subtasksByTask = {};
  for (const st of subtasks) {
    if (!subtasksByTask[st.task_id]) subtasksByTask[st.task_id] = [];
    subtasksByTask[st.task_id].push(st);
  }

  return tasks.map((t) => ({
    ...t,
    tags: tagsByTask[t.id] || [],
    subtasks: subtasksByTask[t.id] || [],
  }));
}

async function addTask(title, status = "todo", dueDate = null) {
  const targetStatus = VALID_STATUSES.includes(status) ? status : "todo";

  // Get max position in target column
  const maxRows = await sbRequest(
    `tasks?select=position&status=eq.${targetStatus}&order=position.desc&limit=1`
  );
  const position = maxRows?.length ? maxRows[0].position + 1 : 1;

  const row = {
    title: title.trim(),
    status: targetStatus,
    position,
    due_date: dueDate || null,
  };

  const result = await sbRequest("tasks", "POST", row);
  return result?.[0] || row;
}

async function addSuggestions(suggestions) {
  const added = [];
  const skipped = [];

  for (const s of suggestions) {
    if (!s.title || !s.title.trim()) {
      skipped.push("(empty title)");
      continue;
    }
    try {
      const task = await addTask(
        s.title,
        "suggested",
        s.due_date || null
      );
      added.push(task.title || s.title);
    } catch (err) {
      skipped.push(`${s.title}: ${err.message}`);
    }
  }

  return { added, skipped };
}

async function moveTask(taskId, status) {
  if (!VALID_STATUSES.includes(status) && status !== "dismissed") {
    return { error: `Status must be one of ${[...VALID_STATUSES, "dismissed"].join(", ")}` };
  }

  // Get max position in target column
  const maxRows = await sbRequest(
    `tasks?select=position&status=eq.${status}&order=position.desc&limit=1`
  );
  const position = maxRows?.length ? maxRows[0].position + 1 : 1;

  const result = await sbRequest(`tasks?id=eq.${taskId}`, "PATCH", {
    status,
    position,
  });
  return result?.[0] || { updated: taskId, status };
}

async function updateTask(taskId, updates) {
  const patch = {};
  if (updates.title !== undefined) patch.title = updates.title.trim();
  if (updates.due_date !== undefined) patch.due_date = updates.due_date || null;
  if (updates.status !== undefined && VALID_STATUSES.includes(updates.status)) {
    patch.status = updates.status;
  }

  if (Object.keys(patch).length === 0) {
    return { error: "No valid fields to update" };
  }

  const result = await sbRequest(`tasks?id=eq.${taskId}`, "PATCH", patch);
  return result?.[0] || { updated: taskId };
}

async function deleteTask(taskId) {
  await sbRequest(`tasks?id=eq.${taskId}`, "DELETE", null, "return=minimal");
  return { deleted: true, id: taskId };
}

// ── Tag tools ───────────────────────────────────────────────────────────────

async function listTags() {
  return (await sbRequest("tags?select=*&order=name")) || [];
}

async function addTagToTask(taskId, tagId) {
  await sbRequest("task_tags", "POST", {
    task_id: taskId,
    tag_id: tagId,
  });
  return { success: true, task_id: taskId, tag_id: tagId };
}

async function removeTagFromTask(taskId, tagId) {
  await sbRequest(
    `task_tags?task_id=eq.${taskId}&tag_id=eq.${tagId}`,
    "DELETE",
    null,
    "return=minimal"
  );
  return { success: true, task_id: taskId, tag_id: tagId };
}

// ── Subtask tools ───────────────────────────────────────────────────────────

async function listSubtasks(taskId) {
  return (
    (await sbRequest(
      `subtasks?select=*&task_id=eq.${taskId}&order=position`
    )) || []
  );
}

async function addSubtask(taskId, title) {
  const maxRows = await sbRequest(
    `subtasks?select=position&task_id=eq.${taskId}&order=position.desc&limit=1`
  );
  const position = maxRows?.length ? maxRows[0].position + 1 : 1;

  const result = await sbRequest("subtasks", "POST", {
    task_id: taskId,
    title: title.trim(),
    position,
    completed: false,
  });
  return result?.[0] || { task_id: taskId, title, position };
}

async function toggleSubtask(subtaskId, completed) {
  const result = await sbRequest(`subtasks?id=eq.${subtaskId}`, "PATCH", {
    completed,
  });
  return result?.[0] || { updated: subtaskId, completed };
}

async function deleteSubtask(subtaskId) {
  await sbRequest(
    `subtasks?id=eq.${subtaskId}`,
    "DELETE",
    null,
    "return=minimal"
  );
  return { deleted: true, id: subtaskId };
}

// ── Calendar tools ──────────────────────────────────────────────────────────

async function syncCalendarEvents(date, events) {
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  // Delete existing events for this date
  await sbRequest(
    `calendar_events?start_time=gte.${dayStart}&start_time=lte.${dayEnd}`,
    "DELETE",
    null,
    "return=minimal"
  );

  if (!events || events.length === 0) return { synced: 0, events: [] };

  const rows = events.map((e) => ({
    subject: e.subject || "Untitled",
    start_time: e.start_time,
    end_time: e.end_time,
    location: e.location || null,
    organizer: e.organizer || null,
    is_organizer: e.is_organizer || false,
  }));

  const inserted = await sbRequest("calendar_events", "POST", rows);
  return { synced: inserted?.length || rows.length, events: inserted || rows };
}

async function listCalendarEvents(date) {
  const d = date || new Date().toISOString().slice(0, 10);
  const dayStart = `${d}T00:00:00`;
  const dayEnd = `${d}T23:59:59`;

  const events =
    (await sbRequest(
      `calendar_events?start_time=gte.${dayStart}&start_time=lte.${dayEnd}&order=start_time`
    )) || [];
  return { date: d, events };
}

async function clearCalendarEvents(date) {
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;
  await sbRequest(
    `calendar_events?start_time=gte.${dayStart}&start_time=lte.${dayEnd}`,
    "DELETE",
    null,
    "return=minimal"
  );
  return { cleared: true, date };
}

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_tasks",
    description:
      "List all tasks from the Kanban board with their tags and subtasks. Optionally filter by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: VALID_STATUSES,
          description: "Filter by status. Omit to return all (excluding dismissed).",
        },
      },
    },
  },
  {
    name: "add_task",
    description:
      "Create a new task. Goes into the todo column by default.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title (required)" },
        status: {
          type: "string",
          enum: VALID_STATUSES,
          description: "Status column. Defaults to todo.",
        },
        due_date: {
          type: "string",
          description: "Due date in YYYY-MM-DD or ISO format",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "add_suggestions",
    description:
      "Bulk-add suggested tasks (status=suggested) from Outlook calendar, emails, Slack, etc. Only include items that require the user to DO something. Deduplicates by title.",
    inputSchema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Task title" },
              due_date: { type: "string", description: "Due date YYYY-MM-DD" },
            },
            required: ["title"],
          },
        },
      },
      required: ["suggestions"],
    },
  },
  {
    name: "move_task",
    description:
      "Move a task to a different status column. Use 'dismissed' to permanently hide a suggestion.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "integer", description: "Task ID" },
        status: {
          type: "string",
          enum: [...VALID_STATUSES, "dismissed"],
        },
      },
      required: ["task_id", "status"],
    },
  },
  {
    name: "update_task",
    description: "Update a task's title, due_date, or status.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "integer", description: "Task ID" },
        title: { type: "string" },
        due_date: {
          type: ["string", "null"],
          description: "Due date or null to clear",
        },
        status: { type: "string", enum: VALID_STATUSES },
      },
      required: ["task_id"],
    },
  },
  {
    name: "delete_task",
    description:
      "Hard-delete a task. Prefer move_task with dismissed for suggestions.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "integer", description: "Task ID" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "list_tags",
    description: "List all available tags.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_tag_to_task",
    description: "Assign a tag to a task.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "integer" },
        tag_id: { type: "integer" },
      },
      required: ["task_id", "tag_id"],
    },
  },
  {
    name: "remove_tag_from_task",
    description: "Remove a tag from a task.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "integer" },
        tag_id: { type: "integer" },
      },
      required: ["task_id", "tag_id"],
    },
  },
  {
    name: "list_subtasks",
    description: "List subtasks for a task.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "integer" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "add_subtask",
    description: "Add a subtask to a task.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "integer" },
        title: { type: "string" },
      },
      required: ["task_id", "title"],
    },
  },
  {
    name: "toggle_subtask",
    description: "Toggle a subtask's completed state.",
    inputSchema: {
      type: "object",
      properties: {
        subtask_id: { type: "integer" },
        completed: { type: "boolean" },
      },
      required: ["subtask_id", "completed"],
    },
  },
  {
    name: "delete_subtask",
    description: "Delete a subtask.",
    inputSchema: {
      type: "object",
      properties: {
        subtask_id: { type: "integer" },
      },
      required: ["subtask_id"],
    },
  },
  {
    name: "sync_calendar_events",
    description:
      "Replace all calendar events for a date with new ones. Use after reading the user's Outlook calendar to push events into the dashboard. Deletes existing events for that date first.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format",
        },
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              subject: { type: "string" },
              start_time: { type: "string", description: "ISO 8601 datetime" },
              end_time: { type: "string", description: "ISO 8601 datetime" },
              location: { type: "string" },
              organizer: { type: "string" },
              is_organizer: { type: "boolean" },
            },
            required: ["subject", "start_time", "end_time"],
          },
        },
      },
      required: ["date", "events"],
    },
  },
  {
    name: "list_calendar_events",
    description: "List calendar events for a date (defaults to today).",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
      },
    },
  },
  {
    name: "clear_calendar_events",
    description: "Delete all calendar events for a specific date.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["date"],
    },
  },
];

// ── MCP request handler ─────────────────────────────────────────────────────

async function handleRequest(request) {
  const { method, id: reqId, params = {} } = request;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: reqId,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "kanban-mcp", version: "1.0.0" },
      },
    };
  }

  if (method === "notifications/initialized") return null;

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id: reqId, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    const name = params.name;
    const args = params.arguments || {};

    try {
      let result;

      switch (name) {
        case "list_tasks":
          result = await listTasks(args.status);
          break;
        case "add_task":
          result = await addTask(args.title, args.status, args.due_date);
          break;
        case "add_suggestions":
          result = await addSuggestions(args.suggestions);
          break;
        case "move_task":
          result = await moveTask(args.task_id, args.status);
          break;
        case "update_task":
          result = await updateTask(args.task_id, {
            title: args.title,
            due_date: args.due_date,
            status: args.status,
          });
          break;
        case "delete_task":
          result = await deleteTask(args.task_id);
          break;
        case "list_tags":
          result = await listTags();
          break;
        case "add_tag_to_task":
          result = await addTagToTask(args.task_id, args.tag_id);
          break;
        case "remove_tag_from_task":
          result = await removeTagFromTask(args.task_id, args.tag_id);
          break;
        case "list_subtasks":
          result = await listSubtasks(args.task_id);
          break;
        case "add_subtask":
          result = await addSubtask(args.task_id, args.title);
          break;
        case "toggle_subtask":
          result = await toggleSubtask(args.subtask_id, args.completed);
          break;
        case "delete_subtask":
          result = await deleteSubtask(args.subtask_id);
          break;
        case "sync_calendar_events":
          result = await syncCalendarEvents(args.date, args.events);
          break;
        case "list_calendar_events":
          result = await listCalendarEvents(args.date);
          break;
        case "clear_calendar_events":
          result = await clearCalendarEvents(args.date);
          break;
        default:
          result = { error: `Unknown tool: ${name}` };
      }

      return {
        jsonrpc: "2.0",
        id: reqId,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id: reqId,
        result: {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id: reqId,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

// ── Stdio loop ──────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const request = JSON.parse(trimmed);
    const response = await handleRequest(request);
    if (response !== null) {
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch {
    // Ignore malformed JSON
  }
});

// ── Test mode ───────────────────────────────────────────────────────────────

if (process.argv[2] === "test") {
  (async () => {
    console.log("Testing Supabase connection...");
    try {
      const tasks = await listTasks();
      console.log(`✅ Connected — ${tasks.length} tasks found`);
      for (const t of tasks.slice(0, 5)) {
        const tags = t.tags?.map((tg) => tg.name).join(", ") || "none";
        console.log(`  [${t.status}] ${t.title} (tags: ${tags})`);
      }
      const tags = await listTags();
      console.log(`✅ ${tags.length} tags found`);
      const cal = await listCalendarEvents();
      console.log(`✅ ${cal.events.length} calendar events for ${cal.date}`);
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`);
    }
    process.exit(0);
  })();
}
