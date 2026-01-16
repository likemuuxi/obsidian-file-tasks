export interface FileTask {
    id: string; // Unique ID (line hash or similar)
    originalLine: string;
    description: string;
    status: 'todo' | 'doing' | 'done';
    lineNumber: number;
    indentation: number;
    parent?: FileTask;
    children: FileTask[];

    // Metadata
    dueDate?: string; // 📅 YYYY-MM-DD
    scheduledDate?: string; // ⏳ YYYY-MM-DD
    startDate?: string; // 🛫 YYYY-MM-DD
    priority?: string; // ⏫, 🔼, 🔽

    // Comments
    note?: string; // Content between %%%%
}
