export interface ParsedTask {
    description: string;
    priority: string;
    dueDate: string;
    startDate: string;
    scheduledDate: string;
    remarks: string;
}

const TASK_PARSE_SYSTEM_PROMPT = `You are a task management assistant. The user will describe a task in natural language. You must extract the task details and return ONLY a valid JSON object with these fields:

- "description": (string) The task description, concise and clear, in the SAME LANGUAGE as the user's input
- "priority": (string) One of: "None", "Low", "Medium", "High", "Highest". Default "None".
- "dueDate": (string) Due date in "YYYY-MM-DD HH:mm" format (24-hour), or "" if not specified
- "startDate": (string) Start date in "YYYY-MM-DD HH:mm" format (24-hour), or "" if not specified
- "scheduledDate": (string) Scheduled date in "YYYY-MM-DD HH:mm" format (24-hour), or "" if not specified
- "remarks": (string) Any additional notes or context, or "" if none

Rules:
- Current datetime is {{TODAY}}. Resolve relative dates/times (e.g. "tomorrow", "next Monday 3pm", "this Friday", "tonight at 8") to absolute "YYYY-MM-DD HH:mm" format.
- If the user specifies a time (e.g. "3pm", "14:30", "tonight at 8"), include it in the date. If no time is mentioned, use "YYYY-MM-DD 00:00" (date only with 00:00).
- If the user says "urgent" or "ASAP", set priority to "High" or "Highest".
- If the user mentions a time without a date, use today's date.
- Keep the description in the user's language.
- Return ONLY the JSON object, no extra text, no markdown code fences.`;

export function buildTaskParsePrompt(userInput: string): string {
    return userInput;
}

export function getTaskParseSystemPrompt(todayDate: string): string {
    return TASK_PARSE_SYSTEM_PROMPT.replace('{{TODAY}}', todayDate);
}

export function parseTaskResponse(raw: string): ParsedTask | null {
    try {
        let jsonStr = raw.trim();
        const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch && fenceMatch[1] !== undefined) {
            jsonStr = fenceMatch[1].trim();
        }
        const parsed = JSON.parse(jsonStr);
        return {
            description: parsed.description || '',
            priority: ['None', 'Low', 'Medium', 'High', 'Highest'].includes(parsed.priority) ? parsed.priority : 'None',
            dueDate: parsed.dueDate || '',
            startDate: parsed.startDate || '',
            scheduledDate: parsed.scheduledDate || '',
            remarks: parsed.remarks || '',
        };
    } catch {
        return null;
    }
}

const TASK_ORGANIZE_SYSTEM_PROMPT = `You are a task management assistant in an Obsidian plugin. You help users organize, summarize, and analyze their tasks.

The user's tasks follow this format:
- [ ] Task description 📅 2024-01-15 ⏳ 2024-01-10 🛫 2024-01-08 ➕ 2024-01-01 ✅ 2024-01-15 ❌ 2024-01-15
  - [ ] Subtask
  - [x] Completed subtask

Status markers: [ ] = todo, [x] = done, [/] = doing, [-] = cancelled
Priority icons: ⏫ High, 🔼 Medium, 🔽 Low, 🔺 Highest, ⏬ Lowest
Date icons: 📅 Due, ⏳ Scheduled, 🛫 Start, ➕ Created, ✅ Completed, ❌ Cancelled

Today's date is {{TODAY}}.

You can:
- Summarize tasks for a given period (e.g. weekly report)
- Analyze task completion rates and progress
- Suggest task priorities or scheduling
- Help organize and categorize tasks
- Generate reports in Markdown format

Always respond in the user's language.`;

export function getOrganizeSystemPrompt(todayDate: string): string {
    return TASK_ORGANIZE_SYSTEM_PROMPT.replace('{{TODAY}}', todayDate);
}
