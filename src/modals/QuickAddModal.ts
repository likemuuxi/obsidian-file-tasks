import { App, Modal, Setting, TFile, Notice, setIcon, DropdownComponent, Menu } from 'obsidian';
import FileTasksPlugin from '../main';
import { FileAccess } from '../core/FileAccess';
import { CreateProjectModal } from './CreateProjectModal';
import { RenameProjectModal } from './RenameProjectModal';
import { TaskView, ViewTask } from '../views/BaseTaskView';
import { TaskListView } from '../views/TaskListView';
import { TaskKanbanView } from '../views/TaskKanbanView';
import { TaskWeeklyView } from '../views/TaskWeeklyView';
import { TaskQuadrantView } from '../views/TaskQuadrantView';
import { TaskMemoView } from '../views/TaskMemoView';
import { moment } from 'obsidian';

export class QuickAddModal extends Modal {
    plugin: FileTasksPlugin;
    fileAccess: FileAccess;
    taskPreviewContainer: HTMLElement;

    // Form Values
    description: string = '';
    selectedParentLineIndex: number | null = null;
    selectedParentTaskContent: string | null = null;
    editingLineIndex: number | null = null; // New state for editing
    remarks: string = '';
    dueDate: string = '';
    startDate: string = '';
    scheduledDate: string = '';
    priority: string = 'None';
    targetFile: string = '';
    previewRenderId: number = 0;
    clickTimeout: any = null; // Debounce for click vs dblclick
    filterStatus: string = 'active';
    activeKanbanStatus: string = 'todo'; // Default to todo
    private projectStatusOverrides: Map<string, string> = new Map();

    // View State
    currentViewType: 'list' | 'kanban' | 'quadrant' | 'week' | 'memo' = 'list';
    views: { [key: string]: TaskView } = {};

    constructor(app: App, plugin: FileTasksPlugin) {
        super(app);
        this.plugin = plugin;
        this.fileAccess = new FileAccess(app);

        // Defaults
        // If "Select First Project" setting is on, try to get the first one
        if (this.plugin.settings.defaultSelectFirstProject) {
            const projects = this.getProjects(); // This returns sorted list
            if (projects.length > 0) {
                this.targetFile = projects[0].path;
            } else {
                this.targetFile = this.plugin.settings.defaultTaskFile;
            }
        } else {
            this.targetFile = this.plugin.settings.defaultTaskFile;
        }

        // Apply Default View for the initially selected file immediately
        if (this.targetFile) {
            this.checkAndApplyDefaultView(this.targetFile);
        }
    }

