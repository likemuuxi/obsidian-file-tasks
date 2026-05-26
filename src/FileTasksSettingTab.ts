import { App, PluginSettingTab, Setting } from 'obsidian';
import FileTasksPlugin from './main';
import { FileTasksSettings, ALL_VIEW_TYPES, ViewType } from './FileTasksSettings';

const VIEW_LABELS: Record<ViewType, string> = {
    'list': 'List',
    'kanban': 'Kanban',
    'quadrant': 'Quadrant',
    'time': 'Time',
    'memo': 'Memo'
};

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
            .setName('Remember Last Opened Project')
            .setDesc('If enabled, the Quick Add window will always open the project you were last viewing, ignoring the default project setting.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.rememberLastOpenedProject)
                .onChange(async (value) => {
                    this.plugin.settings.rememberLastOpenedProject = value;
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

        containerEl.createEl('h3', { text: 'View Settings' });

        new Setting(containerEl)
            .setName('Enabled Views')
            .setDesc('Choose additional views to show in the Quick Add window. List and Memo are always available.')
            .setClass('enabled-views-setting')
            .then((setting) => {
                const fragment = document.createDocumentFragment();
                ALL_VIEW_TYPES.forEach(viewType => {
                    const cb = fragment.createEl('label', { cls: 'enabled-views-checkbox' });
                    const input = cb.createEl('input', { type: 'checkbox' });
                    input.checked = this.plugin.settings.enabledViews.includes(viewType);
                    input.addEventListener('change', async () => {
                        if (input.checked) {
                            if (!this.plugin.settings.enabledViews.includes(viewType)) {
                                this.plugin.settings.enabledViews.push(viewType);
                            }
                        } else {
                            this.plugin.settings.enabledViews = this.plugin.settings.enabledViews.filter(v => v !== viewType);
                        }
                        await this.plugin.saveSettings();
                    });
                    cb.createSpan({ text: VIEW_LABELS[viewType] });
                    fragment.createEl('br');
                });
                setting.descEl.empty();
                setting.descEl.append(fragment);
            });

        new Setting(containerEl)
            .setName('View Switch Style')
            .setDesc('Choose how views are displayed in the Quick Add window.')
            .addDropdown(dropdown => dropdown
                .addOption('tabs', 'Horizontal Tabs')
                .addOption('dropdown', 'Dropdown Selector')
                .setValue(this.plugin.settings.viewSwitchStyle)
                .onChange(async (value) => {
                    this.plugin.settings.viewSwitchStyle = value as any;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'AI Assistant' });

        new Setting(containerEl)
            .setName('Enable AI Features')
            .setDesc('Enable AI-powered task parsing and chat features.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.aiEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.aiEnabled = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.aiEnabled) {
            new Setting(containerEl)
                .setName('API Key')
                .setDesc('Your OpenAI-compatible API key.')
                .addText(text => text
                    .setPlaceholder('sk-...')
                    .setValue(this.plugin.settings.aiApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.aiApiKey = value;
                        await this.plugin.saveSettings();
                    }))
                .then(setting => {
                    setting.controlEl.querySelector('input')?.setAttribute('type', 'password');
                });

            new Setting(containerEl)
                .setName('API Base URL')
                .setDesc('Base URL for the OpenAI-compatible API endpoint.')
                .addText(text => text
                    .setPlaceholder('https://api.openai.com/v1')
                    .setValue(this.plugin.settings.aiBaseUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.aiBaseUrl = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Model')
                .setDesc('Model name to use (e.g. gpt-4o-mini, deepseek-chat).')
                .addText(text => text
                    .setPlaceholder('gpt-4o-mini')
                    .setValue(this.plugin.settings.aiModel)
                    .onChange(async (value) => {
                        this.plugin.settings.aiModel = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }
}
