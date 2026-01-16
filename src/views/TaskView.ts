import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';

export const VIEW_TYPE_FILE_TASKS = 'file-tasks-view';

export class TaskView extends ItemView {
    constructor(leaf: WorkspaceLeaf, plugin: any) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_FILE_TASKS;
    }

    getDisplayText() {
        return 'File Tasks';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl('h4', { text: 'Tasks View' });
        container.createDiv({ text: 'Task View is currently being refactored.' });
    }

    updateView(file: TFile, content: string) {
        // Fallback stub
    }
}