    checkAndApplyDefaultView(path: string) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            const cache = this.app.metadataCache.getFileCache(file);
            const defaultView = cache?.frontmatter?.['defaultView'] || cache?.frontmatter?.['view'];
            if (defaultView && ['list', 'kanban', 'quadrant', 'week', 'memo'].includes(defaultView)) {
                this.currentViewType = defaultView;
            }
        }
    }

    onOpen() {
        const { contentEl } = this;
        this.modalEl.addClass('quick-add-modal-wrapper'); // Add class to parent modal for width control
        contentEl.addClass('quick-add-modal');
        contentEl.empty(); // Ensure clean slate

        // Header
        // contentEl.createEl('h2', { text: 'Quick Add Task' }); // Removed main header to save space, maybe put in sidebar?

        const container = contentEl.createDiv({ cls: 'quick-add-container' });

        // Render Sidebar (Left Column)
        this.renderSidebar(container);

        // Right Main Column (Wrapper for Preview + Properties)
        const mainCol = container.createDiv({ cls: 'quick-add-main-column' });

        // Render Task Preview (Top)
        this.renderTaskPreview(mainCol);

        // Render Content (Bottom)
        this.renderContent(mainCol);

        // Add Tab key listener for view switching
        // this.scope.register([], 'Tab', (evt) => {
        //     evt.preventDefault();
        //     this.switchToNextView();
        //     return false;
        // });
        // Global Click Listener for Resetting Selection
        this.contentEl.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            // If click is NOT in Preview Section AND NOT in Input Section
            // We assume it's a click on Sidebar or Background -> Reset State
            if (!target.closest('.quick-add-preview-section') && !target.closest('.quick-add-input-section')) {
                // Only reset if we actually have a state to reset, to avoid unnecessary re-renders/clearing
                if (this.editingLineIndex !== null || this.selectedParentLineIndex !== null) {
                    this.resetForm();
                }
            }
        });
    }

    // switchToNextView() {
    //     const views = ['list', 'kanban', 'quadrant', 'week'];
    //     const currentIndex = views.indexOf(this.currentViewType);
    //     const nextIndex = (currentIndex + 1) % views.length;
    //     this.currentViewType = views[nextIndex] as any;

    //     // Update UI
    //     this.updateTaskPreview();
    //     const tabsContainer = this.contentEl.querySelector('.task-view-tabs');
    //     if (tabsContainer) {
    //         tabsContainer.querySelectorAll('.task-view-tab').forEach((el, idx) => {
    //             el.removeClass('is-active');
    //             if (idx === nextIndex) {
    //                 el.addClass('is-active');
    //             }
    //         });
    //     }
    // }

    renderSidebar(container: HTMLElement, projectsOverride?: TFile[]) {
        const leftCol = container.createDiv({ cls: 'quick-add-left' });

        // Header / Title for sidebar
        const header = leftCol.createDiv({ cls: 'project-list-header' });
        header.setText('Projects');

        // Filter Dropdown
        const dropdown = new DropdownComponent(header);
        dropdown.selectEl.addClass('project-filter-dropdown-minimal');
        dropdown
            .addOptions({
                'active': 'Active',
                'paused': 'Paused',
                'archived': 'Archived',
                'all': 'All'
            })
            .setValue(this.filterStatus)
            .onChange((value) => {
                this.filterStatus = value;
                this.refreshSidebar();
            });

        const listContainer = leftCol.createDiv({ cls: 'project-list' });

        // 1. Default Inbox / Task File
        this.createProjectItem(listContainer, 'Inbox', this.plugin.settings.defaultTaskFile, true);

        // 2. Active Projects
        const projects = projectsOverride || this.getProjects();
        projects.forEach(file => {
            this.createProjectItem(listContainer, file.basename, file.path, false);
        });

        // 3. Create Project Button
        const btnWrapper = leftCol.createDiv({ cls: 'project-add-wrapper' });
        const addBtn = btnWrapper.createEl('button', { cls: 'project-add-btn' });
        setIcon(addBtn, 'plus');
        addBtn.createSpan({ text: ' New Project', style: 'margin-left: 5px;' });
        addBtn.onclick = () => {
            new CreateProjectModal(this.app, this.plugin, () => {
                this.refreshSidebar();
            }).open();
            // Don't close this modal
        };
    }

    refreshSidebar(projectsOverride?: TFile[]) {
        const container = this.contentEl.querySelector('.quick-add-container');
        if (container) {
            const leftCol = container.querySelector('.quick-add-left');
            if (leftCol) {
                leftCol.remove();
                this.renderSidebar(container as HTMLElement, projectsOverride);
                // renderSidebar appends to container, so it will be at the end.
                // We need to move it to the front.
                const newLeft = container.lastElementChild;
                if (newLeft) container.prepend(newLeft);
            }
        }
    }

    getProjects(): TFile[] {
        const files = this.app.vault.getMarkdownFiles();
        const taskDir = this.plugin.settings.taskDirectory;

        const projects = files.filter(file => {
            if (taskDir && taskDir !== '/' && !file.path.startsWith(taskDir)) {
                return false;
            }
            const cache = this.app.metadataCache.getFileCache(file);
            const isProject = cache?.frontmatter?.['project'] === true;

            if (!isProject) return false;

            if (this.filterStatus === 'all') return true;

            let status = cache?.frontmatter?.['status'] || 'active';

            // Check Persistent Override
            if (this.projectStatusOverrides.has(file.path)) {
                status = this.projectStatusOverrides.get(file.path)!;
            }

            return status === this.filterStatus;
        });

        return projects.sort((a, b) => {
            const cacheA = this.app.metadataCache.getFileCache(a);
            const cacheB = this.app.metadataCache.getFileCache(b);

            // Default to very high number if missing, so they go to bottom
            const valA = cacheA?.frontmatter?.['order'];
            const valB = cacheB?.frontmatter?.['order'];

            const orderA = (valA !== undefined && valA !== null) ? Number(valA) : 9999999999999;
            const orderB = (valB !== undefined && valB !== null) ? Number(valB) : 9999999999999;

            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return a.basename.localeCompare(b.basename);
        });
    }

    createProjectItem(container: HTMLElement, name: string, path: string, isDefault: boolean) {
        const item = container.createDiv({ cls: 'project-item' });

        // Make draggable if not Inbox (default)
        if (!isDefault) {
            item.draggable = true;
            item.dataset.path = path;

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer?.setData('text/plain', path);
                item.addClass('sortable-ghost');
            });

            item.addEventListener('dragend', () => {
                item.removeClass('sortable-ghost');
                container.querySelectorAll('.project-item').forEach(el => el.removeClass('sortable-drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault(); // Allow drop
                item.addClass('sortable-drag-over');
            });

            item.addEventListener('dragleave', (e) => {
                item.removeClass('sortable-drag-over');
            });


            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                item.removeClass('sortable-drag-over');
                const draggedPath = e.dataTransfer?.getData('text/plain');
                if (draggedPath && draggedPath !== path) {
                    await this.handleProjectReorder(draggedPath, path);
                }
            });
        }

        if (isDefault) {
            item.addClass('is-default');
        }

        if (this.targetFile === path) {
            item.addClass('is-active');
        }

        const label = item.createSpan({ text: name });

        item.onclick = () => {
            this.targetFile = path;
            container.querySelectorAll('.project-item').forEach(el => el.removeClass('is-active'));
            item.addClass('is-active');

            // View Switching Logic based on frontmatter
            this.checkAndApplyDefaultView(path);
            this.updateTabVisuals();

            this.updateTaskPreview();
        };

        if (!isDefault) {
            item.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                const menu = new Menu();

                menu.addItem((item) => {
                    item.setTitle('Rename Project')
                        .setIcon('pencil')
                        .onClick(() => {
                            const file = this.app.vault.getAbstractFileByPath(path);
                            if (file instanceof TFile) {
                                new RenameProjectModal(this.app, file, (newPath) => {
                                    if (this.targetFile === path) {
                                        this.targetFile = newPath;
                                    }
                                    // Update override map
                                    if (this.projectStatusOverrides.has(path)) {
                                        const status = this.projectStatusOverrides.get(path);
                                        this.projectStatusOverrides.delete(path);
                                        this.projectStatusOverrides.set(newPath, status!);
                                    }
                                    this.refreshSidebar();
                                }).open();
                            }
                        });
                });

                // Status Submenu
                menu.addItem((item) => {
                    item.setTitle('Change Status')
                        .setIcon('info')
                        .setSubmenu()
                        .addItem((sub) => sub.setTitle('Active').onClick(() => this.updateProjectStatus(path, 'active')))
                        .addItem((sub) => sub.setTitle('Paused').onClick(() => this.updateProjectStatus(path, 'paused')))
                        .addItem((sub) => sub.setTitle('Archived').onClick(() => this.updateProjectStatus(path, 'archived')));
                });

                // Default View Submenu
                menu.addItem((item) => {
                    item.setTitle('Default View')
                        .setIcon('layout')
                        .setSubmenu()
                        .addItem((sub) => sub.setTitle('List').onClick(() => this.updateProjectView(path, 'list')))
                        .addItem((sub) => sub.setTitle('Kanban').onClick(() => this.updateProjectView(path, 'kanban')))
                        .addItem((sub) => sub.setTitle('Quadrant').onClick(() => this.updateProjectView(path, 'quadrant')))
                        .addItem((sub) => sub.setTitle('Week').onClick(() => this.updateProjectView(path, 'week')));
                });

                menu.addSeparator();

                // Delete
                menu.addItem((item) => {
                    item.setTitle('Delete Project')
                        .setIcon('trash')
                        .setWarning(true)
                        .onClick(async () => {
                            const file = this.app.vault.getAbstractFileByPath(path);
                            if (file instanceof TFile) {
                                await this.app.vault.trash(file, true); // System trash
                                this.refreshSidebar();
                                // If deleted file was selected, select inbox
                                if (this.targetFile === path) {
                                    this.targetFile = this.plugin.settings.defaultTaskFile;
                                    this.updateTaskPreview();
                                }
                            }
                        });
                });

                menu.showAtMouseEvent(event);
            });
        }

        item.ondblclick = async () => {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                await this.app.workspace.getLeaf(false).openFile(file);
                this.close();
            }
        };
    }

    async handleProjectReorder(draggedPath: string, targetPath: string) {
        const projects = this.getProjects();
        const draggedFile = projects.find(p => p.path === draggedPath);
        const targetFile = projects.find(p => p.path === targetPath);

        if (!draggedFile || !targetFile) return;

        const draggedIndex = projects.indexOf(draggedFile);
        const targetIndex = projects.indexOf(targetFile);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Move item in array
        // If dragging from above to below, the target index shifts down by 1 after removal
        projects.splice(draggedIndex, 1);

        let insertIndex = targetIndex;
        if (draggedIndex < targetIndex) {
            insertIndex--;
        }

        projects.splice(insertIndex, 0, draggedFile);

        // Update Order for ALL projects to ensure consistency (0, 1, 2...)
        // This is robust against timestamp collisions or weird gaps.
        // We can optimize to only update affected range if needed, but for small lists, full update is safe.
        for (let i = 0; i < projects.length; i++) {
            const file = projects[i];
            // Use processFrontMatter to safely update
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                frontmatter['order'] = i;
            });
        }

        // Refresh Sidebar with IN-MEMORY order to avoid stale cache flicker
        this.refreshSidebar(projects);
        // Refresh Sidebar with IN-MEMORY order to avoid stale cache flicker
        this.refreshSidebar(projects);
    }

    async updateProjectStatus(path: string, status: string) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                fm['status'] = status;
            });
            new Notice(`Project status updated to ${status}`);

            // Update Persistent Override
            this.projectStatusOverrides.set(path, status);

            this.refreshSidebar();
        }
    }

    async updateProjectView(path: string, view: string) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                fm['defaultView'] = view;
            });
            new Notice(`Project default view set to ${view}`);
            // If it's the currently selected file, switch view immediately
            if (this.targetFile === path) {
                this.currentViewType = view as any;
                this.updateTabVisuals();
                this.updateTaskPreview();
            }
        }
    }

    renderTaskPreview(container: HTMLElement) {
        const previewCol = container.createDiv({ cls: 'quick-add-preview-section' });

        // Header Container
        const header = previewCol.createDiv({ cls: 'task-preview-header' });

        // Tabs
        let tabs = header.querySelector('.task-view-tabs') as HTMLElement;
        if (!tabs) {
            tabs = header.createDiv({ cls: 'task-view-tabs' });
            this.renderTabs(tabs);

            // Add Memo Button Separately (Wrapped in its own container style)
            const memoContainer = header.createDiv({ cls: 'task-view-tabs memo-tabs-container' });
            const memoBtn = memoContainer.createDiv({ cls: 'task-view-tab memo-tab-btn' });
            setIcon(memoBtn, 'sticky-note');
            memoBtn.createSpan({ text: 'Memo' });
            memoBtn.onclick = () => {
                this.currentViewType = 'memo';
                this.updateTabVisuals();
                this.updateTaskPreview();
                this.refreshInputSection();
            };
        } else {
            // Already exists, maybe update active state only?
            // But renderTabs clears and rebuilds. Let's fix renderTabs instead.
            // Actually the call site here is generating the structure.
            // The issue is likely `renderTabs` being called repeatedly or `taskPreviewContainer` rebuilds.
            // In `renderTaskPreview`, we are creating `previewCol`. 
            // If `renderTaskPreview` is called on every update, that's the problem.
            // `updateTaskPreview` CALLS `views[...].render()`. 
            // `renderTaskPreview` is called ONCE in `onOpen`.
            // Wait, `updateTabVisuals` manipulates classes.
            // The flicker might be because of `this.renderTabs(tabs)` rebuilding DOM?
            // No, `renderTabs` is only called here in `renderTaskPreview`.
            // Ah, `renderTaskPreview` might be getting called more than once?
            // No, `onOpen` calls it once.

            // User says: "when switching views, task-view-tabs jumps".
            // Switching views calls `updateTabVisuals` and `updateTaskPreview`.
            // `updateTaskPreview` calls `view.render()`.
            // If `view.render()` empties `taskPreviewContainer`...
            // `taskPreviewContainer` is separate from `tabs`.
            // `tabs` are in `header`, `taskPreviewContainer` is sibling.
            // So `view.render()` should NOT affect tabs.

            // UNLESS `styles.css` has some flex/layout dependency that changes when `taskPreviewContainer` content changes.
            // `task-preview-list` (container) -> `task-kanban-view` etc.

            // Let's assume the user meant "On FIRST open", it jumps. 
            // If `renderTabs` doesn't clear, it just appends.
            this.renderTabs(tabs);
        }

        // Title (Project Name) - moved to separate element or keep in header?
        // Let's keep it simply in header or just rely on tabs + content. 
        // Existing design had title in header.
        // We can put title on right or left. Current implementation puts tabs on left.

        // Items Container
        this.taskPreviewContainer = previewCol.createDiv({ cls: 'task-preview-list' });

        // Initialize Views
        this.views = {
            'list': new TaskListView(this.app, this, this.taskPreviewContainer),
            'kanban': new TaskKanbanView(this.app, this, this.taskPreviewContainer),
            'quadrant': new TaskQuadrantView(this.app, this, this.taskPreviewContainer),
            'week': new TaskWeeklyView(this.app, this, this.taskPreviewContainer),
            'memo': new TaskMemoView(this.app, this, this.taskPreviewContainer)
        };

        this.taskPreviewContainer.onclick = (e) => {
            // Handle background click to deselect if needed, but Views usually handle their own clicks.
            // We can keep the reset logic here if clicked on empty space.
            if (e.target === this.taskPreviewContainer) {
                this.selectedParentLineIndex = null;
                this.selectedParentTaskContent = null;
                if (this.editingLineIndex !== null) {
                    this.resetForm();
                } else {
                    this.refreshInputSection();
                    // We probably should re-render or just deselect visual
                    this.updateTaskPreview();
                }
            }
        };

        // Initial load
        this.updateTaskPreview();
    }

    renderTabs(container: HTMLElement) {
        container.empty();
        const views = [
            { id: 'list', icon: 'list', title: 'List' },
            { id: 'kanban', icon: 'columns', title: 'Kanban' },
            { id: 'quadrant', icon: 'grid', title: 'Quadrant' },
            { id: 'week', icon: 'calendar', title: 'Week' }
        ];

        views.forEach(v => {
            const tab = container.createDiv({ cls: 'task-view-tab' });
            setIcon(tab, v.icon);
            tab.createSpan({ text: v.title }); // Add Text

            if (this.currentViewType === v.id) {
                tab.addClass('is-active');
            }

            tab.onclick = () => {
                this.currentViewType = v.id as any;
                this.updateTaskPreview();
                this.updateTabVisuals();
                this.refreshInputSection();
            };
        });
    }

    updateTabVisuals() {
        // 1. Update Main Tabs
        const mainTabsContainer = this.contentEl.querySelector('.task-view-tabs');
        if (mainTabsContainer) {
            mainTabsContainer.querySelectorAll('.task-view-tab').forEach((tab: HTMLElement) => {
                // We need to match the tab to the view type. 
                // Since we didn't store ID on element easily, let's just rely on text or reconstruction.
                // Easier: In renderTabs, we assigned the click. 
                // But now we need to find which one corresponds to currentViewType.
                // Hack: check text content or store dataset.
                const title = tab.innerText;
                const viewId = title === 'List' ? 'list' :
                    title === 'Kanban' ? 'kanban' :
                        title === 'Quadrant' ? 'quadrant' :
                            title === 'Week' ? 'week' : null;

                if (viewId === this.currentViewType) {
                    tab.addClass('is-active');
                } else {
                    tab.removeClass('is-active');
                }
            });
        }

        // 2. Update Memo Button
        const header = this.contentEl.querySelector('.task-preview-header');
        if (header) {
            const memoBtn = header.querySelector('.memo-tab-btn');
            if (memoBtn) {
                if (this.currentViewType === 'memo') {
                    memoBtn.addClass('is-active');
                } else {
                    memoBtn.removeClass('is-active');
                }
            }
        }
    }

    async updateTaskPreview() {
        const previewSection = this.contentEl.querySelector('.quick-add-preview-section');
        if (!previewSection) return;

        // Update Title if we want to show it
        let header = previewSection.querySelector('.task-preview-header');
        // We could add title here if needed.

        // 2. Fetch and Parse
        if (!this.taskPreviewContainer) return;

        let file = this.app.vault.getAbstractFileByPath(this.targetFile);
        if (!file) {
            const files = this.app.vault.getMarkdownFiles();
            file = files.find(f => f.path === this.targetFile || f.basename === this.targetFile) || null;
        }

        if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            const lines = content.split('\n');
            const tasks: ViewTask[] = [];
            const stack: ViewTask[] = [];

            lines.forEach((line, index) => {
                if (line.match(/^\s*-\s\[.\]/)) {
                    const task = this.parseTaskLine(line, index);

                    // Stack Logic for Hierarchy
                    while (stack.length > 0 && stack[stack.length - 1].indent >= task.indent) {
                        stack.pop();
                    }

                    if (stack.length > 0) {
                        task.parentContent = stack[stack.length - 1].content;
                    }

                    stack.push(task);
                    tasks.push(task);
                }
            });

            // Render Current View
            const view = this.views[this.currentViewType];
            if (view) {
                view.render(tasks, file);
            }

        } else {
            this.taskPreviewContainer.empty();
            this.taskPreviewContainer.createDiv({ text: 'File not found.', style: 'color: var(--text-muted); padding: 10px;' });
        }
    }

    parseTaskLine(line: string, index: number): ViewTask {
        const match = line.match(/^(\s*-\s\[(.)\])\s(.*)$/);
        if (!match) return {
            line,
            lineNum: index,
            status: 'todo',
            content: line,
            indent: 0,
            originalLine: line
        };

        const prefix = match[1];
        const statusChar = match[2];
        let content = match[3];

        let status = 'todo';
        if (statusChar === 'x') status = 'done';
        else if (statusChar === '/') status = 'doing';

        // Indent
        const indentMatch = line.match(/^(\s*)/);
        const spaceCount = indentMatch && indentMatch[1] ? indentMatch[1].replace(/\t/g, '    ').length : 0;
        const indent = Math.floor(spaceCount / 2); // Assuming 2 spaces per indent

        // Metadata Parsing
        let priority = 'None';
        if (content.includes('🔺')) { priority = 'Highest'; content = content.replace('🔺', '').trim(); }
        else if (content.includes('⏫')) { priority = 'High'; content = content.replace('⏫', '').trim(); }
        else if (content.includes('🔼')) { priority = 'Medium'; content = content.replace('🔼', '').trim(); }
        else if (content.includes('🔽')) { priority = 'Low'; content = content.replace('🔽', '').trim(); }
        else if (content.includes('⏬')) { priority = 'Lowest'; content = content.replace('⏬', '').trim(); }

        const dueMatch = content.match(/📅\s(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?)/);
        const dueDate = dueMatch ? dueMatch[1] : undefined;
        if (dueMatch) content = content.replace(dueMatch[0], '').trim();

        const startMatch = content.match(/🛫\s(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?)/);
        const startDate = startMatch ? startMatch[1] : undefined;
        if (startMatch) content = content.replace(startMatch[0], '').trim();

        const scheduledMatch = content.match(/⏳\s(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?)/);
        const scheduledDate = scheduledMatch ? scheduledMatch[1] : undefined;
        if (scheduledMatch) content = content.replace(scheduledMatch[0], '').trim();

        // Cleaning Remarks
        const remarkMatch = content.match(/%%(.*?)%%/);
        let remarks = '';
        if (remarkMatch) {
            remarks = remarkMatch[1];
            content = content.replace(remarkMatch[0], '').trim();
        }

        return {
            line,
            lineNum: index,
            status,
            content,
            indent,
            priority,
            dueDate,
            startDate,
            scheduledDate,
            originalLine: line,
            remarks
        };
    }

    renderContent(container: HTMLElement) {
        if (this.currentViewType === 'memo') {
            this.renderMemoInput(container);
            return;
        }

        const inputSection = container.createDiv({ cls: 'quick-add-input-section' });

        // Parent Indicator
        if (this.selectedParentLineIndex !== null && this.selectedParentTaskContent) {
            const indicator = inputSection.createDiv({ cls: 'parent-task-indicator' });
            setIcon(indicator, 'corner-down-right');
            indicator.createSpan({ text: this.selectedParentTaskContent });

            // Close button
            const closeBtn = indicator.createDiv({ cls: 'parent-task-indicator-close' });
            setIcon(closeBtn, 'x');
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.selectedParentLineIndex = null;
                this.selectedParentTaskContent = null;
                this.refreshInputSection();
            };
        }

        // Horizontal Split: Left (Vertical Content) + Right (Button)
        const horizontalSplit = inputSection.createDiv({ cls: 'quick-add-horizontal-split' });

        // Left: Vertical Content Container
        const verticalContent = horizontalSplit.createDiv({ cls: 'quick-add-vertical-content' });

        // 1. Properties
        if (this.selectedParentLineIndex === null) {
            const propsContainer = verticalContent.createDiv({ cls: 'quick-add-properties' });

            this.createPropertyInput(propsContainer, 'Priority 🚩', (el) => {
                new Setting(el).addDropdown(drop => drop.addOption('Highest', 'Highest 🔺').addOption('High', 'High ⏫').addOption('Medium', 'Medium 🔼').addOption('None', 'None').addOption('Low', 'Low 🔽').addOption('Lowest', 'Lowest ⏬').setValue(this.priority).onChange(val => this.priority = val));
            });

            this.createPropertyInput(propsContainer, 'Scheduled ⏳', (el) => {
                new Setting(el).addText(text => { text.inputEl.type = 'datetime-local'; text.setValue(this.toInputFormat(this.scheduledDate)); text.onChange(val => this.scheduledDate = this.fromInputFormat(val)); });
            });

            this.createPropertyInput(propsContainer, 'Start Date 🛫', (el) => {
                new Setting(el).addText(text => { text.inputEl.type = 'datetime-local'; text.setValue(this.toInputFormat(this.startDate)); text.onChange(val => this.startDate = this.fromInputFormat(val)); });
            });

            this.createPropertyInput(propsContainer, 'Due Date 📅', (el) => {
                new Setting(el).addText(text => { text.inputEl.type = 'datetime-local'; text.setValue(this.toInputFormat(this.dueDate)); text.onChange(val => this.dueDate = this.fromInputFormat(val)); });
            });
        }

        // 2. Input Row: Description + Remarks
        const inputRow = verticalContent.createDiv({ cls: 'quick-add-input-row' });

        // Description
        const textWrapper = inputRow.createDiv({ cls: 'quick-add-textarea-wrapper' });
        const descriptionInput = textWrapper.createEl('input', { cls: 'quick-add-description-input', type: 'text' });
        descriptionInput.placeholder = 'Describe your task...';
        descriptionInput.value = this.description;
        descriptionInput.oninput = (e: any) => this.description = e.target.value;
        descriptionInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submit();
            }
        };
        setTimeout(() => descriptionInput.focus(), 50);

        // Remarks
        const remarksWrapper = inputRow.createDiv({ cls: 'quick-add-remarks-wrapper' });
        const remarksInput = remarksWrapper.createEl('input', { cls: 'quick-add-remarks-input', type: 'text' });
        remarksInput.placeholder = 'Remarks...';
        remarksInput.value = this.remarks;
        remarksInput.oninput = (e: any) => this.remarks = e.target.value;
        remarksInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submit();
            }
        };

        // Right: Button
        const footer = horizontalSplit.createDiv({ cls: 'quick-add-footer' });
        const submitBtn = footer.createEl('button', {
            text: this.editingLineIndex !== null ? 'Update' : 'Add',
            cls: 'mod-cta'
        });
        submitBtn.onclick = async () => await this.submit();
    }

    updateSelectionVisuals() {
        // Local DOM update for performance (avoids full re-render & scroll reset)
        const items = this.contentEl.querySelectorAll('.task-item');
        items.forEach(el => {
            const domItem = el as HTMLElement;
            const lineStr = domItem.dataset.line;
            if (!lineStr) return;
            const line = parseInt(lineStr);

            if (this.selectedParentLineIndex === line) {
                domItem.addClass('is-selected');
            } else {
                domItem.removeClass('is-selected');
            }

            if (this.editingLineIndex === line) {
                domItem.addClass('is-editing');
            } else {
                domItem.removeClass('is-editing');
                domItem.style.backgroundColor = ''; // Clear inline if any remains
            }
        });
    }

    refreshInputSection() {
        const mainCol = this.contentEl.querySelector('.quick-add-main-column') as HTMLElement;
        if (mainCol) {
            mainCol.querySelectorAll('.quick-add-input-section').forEach(el => el.remove());

            if (this.currentViewType === 'memo') {
                this.renderMemoInput(mainCol);
            } else {
                this.renderContent(mainCol);
            }
        }
        // Optimize: Use local visual update instead of full render
        this.updateSelectionVisuals();
    }

    renderMemoInput(container: HTMLElement) {
        const inputSection = container.createDiv({ cls: 'quick-add-input-section' });

        // Use a simpler layout for Memo: Just a text area and a button in a row
        const inputRow = inputSection.createDiv({ cls: 'quick-add-input-row' });

        // Textarea Wrapper
        const textWrapper = inputRow.createDiv({ cls: 'quick-add-textarea-wrapper' });

        // Use Textarea for multi-line input
        const memoInput = textWrapper.createEl('textarea', { cls: 'quick-add-description-input memo-textarea' });
        memoInput.placeholder = 'Type your memo...';
        memoInput.value = this.description;
        memoInput.oninput = (e: any) => this.description = e.target.value;
        memoInput.onkeydown = (e) => {
            // Allow Shift+Enter for new line, Enter to submit
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitMemo();
            }
        };
        setTimeout(() => memoInput.focus(), 50);

        // Submit Button (Right Side)
        const footer = inputRow.createDiv({ cls: 'quick-add-footer memo-button-container' });
        const submitBtn = footer.createEl('button', {
            text: 'Add Memo',
            cls: 'mod-cta'
        });
        submitBtn.onclick = async () => await this.submitMemo();
    }

    async submitMemo() {
        if (!this.description) {
            new Notice('Memo content is required.');
            return;
        }

        const file = this.app.vault.getAbstractFileByPath(this.targetFile);
        if (!(file instanceof TFile)) {
            new Notice('Target file not found.');
            return;
        }

        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        const memoLine = `- [${timestamp}] ${this.description}`;

        // We need to append this to the file, specifically after "# Memo" header.
        await this.fileAccess.appendMemo(file, memoLine);

        // Clear and Refresh
        this.description = '';
        this.refreshInputSection();
        this.updateTaskPreview();
    }

    setActiveKanbanStatus(status: string) {
        this.activeKanbanStatus = status;
    }

    focusInput() {
        const input = this.contentEl.querySelector('.quick-add-description-input') as HTMLElement;
        if (input) input.focus();
    }

    resetForm() {
        this.editingLineIndex = null;
        this.description = '';
        this.remarks = '';
        this.priority = 'None';
        this.dueDate = '';
        this.startDate = '';
        this.scheduledDate = '';
        // Re-render
        this.refreshInputSection();
    }

    loadTaskForEditing(line: string, lineIndex: number) {
        this.editingLineIndex = lineIndex;

        // 1. Parse Status & Description
        const statusMatch = line.match(/^(\s*-\s\[.\])\s(.*)$/);
        let content = line;

        if (statusMatch) {
            content = statusMatch[2];
        }

        // 2. Parse Remarks %%...%%
        const remarkMatch = content.match(/%%(.*?)%%/);
        if (remarkMatch) {
            this.remarks = remarkMatch[1];
            content = content.replace(remarkMatch[0], '').trim();
        } else {
            this.remarks = '';
        }

        // 3. Parse Metadata
        if (content.includes('🔺')) { this.priority = 'Highest'; content = content.replace('🔺', '').trim(); }
        else if (content.includes('⏫')) { this.priority = 'High'; content = content.replace('⏫', '').trim(); }
        else if (content.includes('🔼')) { this.priority = 'Medium'; content = content.replace('🔼', '').trim(); }
        else if (content.includes('🔽')) { this.priority = 'Low'; content = content.replace('🔽', '').trim(); }
        else if (content.includes('⏬')) { this.priority = 'Lowest'; content = content.replace('⏬', '').trim(); }
        else { this.priority = 'None'; }

        const dueMatch = content.match(/📅\s(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?)/);
        this.dueDate = dueMatch ? dueMatch[1].replace('T', ' ') : '';
        if (dueMatch) content = content.replace(dueMatch[0], '').trim();

        const startMatch = content.match(/🛫\s(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?)/);
        this.startDate = startMatch ? startMatch[1].replace('T', ' ') : '';
        if (startMatch) content = content.replace(startMatch[0], '').trim();

        const scheduledMatch = content.match(/⏳\s(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?)/);
        this.scheduledDate = scheduledMatch ? scheduledMatch[1].replace('T', ' ') : '';
        if (scheduledMatch) content = content.replace(scheduledMatch[0], '').trim();

        this.description = content;

        // Re-render Form
        this.refreshInputSection();
    }

    createPropertyInput(container: HTMLElement, label: string, renderInput: (el: HTMLElement) => void) {
        const group = container.createDiv({ cls: 'property-input-group' });

        // Extract Icon (last char usually)
        const parts = label.trim().split(' ');
        const icon = parts.length > 1 ? parts[parts.length - 1] : label.substring(0, 1);

        const labelEl = group.createDiv({ cls: 'property-label', text: icon });
        labelEl.setAttribute('title', label); // Tooltip on label itself

        const inputContainer = group.createDiv({ cls: 'property-input-wrapper' });
        renderInput(inputContainer);
    }


    async submit() {
        if (!this.description) {
            new Notice('Task description is required.');
            return;
        }

        let taskLine = '';
        if (this.editingLineIndex !== null) {
            // Update Existing
            const file = this.app.vault.getAbstractFileByPath(this.targetFile) as TFile;
            if (file) {
                const content = await this.app.vault.read(file);
                const lines = content.split('\n');
                const originalLine = lines[this.editingLineIndex];
                const match = originalLine.match(/^(\s*-\s\[.\])/);
                const prefix = match ? match[1] : '- [ ]';
                taskLine = `${prefix} ${this.description}`;
            } else {
                taskLine = `- [ ] ${this.description}`;
            }
        } else {
            // Check activeKanbanStatus if just adding new (and maybe if we want to enforce it on edit? usually adding)
            // But user might be in List view where this doesn't matter much, defaulting to Todo is fine.
            // If we are in Kanban view, we might want to respect the column?
            // The Logic: If user clicked "Add" on a column, activeKanbanStatus is set.
            // If they just opened modal, it defaults to 'todo'.

            let prefix = '- [ ]';
            if (this.currentViewType === 'kanban') {
                if (this.activeKanbanStatus === 'doing') prefix = '- [/]';
                else if (this.activeKanbanStatus === 'done') prefix = '- [x]';
            }

            taskLine = `${prefix} ${this.description}`;
        }

        // Append Remarks
        if (this.remarks) {
            taskLine += ` %%${this.remarks}%%`;
        }

        // Append Metadata
        if (this.selectedParentLineIndex === null) {
            // Append Metadata only for root tasks
            if (this.priority === 'Highest') taskLine += ' 🔺';
            if (this.priority === 'High') taskLine += ' ⏫';
            if (this.priority === 'Medium') taskLine += ' 🔼';
            if (this.priority === 'Low') taskLine += ' 🔽';
            if (this.priority === 'Lowest') taskLine += ' ⏬';

            if (this.dueDate) taskLine += ` 📅 ${this.dueDate}`;
            if (this.startDate) taskLine += ` 🛫 ${this.startDate}`;
            if (this.scheduledDate) taskLine += ` ⏳ ${this.scheduledDate}`;
        }

        // Find File
        let file = this.app.vault.getAbstractFileByPath(this.targetFile);

        if (!file) {
            const files = this.app.vault.getMarkdownFiles();
            file = files.find(f => f.path === this.targetFile || f.basename === this.targetFile) || null;
        }

        if (file instanceof TFile) {
            if (this.editingLineIndex !== null) {
                // Update Existing
                await this.fileAccess.replaceTask(file, this.editingLineIndex, taskLine);
                new Notice(`Task updated.`);
                this.resetForm();
                await this.updateTaskPreview();
            } else {
                // Insert New
                if (this.selectedParentLineIndex !== null) {
                    // Insert as Subtask
                    const content = await this.app.vault.read(file);
                    const lines = content.split('\n');

                    if (lines.length > this.selectedParentLineIndex) {
                        const parentLine = lines[this.selectedParentLineIndex];
                        // Calculate parent indentation
                        const match = parentLine.match(/^(\s*)/);
                        const parentIndentStr = match ? match[1] : '';

                        // New task indentation: parent + 1 tab (or 4 spaces, or 2 spaces)
                        // Robust: detect indentation unit. Default to '\t' or '    '.
                        const indentUnit = parentIndentStr.includes('\t') ? '\t' : '    ';
                        const newTaskLine = `${parentIndentStr}${indentUnit}${taskLine.trim()}`;

                        // Find Insertion Point: After parent and all its current subtasks
                        let insertIndex = this.selectedParentLineIndex + 1;
                        while (insertIndex < lines.length) {
                            const nextLine = lines[insertIndex];
                            const nextMatch = nextLine.match(/^(\s*)/);
                            const nextIndentStr = nextMatch ? nextMatch[1] : '';

                            // If next line is indented MORE than parent, it's a child. Skip it.
                            // But we must compare length of indent string
                            if (nextIndentStr.length > parentIndentStr.length && nextIndentStr.startsWith(parentIndentStr)) {
                                insertIndex++;
                            } else {
                                break;
                            }
                        }

                        await this.fileAccess.insertTaskAtIndex(file, insertIndex, newTaskLine);
                    } else {
                        // Fallback append if index invalid
                        await this.fileAccess.appendTask(file, taskLine);
                    }
                } else {
                    // Check for # Memo to insert BEFORE
                    const content = await this.app.vault.read(file);
                    const lines = content.split('\n');
                    let memoLineIndex = -1;
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].trim() === '# Memo') {
                            memoLineIndex = i;
                            break;
                        }
                    }

                    if (memoLineIndex !== -1) {
                        lines.splice(memoLineIndex, 0, taskLine);
                        await this.app.vault.modify(file, lines.join('\n'));
                    } else {
                        await this.fileAccess.appendTask(file, taskLine);
                    }
                }

                if (this.plugin.settings.closeWindowOnTaskAdd) {
                    this.close();
                } else {
                    // Clear fields for next entry
                    this.description = '';
                    this.remarks = '';
                    // Optional: Clear other fields or keep them? Usually date/priority might stay same. 
                    // Let's clear basics.

                    // Update UI inputs
                    const descInput = this.contentEl.querySelector('.quick-add-description-input') as HTMLInputElement;
                    if (descInput) {
                        descInput.value = '';
                        descInput.focus();
                    }

                    const remarksInput = this.contentEl.querySelector('.quick-add-remarks-input') as HTMLInputElement;
                    if (remarksInput) remarksInput.value = '';

                    // Refresh Preview
                    await this.updateTaskPreview();
                }
            }
        } else {
            new Notice(`File Not Found: ${this.targetFile}`);
        }
    }

    toInputFormat(val: string): string {
        if (!val) return '';
        if (val.includes('T')) return val;
        // If it has space (YYYY-MM-DD HH:mm), replace with T
        if (val.includes(' ')) return val.replace(' ', 'T');
        // If it's date only (YYYY-MM-DD), append T00:00 so it shows in datetime-local input
        if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return `${val}T00:00`;
        return val;
    }

    fromInputFormat(val: string): string {
        if (!val) return '';
        // If it ends in T00:00, maybe revert to date only? 
        // For now, respect user input. If they picked 00:00, it's 00:00.
        // Convert T back to space for storage
        return val.replace('T', ' ');
    }

    async handleRecursiveTaskToggle(file: TFile, allLines: string[], targetLineIndex: number, newStatus: boolean) {
        // 1. Build Tree
        const nodes: TaskNode[] = [];
        const lineToNodeMap = new Map<number, TaskNode>();

        allLines.forEach((line, index) => {
            if (line.match(/^\s*-\s\[.\]/)) {
                const match = line.match(/^(\s*)/);
                const spaceCount = match && match[1] ? match[1].replace(/\t/g, '    ').length : 0;
                const indent = Math.floor(spaceCount / 2);
                const isChecked = !!line.match(/^\s*-\s\[x\]/i);

                const node: TaskNode = {
                    lineNum: index,
                    indent: indent,
                    status: isChecked,
                    children: [],
                    parent: null
                };
                nodes.push(node);
                lineToNodeMap.set(index, node);
            }
        });

        // Link Parents
        const stack: TaskNode[] = []; // Stack to track parents at each level
        nodes.forEach(node => {
            // Pop stack until we find the parent (indent less than current)
            while (stack.length > 0 && stack[stack.length - 1].indent >= node.indent) {
                stack.pop();
            }

            if (stack.length > 0) {
                const parent = stack[stack.length - 1];
                parent.children.push(node);
                node.parent = parent;
            }

            stack.push(node);
        });

        // 2. Identify Target & Apply Logic
        const targetNode = lineToNodeMap.get(targetLineIndex);
        if (!targetNode) return;

        const updates = new Map<number, boolean>(); // lineNum -> newStatus

        // Helper to schedule update
        const setStatus = (node: TaskNode, status: boolean) => {
            if (node.status !== status || updates.has(node.lineNum)) {
                updates.set(node.lineNum, status);
                node.status = status; // Update in-memory for upward propagation
            }
        };

        // A. Update Target
        setStatus(targetNode, newStatus);

        // B. Downward Cascade (Update all descendants)
        const updateChildren = (node: TaskNode, status: boolean) => {
            node.children.forEach(child => {
                setStatus(child, status);
                updateChildren(child, status);
            });
        };
        updateChildren(targetNode, newStatus);

        // C. Upward Cascade (Check siblings to update parent)
        let current = targetNode.parent;
        while (current) {
            const allChildrenChecked = current.children.every(c => c.status);
            // If all children are checked, parent should be checked
            // If any child is unchecked, parent should be unchecked
            // (Assuming complete sync. If user explicitly unchecks parent, it unchecks all. 
            //  If user explicitly checks parent, it checks all.
            //  Here we are reacting to a child change.)

            const shouldBeChecked = allChildrenChecked;

            if (current.status !== shouldBeChecked) {
                setStatus(current, shouldBeChecked);
                current = current.parent;
            } else {
                break; // No change needed for parent, stop propagation
            }
        }

        // 3. Execute Updates
        const updateList = Array.from(updates.entries()).map(([lineNum, status]) => ({
            lineNumber: lineNum,
            status: status
        }));

        if (updateList.length > 0) {
            await this.fileAccess.updateTaskStatuses(file, updateList);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

interface TaskNode {
    lineNum: number;
    indent: number;
    status: boolean;
    children: TaskNode[];
    parent: TaskNode | null;
}
