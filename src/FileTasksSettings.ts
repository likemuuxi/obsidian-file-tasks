export interface FileTasksSettings {
    taskDirectory: string;
    defaultTaskFile: string;
    closeWindowOnTaskAdd: boolean;
    defaultSelectFirstProject: boolean;
    collapsedFolders: string[];
    defaultShowCompleted: boolean;
    customDefaultProject: string; // New setting
    autoDateManagement: boolean;
    showMascot: boolean;
    rememberLastOpenedProject: boolean;
    lastOpenedProject: string;
}

export const DEFAULT_SETTINGS: FileTasksSettings = {
    taskDirectory: '/',
    defaultTaskFile: 'Inbox.md',
    closeWindowOnTaskAdd: true,
    defaultSelectFirstProject: false,
    collapsedFolders: [],
    defaultShowCompleted: true,
    customDefaultProject: '',
    autoDateManagement: false,
    showMascot: true,
    rememberLastOpenedProject: true,
    lastOpenedProject: ''
}
