import { App, Modal, Setting, Notice, TFolder } from 'obsidian';
import FileTasksPlugin from '../main';

export class CreateProjectModal extends Modal {
    plugin: FileTasksPlugin;
    projectName: string = '';
    onCreated: (() => void) | null = null;

    constructor(app: App, plugin: FileTasksPlugin, onCreated?: () => void) {
        super(app);
        this.plugin = plugin;
        if (onCreated) this.onCreated = onCreated;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Create New Project' });

        new Setting(contentEl)
            .setName('Project Name')
            .addText(text => {
                text.setPlaceholder('My New Project')
                    .onChange(value => {
                        this.projectName = value;
                    });

                // Bind Enter key to create project
                text.inputEl.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.createProject();
                    }
                };

                // Auto-focus
                setTimeout(() => text.inputEl.focus(), 50);
            });

        const footer = contentEl.createDiv({ cls: 'modal-footer' });
        const btn = footer.createEl('button', { text: 'Create', cls: 'mod-cta' });
        btn.onclick = async () => await this.createProject();
    }

    async createProject() {
        if (!this.projectName) {
            new Notice('Project name is required.');
            return;
        }

        const fileName = `${this.projectName}.md`;
        let folderPath = this.plugin.settings.taskDirectory;

        // Handle root directory or missing directory
        if (!folderPath || folderPath === '/') folderPath = '';

        // Ensure folder ends with / if not empty
        const fullPath = folderPath ? (folderPath.endsWith('/') ? `${folderPath}${fileName}` : `${folderPath}/${fileName}`) : fileName;

        // Check file existence
        if (this.app.vault.getAbstractFileByPath(fullPath)) {
            new Notice('A file with this name already exists.');
            return;
        }

        // Create Header
        const frontmatter = `---
project: true
order: ${Date.now()}
status: ${this.plugin.settings.defaultProjectStatus}
defaultView: ${this.plugin.settings.defaultProjectView}
---
# Tasks

`;

        try {
            // Ensure folder exists
            if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
                await this.app.vault.createFolder(folderPath);
            }

            const file = await this.app.vault.create(fullPath, frontmatter);
            await this.app.workspace.getLeaf(false).openFile(file);
            new Notice(`Project "${this.projectName}" created.`);

            // Wait for metadata cache to update
            await new Promise(resolve => setTimeout(resolve, 300));

            if (this.onCreated) {
                this.onCreated();
            }

            this.close();
        } catch (error) {
            new Notice('Error creating project file.');
            console.error(error);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
