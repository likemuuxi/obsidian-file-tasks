import { App, Modal, TFolder, Notice } from 'obsidian';

export class RenameFolderModal extends Modal {
    folder: TFolder;
    folderNewName: string;
    onRename: (newPath: string) => void;

    constructor(app: App, folder: TFolder, onRename: (newPath: string) => void) {
        super(app);
        this.folder = folder;
        this.folderNewName = folder.name;
        this.onRename = onRename;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('create-project-modal'); // Re-use styling

        contentEl.createEl('h2', { text: 'Rename Folder' });

        const inputContainer = contentEl.createDiv({ cls: 'project-input-container' });
        const input = inputContainer.createEl('input', { type: 'text' });
        input.value = this.folderNewName;
        input.placeholder = 'New folder name';

        input.oninput = (e) => {
            this.folderNewName = (e.target as HTMLInputElement).value;
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
        const newName = this.folderNewName.trim();
        if (!newName) {
            new Notice('Folder name cannot be empty.');
            return;
        }

        if (newName === this.folder.name) {
            this.close();
            return;
        }

        // Construct new path
        const parentPath = this.folder.parent?.path === '/' ? '' : this.folder.parent?.path + '/';
        const newPath = `${parentPath}${newName}`;

        // Check availability
        const existing = this.app.vault.getAbstractFileByPath(newPath);
        if (existing) {
            new Notice('A folder with this name already exists.');
            return;
        }

        try {
            await this.app.fileManager.renameFile(this.folder, newPath);
            new Notice(`Folder renamed to ${newName}`);
            if (this.onRename) {
                this.onRename(newPath);
            }
            this.close();
        } catch (error) {
            new Notice('Failed to rename folder.');
            console.error(error);
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
