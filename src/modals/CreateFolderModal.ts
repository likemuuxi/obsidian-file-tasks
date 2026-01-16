import { App, Modal, Setting, Notice, TFolder } from 'obsidian';
import FileTasksPlugin from '../main';

export class CreateFolderModal extends Modal {
    plugin: FileTasksPlugin;
    folderName: string = '';
    onCreated: ((path: string) => void) | null = null;
    basePath: string = '';

    constructor(app: App, plugin: FileTasksPlugin, basePath: string, onCreated?: (path: string) => void) {
        super(app);
        this.plugin = plugin;
        this.basePath = basePath;
        if (onCreated) this.onCreated = onCreated;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Create New Folder' });

        new Setting(contentEl)
            .setName('Folder Name')
            .addText(text => {
                text.setPlaceholder('Folder Name')
                    .onChange(value => {
                        this.folderName = value;
                    });

                // Bind Enter key
                text.inputEl.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.createFolder();
                    }
                };

                // Auto-focus
                setTimeout(() => text.inputEl.focus(), 50);
            });

        const footer = contentEl.createDiv({ cls: 'modal-footer' });
        const btn = footer.createEl('button', { text: 'Create', cls: 'mod-cta' });
        btn.onclick = async () => await this.createFolder();
    }

    async createFolder() {
        if (!this.folderName) {
            new Notice('Folder name is required.');
            return;
        }

        let fullPath = this.basePath;
        if (fullPath && !fullPath.endsWith('/')) fullPath += '/';
        fullPath += this.folderName;

        // Check existence
        if (this.app.vault.getAbstractFileByPath(fullPath)) {
            new Notice('A folder or file with this name already exists.');
            return;
        }

        try {
            await this.app.vault.createFolder(fullPath);
            new Notice(`Folder "${this.folderName}" created.`);

            if (this.onCreated) {
                this.onCreated(fullPath);
            }

            this.close();
        } catch (error) {
            new Notice('Error creating folder.');
            console.error(error);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
