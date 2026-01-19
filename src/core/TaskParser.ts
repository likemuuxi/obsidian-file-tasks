import { FileTask } from './TaskModel';
import { DateUtils } from '../utils/DateUtils';

export class TaskParser {

    // Regex patterns based on Tasks plugin and Obsidian markdown
    private static TASK_REGEX = /^(\s*)-\s\[(.)\]\s(.*)$/;
    // Date Regex moved to DateUtils

    private static BLOCK_COMMENT_REGEX = /^%%%%$/;

    static parseContent(lines: string[]): FileTask[] {
        const tasks: FileTask[] = [];
        const taskStack: FileTask[] = []; // To track hierarchy
        let currentTask: FileTask | null = null;
        let readingNote = false;
        let noteBuffer: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;

            // 1. Check for Block Comments (Notes)
            if (this.BLOCK_COMMENT_REGEX.test(line.trim())) {
                if (readingNote && currentTask) {
                    // End of note
                    currentTask.note = noteBuffer.join('\n');
                    noteBuffer = [];
                    readingNote = false;
                } else if (currentTask) {
                    // Start of note
                    readingNote = true;
                }
                continue;
            }

            if (readingNote) {
                noteBuffer.push(line);
                continue;
            }

            // 2. Parse Task Line
            const match = line.match(this.TASK_REGEX);
            if (match) {
                const [_, indentStr, status, text] = match;
                if (indentStr === undefined || status === undefined || text === undefined) continue;
                const indentation = indentStr.length;
                let taskStatus: 'todo' | 'doing' | 'done' | 'cancelled' = 'todo';
                if (status === 'x' || status === 'X') taskStatus = 'done';
                else if (status === '/') taskStatus = 'doing';
                else if (status === '-') taskStatus = 'cancelled';

                // Extract metadata from text
                const { description, metadata } = this.extractMetadata(text);

                const newTask: FileTask = {
                    id: `${i}-${Date.now()}`, // Temporary ID
                    originalLine: line,
                    description,
                    status: taskStatus,
                    lineNumber: i,
                    indentation,
                    children: [],
                    ...metadata
                };

                // Hierarchy Handling
                if (taskStack.length === 0) {
                    tasks.push(newTask);
                    taskStack.push(newTask);
                } else {
                    // Find parent
                    while (taskStack.length > 0) {
                        const lastTask = taskStack[taskStack.length - 1];
                        if (lastTask && lastTask.indentation >= indentation) {
                            taskStack.pop();
                        } else {
                            break;
                        }
                    }

                    if (taskStack.length > 0) {
                        const parent = taskStack[taskStack.length - 1];
                        if (parent) {
                            parent.children.push(newTask);
                            newTask.parent = parent;
                        } else {
                            tasks.push(newTask);
                        }
                    } else {
                        tasks.push(newTask);
                    }
                    taskStack.push(newTask);
                }
                currentTask = newTask;
            } else {
                // Not a task line, reset current task
            }
        }

        return tasks;
    }

    private static extractMetadata(text: string): { description: string, metadata: Partial<FileTask> } {
        let description = text;
        const metadata: Partial<FileTask> = {};

        // Dates
        // Dates
        let dateMatch;
        const dateRegex = DateUtils.getDateRegex(); // Get new instance
        while ((dateMatch = dateRegex.exec(text)) !== null) {
            const type = dateMatch[1]; // Group 1 is type
            const date = dateMatch[2]; // Group 2 is date
            if (type === '📅') metadata.dueDate = date;
            if (type === '⏳') metadata.scheduledDate = date;
            if (type === '🛫') metadata.startDate = date;
            if (type === '✅') metadata.completedDate = date;
            if (type === '➕') metadata.createdDate = date;
            if (type === '❌') metadata.cancelledDate = date;

            // Remove from description
            description = description.replace(dateMatch[0], '');
        }

        // Priority
        // Priority
        if (text.includes('⏫')) { metadata.priority = 'High'; description = description.replace('⏫', ''); }
        if (text.includes('🔼')) { metadata.priority = 'Medium'; description = description.replace('🔼', ''); }
        if (text.includes('🔽')) { metadata.priority = 'Low'; description = description.replace('🔽', ''); }

        description = description.trim();

        return { description, metadata };
    }
}
