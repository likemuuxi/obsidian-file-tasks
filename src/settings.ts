import { App, PluginSettingTab, Setting } from 'obsidian';
import FileTasksPlugin from './main';

export interface FileTasksSettings {
    taskDirectory: string;
    defaultTaskFile: string;
    defaultProjectStatus: string;
    defaultProjectView: string;
    closeWindowOnTaskAdd: boolean;
    defaultSelectFirstProject: boolean;
    collapsedFolders: string[];
    defaultShowCompleted: boolean;
    customDefaultProject: string; // New setting
}

export const DEFAULT_SETTINGS: FileTasksSettings = {
    taskDirectory: '/',
    defaultTaskFile: 'Inbox.md',
    defaultProjectStatus: 'active',
    defaultProjectView: 'list',
    closeWindowOnTaskAdd: true,
    defaultSelectFirstProject: false,
    collapsedFolders: [],
    defaultShowCompleted: true,
    customDefaultProject: ''
}

export class FileTasksSettingTab extends PluginSettingTab {
    plugin: FileTasksPlugin;

    constructor(app: App, plugin: FileTasksPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'File Tasks Settings' });

        new Setting(containerEl)
            .setName('Task Directory')
            .setDesc('Only scan for tasks in files within this directory.')
            .addText(text => text
                .setPlaceholder('Example: Projects/Tasks')
                .setValue(this.plugin.settings.taskDirectory)
                .onChange(async (value) => {
                    this.plugin.settings.taskDirectory = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Task File')
            .setDesc('Values for Quick Capture will be appended to this file if no other file is selected.')
            .addText(text => text
                .setPlaceholder('Example: Inbox.md')
                .setValue(this.plugin.settings.defaultTaskFile)
                .onChange(async (value) => {
                    this.plugin.settings.defaultTaskFile = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'Project Defaults' });

        new Setting(containerEl)
            .setName('Default Project Status')
            .setDesc('Status for newly created projects.')
            .addDropdown(drop => drop
                .addOption('active', 'Active')
                .addOption('paused', 'Paused')
                .addOption('completed', 'Completed')
                .addOption('archived', 'Archived')
                .setValue(this.plugin.settings.defaultProjectStatus)
                .onChange(async (value) => {
                    this.plugin.settings.defaultProjectStatus = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Project View')
            .setDesc('View for newly created projects.')
            .addDropdown(drop => drop
                .addOption('list', 'List')
                .addOption('kanban', 'Kanban')
                .addOption('timeline', 'Timeline')
                .setValue(this.plugin.settings.defaultProjectView)
                .onChange(async (value) => {
                    this.plugin.settings.defaultProjectView = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Close Window on Task Add')
            .setDesc('Automatically close the Quick Add window after adding a task.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.closeWindowOnTaskAdd)
                .onChange(async (value) => {
                    this.plugin.settings.closeWindowOnTaskAdd = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Select First Project on Open')
            .setDesc('If enabled, the first sorted project will be selected instead of the default Inbox data.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.defaultSelectFirstProject)
                .onChange(async (value) => {
                    this.plugin.settings.defaultSelectFirstProject = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Completed Tasks by Default')
            .setDesc('If enabled, completed tasks will be shown in the project view by default.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.defaultShowCompleted)
                .onChange(async (value) => {
                    this.plugin.settings.defaultShowCompleted = value;
                    await this.plugin.saveSettings();
                }));
    }
}
