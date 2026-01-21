import { App, PluginSettingTab, Setting } from 'obsidian';
import FileTasksPlugin from './main';

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
    showMascot: true
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
                .setPlaceholder('Example: Projects')
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
            .setName('Close Window on Task Add')
            .setDesc('Automatically close the Quick Add window after adding a task.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.closeWindowOnTaskAdd)
                .onChange(async (value) => {
                    this.plugin.settings.closeWindowOnTaskAdd = value;
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

        new Setting(containerEl)
            .setName('Automatic Date Management')
            .setDesc('Automatically add dates when tasks are created (➕), completed (✅), or cancelled (❌).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoDateManagement)
                .onChange(async (value) => {
                    this.plugin.settings.autoDateManagement = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Mascot')
            .setDesc('Show a motivational mascot in the project header.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showMascot)
                .onChange(async (value) => {
                    this.plugin.settings.showMascot = value;
                    await this.plugin.saveSettings();
                }));
    }
}
