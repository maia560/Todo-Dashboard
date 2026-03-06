# Kanban MCP Server

Remote SSE-based MCP server that exposes your Supabase Kanban board to Claude.

## Tools

| Tool | Description |
|------|-------------|
| `list_tasks` | List all tasks (optionally filter by status) |
| `create_task` | Create a new task with title, status, due_date |
| `update_task` | Update title, status, or due_date of a task |
| `delete_task` | Delete a task by ID |
| `list_tags` | List all available tags |
| `add_tag_to_task` | Assign a tag to a task |
| `remove_tag_from_task` | Remove a tag from a task |

## Setup

```bash
cd kanban/mcp-server
npm install
npm start
```

Server runs on `http://localhost:3002` by default.

## Usage with Claude

Once running, tell Claude:

> "Read my Outlook calendar for today and create tasks in my todo list for each meeting"

Claude will use the MS365 MCP to read your calendar and this MCP server to create the tasks.

### Connect in claude.ai

If deploying remotely, add as a custom MCP connector with the SSE URL:
```
https://your-domain.com/sse
```

### Connect in Claude Code / Desktop

Add to your MCP config:
```json
{
  "mcpServers": {
    "kanban": {
      "url": "http://localhost:3002/sse"
    }
  }
}
```

## Environment Variables (optional)

If you want to override the default Supabase connection:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-key
PORT=3002
```
