import { Plugin, WorkspaceLeaf, TFile } from 'obsidian';
import { TaskView, VIEW_TYPE_FILE_TASKS } from './views/TaskView';
import { FileTasksSettings, DEFAULT_SETTINGS } from './FileTasksSettings';
import { FileTasksSettingTab } from './FileTasksSettingTab';
import { QuickAddModal } from './modals/QuickAddModal';
import { CreateProjectModal } from './modals/CreateProjectModal';

export default class FileTasksPlugin extends Plugin {
	private view: TaskView | null = null;
	settings: FileTasksSettings;

	async onload() {
		console.log('Loading File Tasks Plugin');

		await this.loadSettings();

		this.registerHoverLinkSource('file-tasks', {
			display: 'File Tasks',
			defaultMod: true,
		});

		this.registerView(
			VIEW_TYPE_FILE_TASKS,
			(leaf) => (this.view = new TaskView(leaf, this))
		);

		this.addSettingTab(new FileTasksSettingTab(this.app, this));

		// this.addCommand({
		// 	id: 'open-file-tasks-view',
		// 	name: 'Open File Tasks View',
		// 	callback: () => {
		// 		this.activateView();
		// 	}
		// });

		this.addCommand({
			id: 'quick-add-task',
			name: 'Quick Add Task',
			callback: () => {
				new QuickAddModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'create-new-project',
			name: 'Create New Project',
			callback: () => {
				new CreateProjectModal(this.app, this).open();
			}
		});

		// this.registerEvent(
		// 	this.app.workspace.on('file-open', async (file) => {
		// 		if (file) {
		// 			const content = await this.app.vault.read(file);
		// 			this.updateViews(file, content);
		// 		}
		// 	})
		// );

		// this.registerEvent(
		// 	this.app.vault.on('modify', async (file) => {
		// 		if (file instanceof TFile && file === this.app.workspace.getActiveFile()) {
		// 			const content = await this.app.vault.read(file);
		// 			this.updateViews(file, content);
		// 		}
		// 	})
		// );

		// Initial load
		this.app.workspace.onLayoutReady(() => {
			this.refreshActiveFile();
		});
	}

	async refreshActiveFile() {
		let file = this.app.workspace.getActiveFile();

		if (!file) {
			const markdownLeaves = this.app.workspace.getLeavesOfType('markdown');
			if (markdownLeaves.length > 0) {
				// @ts-ignore
				file = markdownLeaves[0].view.file;
			}
		}

		if (file instanceof TFile) {
			const content = await this.app.vault.read(file);
			this.updateViews(file, content);
		}
	}

	updateViews(file: TFile, content: string) {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_FILE_TASKS);
		leaves.forEach(leaf => {
			// @ts-ignore
			if (leaf.view && leaf.view.updateView) {
				// @ts-ignore
				leaf.view.updateView(file, content);
			}
		});
	}

	async onunload() {
		console.log('Unloading File Tasks Plugin');
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_FILE_TASKS);

		if (leaves.length > 0) {
			const existing = leaves[0];
			if (existing) leaf = existing;
		} else {
			leaf = workspace.getLeaf(true);
			await leaf.setViewState({ type: VIEW_TYPE_FILE_TASKS, active: true });
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
			this.refreshActiveFile();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
