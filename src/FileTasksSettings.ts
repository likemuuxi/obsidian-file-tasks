export type ViewType = 'list' | 'kanban' | 'quadrant' | 'time' | 'memo';

export const ALL_VIEW_TYPES: ViewType[] = ['kanban', 'quadrant', 'time'];

export type ViewSwitchStyle = 'tabs' | 'dropdown';

export interface FileTasksSettings {
    taskDirectory: string;
    defaultTaskFile: string;
    closeWindowOnTaskAdd: boolean;
    defaultSelectFirstProject: boolean;
    collapsedFolders: string[];
    defaultShowCompleted: boolean;
    customDefaultProject: string;
    autoDateManagement: boolean;
    showMascot: boolean;
    rememberLastOpenedProject: boolean;
    enabledViews: ViewType[];
    viewSwitchStyle: ViewSwitchStyle;

    aiEnabled: boolean;
    aiApiKey: string;
    aiBaseUrl: string;
    aiModel: string;
}

const LAST_OPENED_KEY = 'obsidian-file-tasks-last-opened-project';

export function getLastOpenedProject(): string {
    return localStorage.getItem(LAST_OPENED_KEY) || '';
}

export function setLastOpenedProject(path: string) {
    localStorage.setItem(LAST_OPENED_KEY, path);
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
    enabledViews: [],
    viewSwitchStyle: 'tabs',

    aiEnabled: false,
    aiApiKey: '',
    aiBaseUrl: 'https://api.openai.com/v1',
    aiModel: 'gpt-4o-mini',
}
