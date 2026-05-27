# File Tasks

A task management plugin for [Obsidian](https://obsidian.md) that lets you manage tasks directly within your vault files. Each project is a Markdown file — tasks live where your notes are.

## Features

### Multiple Task Views

View and manage your tasks in the way that works best for you:

- **List** — Classic task list with hierarchy, filtering, and drag-and-drop reordering.
- **Kanban** — Three-column board (To Do / Doing / Done) with drag-and-drop status changes.
- **Quadrant** — Priority matrix (Eisenhower-style) for visual prioritization.
- **Time** — Tasks grouped by due date, scheduled date, or start date.
- **Memo** — Freeform notes and memos alongside your tasks.

### Quick Add Task

Press `Ctrl+P` → **Quick Add Task** to open a modal that lets you:

- Select a project file to add tasks to
- Set task description, priority, due date, scheduled date, start date
- Add remarks and notes to tasks
- Create subtasks with parent-child hierarchy
- Use natural language input with AI assistance (optional)

### Project Management

- **Create New Project** — Create new project files from a command or directly within the Quick Add modal.
- **Folder Organization** — Organize projects into folders; create, rename, and manage folders from within the plugin.
- **Remember Last Project** — Optionally reopen the last project you were working on.

### Task Metadata

Tasks support rich metadata using emoji-based markers (compatible with the Obsidian Tasks format):

| Marker | Meaning |
|--------|---------|
| `📅` | Due date |
| `⏳` | Scheduled date |
| `🛫` | Start date |
| `➕` | Created date |
| `✅` | Completed date |
| `❌` | Cancelled date |
| `🔺` | Highest priority |
| `⏫` | High priority |
| `🔼` | Medium priority |
| `🔽` | Low priority |
| `⏬` | Lowest priority |

Task statuses: `[ ]` todo, `[x]` done, `[/]` doing, `[-]` cancelled.

### AI Assistant (Optional)

Enable AI-powered features in settings by providing an OpenAI-compatible API key:

- **Natural Language Task Input** — Describe tasks in plain language and let AI parse them into structured tasks with dates, priorities, and statuses.
- **Task Organization** — Get summaries, completion analysis, and suggestions from AI.

Supports any OpenAI-compatible API (OpenAI, DeepSeek, local models, etc.).

### Settings

- **Task Directory** — Limit task scanning to a specific folder.
- **Default Task File** — Set a fallback file for quick capture.
- **Close Window on Task Add** — Auto-close the Quick Add modal after adding.
- **Show Completed Tasks by Default** — Toggle completed task visibility.
- **Automatic Date Management** — Auto-add creation, completion, and cancellation dates.
- **Show Mascot** — Display a motivational mascot in the project header.
- **Enabled Views** — Choose which views (Kanban, Quadrant, Time) appear alongside List and Memo.
- **View Switch Style** — Display views as horizontal tabs or a dropdown selector.

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Copy them to `<vault>/.obsidian/plugins/file-tasks/`.
3. Restart Obsidian and enable the plugin in **Settings → Community plugins**.

### From Source

```bash
git clone https://github.com/likemuuxi/obsidian-file-tasks.git
cd obsidian-file-tasks
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin folder.

## Development

```bash
npm install
npm run dev
```

This starts esbuild in watch mode. Changes to `src/` are compiled to `main.js` automatically.

### Build for Production

```bash
npm run build
```

## Commands

| Command | Description |
|---------|-------------|
| **Quick Add Task** | Open the task creation modal |
| **Create New Project** | Create a new project Markdown file |

## Compatibility

- Minimum Obsidian version: 0.15.0
- Works on desktop and mobile (`isDesktopOnly: false`)

## Author

**Muuxi** — [GitHub](https://github.com/likemuuxi/obsidian-file-tasks)

## License

0-BSD
