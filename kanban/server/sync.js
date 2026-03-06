/**
 * POST /api/sync
 *
 * Calls the Anthropic API with Microsoft 365 MCP to:
 *   1. Read today's Outlook calendar events
 *   2. Read recent emails (since last sync)
 *
 * Returns:
 *   { calendarTasks: [...], emailSuggestions: [...], syncedAt: ISO string }
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MS365_MCP_URL = 'https://microsoft365.mcp.claude.com/mcp';

async function handleSync(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server' });
  }

  const { lastSyncedAt } = req.body || {};

  const today = new Date().toISOString().slice(0, 10);
  const sinceDate = lastSyncedAt
    ? new Date(lastSyncedAt).toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const systemPrompt = `You are a productivity assistant. You have access to Microsoft 365 tools.

Your job:
1. Search the user's Outlook calendar for ALL events happening today (${today}).
2. Search the user's Outlook emails received since ${sinceDate}.
3. Based on the calendar events, produce a list of tasks to create.
4. Based on the emails, suggest actionable tasks the user might want to do.

IMPORTANT: Respond with ONLY a JSON object (no markdown, no backticks, no preamble). Use this exact schema:

{
  "calendarTasks": [
    {
      "title": "string - concise task title derived from the calendar event",
      "due_date": "string - ISO date or datetime, e.g. 2025-03-06 or 2025-03-06T14:00",
      "source": "string - the original calendar event subject/title"
    }
  ],
  "emailSuggestions": [
    {
      "title": "string - suggested actionable task",
      "reason": "string - brief explanation of why, referencing the email subject or sender",
      "priority": "low | medium | high"
    }
  ]
}

Rules:
- For calendar tasks: create one task per event. Use the event subject as the source. Set due_date to the event start time.
- For email suggestions: only suggest tasks for emails that clearly require action (replies needed, requests, deadlines mentioned, follow-ups). Skip newsletters, notifications, and automated emails.
- If no events are found, return an empty calendarTasks array.
- If no actionable emails are found, return an empty emailSuggestions array.
- Maximum 10 email suggestions.
- Return ONLY valid JSON. No extra text.`;

  const userMessage = `Please check my Outlook calendar for today (${today}) and my recent emails since ${sinceDate}. Return the structured JSON as instructed.`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        mcp_servers: [
          {
            type: 'url',
            url: MS365_MCP_URL,
            name: 'microsoft-365',
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return res.status(502).json({
        error: 'Anthropic API request failed',
        status: response.status,
        detail: errBody,
      });
    }

    const data = await response.json();

    // Extract text content from the response
    const textBlocks = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text);

    const rawText = textBlocks.join('\n').trim();

    // Parse the JSON response - strip any markdown fences if present
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse Claude response as JSON:', cleaned);
      return res.status(502).json({
        error: 'Could not parse AI response as JSON',
        raw: cleaned,
      });
    }

    const calendarTasks = Array.isArray(parsed.calendarTasks) ? parsed.calendarTasks : [];
    const emailSuggestions = Array.isArray(parsed.emailSuggestions) ? parsed.emailSuggestions : [];

    res.json({
      calendarTasks,
      emailSuggestions,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Internal sync error', detail: err.message });
  }
}

module.exports = { handleSync };
