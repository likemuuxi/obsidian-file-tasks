import { App, TFile } from 'obsidian';
import { QuickAddModal } from '../modals/QuickAddModal';
import { FileAccess } from '../core/FileAccess';

export interface ViewTask {
    line: string;
    lineNum: number;
    status: string; // 'todo', 'doing', 'done', 'cancelled'
    content: string;
    dueDate?: string;
    startDate?: string;
    scheduledDate?: string;
    createdDate?: string;
    completedDate?: string;
    cancelledDate?: string;
    priority?: string;
    indent: number;
    remarks?: string;
    originalLine: string;
    parentContent?: string;
    parentLineNum?: number;
    children?: ViewTask[];
}

export abstract class TaskView {
    app: App;
    modal: QuickAddModal;
    container: HTMLElement;
    fileAccess: FileAccess;

    constructor(app: App, modal: QuickAddModal, container: HTMLElement) {
        this.app = app;
        this.modal = modal;
        this.container = container;
        this.fileAccess = modal.fileAccess;
    }

    abstract render(tasks: ViewTask[], file: TFile): void;

    // Helper to clear container
    clear() {
        this.container.empty();
    }
}
