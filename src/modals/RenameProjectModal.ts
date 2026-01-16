import { App, Modal, TFile, Notice } from 'obsidian';

export class RenameProjectModal extends Modal {
    file: TFile;
    projectNewName: string;
    onRename: (newPath: string) => void;

    constructor(app: App, file: TFile, onRename: (newPath: string) => void) {
        super(app);
        this.file = file;
        this.projectNewName = file.basename;
        this.onRename = onRename;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('create-project-modal'); // Re-use styling if generic enough or add new class

        contentEl.createEl('h2', { text: 'Rename Project' });

        const inputContainer = contentEl.createDiv({ cls: 'project-input-container' });
        const input = inputContainer.createEl('input', { type: 'text' });
        input.value = this.projectNewName;
        input.placeholder = 'New project name';

        input.oninput = (e) => {
            this.projectNewName = (e.target as HTMLInputElement).value;
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.rename();
            }
        };

        // Auto-focus
        setTimeout(() => input.focus(), 50);

        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

        const saveBtn = buttonContainer.createEl('button', { text: 'Rename', cls: 'mod-cta' });
        saveBtn.onclick = () => this.rename();

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();
    }

    async rename() {
        const newName = this.projectNewName.trim();
        if (!newName) {
            new Notice('Project name cannot be empty.');
            return;
        }

        if (newName === this.file.basename) {
            this.close();
            return;
        }

        // Construct new path
        const parentPath = this.file.parent?.path === '/' ? '' : this.file.parent?.path + '/';
        const newPath = `${parentPath}${newName}.md`;

        // Check availability
        const existing = this.app.vault.getAbstractFileByPath(newPath);
        if (existing) {
            new Notice('A file with this name already exists.');
            return;
        }

        try {
            await this.app.fileManager.renameFile(this.file, newPath);
            new Notice(`Project renamed to ${newName}`);
            if (this.onRename) {
                this.onRename(newPath);
            }
            this.close();
        } catch (error) {
            new Notice('Failed to rename project.');
            console.error(error);
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
