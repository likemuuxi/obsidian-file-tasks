import { App, TFile } from 'obsidian';
import { QuickAddModal } from '../modals/QuickAddModal';
import { FileAccess } from '../core/FileAccess';

export interface ViewTask {
    line: string;
    lineNum: number;
    status: string;
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
    blockId?: string;
    linkedBlockIds?: string[];
    sourceFile?: string;
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

        (container as any).hoverPopover = null;
        container.addEventListener('mouseover', (event) => {
            const target = event.target as HTMLElement | null;
            const linkEl = target?.closest('a.internal-link');
            if (!(linkEl instanceof HTMLAnchorElement)) {
                return;
            }
            this.app.workspace.trigger('hover-link', {
                event,
                source: 'file-tasks',
                hoverParent: container,
                targetEl: linkEl,
                linktext: linkEl.getAttribute('data-href') ?? linkEl.getAttribute('href') ?? '',
                sourcePath: modal.targetFile,
            });
        });
    }

    abstract render(tasks: ViewTask[], file: TFile): void;

    // Helper to clear container
    clear() {
        this.container.empty();
    }
}
