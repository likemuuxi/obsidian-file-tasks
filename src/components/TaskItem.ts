import { setIcon, TFile, MarkdownRenderer, moment } from 'obsidian';
import { ViewTask } from '../views/BaseTaskView';
import { QuickAddModal } from '../modals/QuickAddModal';
import { DateUtils } from '../utils/DateUtils';


export interface TaskItemOptions {
    showIndent?: boolean;
    showCheckbox?: boolean;
    checkboxForChildren?: boolean; // If true, forces showCheckbox=true for children
    showPriority?: boolean;
    showDates?: boolean;
    className?: string;
    draggable?: boolean;
}

export class TaskItem {
    constructor(
        private task: ViewTask,
        private modal: QuickAddModal,
        private file: TFile,
        private options: TaskItemOptions = {
            showIndent: true,
            showCheckbox: true,
            showPriority: true, // Default true
            showDates: true,    // Default true
            draggable: true
        }
    ) { }

    render(container: HTMLElement) {
        const item = container.createDiv({ cls: 'preview-task-item task-item' });

        if (this.options.className) {
            item.addClass(this.options.className);
        }

        // Set line number for selection logic
        item.dataset.line = this.task.lineNum.toString();

        // Draggable
        if (this.options.draggable) {
            item.draggable = true;

            item.ondragstart = (e) => {
                if (e.dataTransfer) {
                    e.dataTransfer.setData('text/plain', this.task.lineNum.toString());
                    e.dataTransfer.effectAllowed = 'move';
                }
            };

            item.ondragover = (e) => {
                e.preventDefault(); // Allow drop
                e.stopPropagation();

                const rect = item.getBoundingClientRect();
                const y = e.clientY - rect.top;

                item.removeClass('drag-over-top', 'drag-over-bottom', 'drag-over-child');

                if (y < rect.height * 0.25) {
                    item.addClass('drag-over-top');
                } else if (y > rect.height * 0.75) {
                    item.addClass('drag-over-bottom');
                } else {
                    item.addClass('drag-over-child');
                }

                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            };

            item.ondragleave = (e) => {
                e.preventDefault();
                e.stopPropagation();
                item.removeClass('drag-over-top', 'drag-over-bottom', 'drag-over-child');
            };

            item.ondrop = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                item.removeClass('drag-over-top', 'drag-over-bottom', 'drag-over-child');

                if (e.dataTransfer) {
                    const sourceLineStr = e.dataTransfer.getData('text/plain');
                    if (sourceLineStr) {
                        const sourceLine = parseInt(sourceLineStr);
                        const targetLine = this.task.lineNum;

                        if (sourceLine === targetLine) return;

                        let action: 'above' | 'below' | 'child' = 'child';
                        const rect = item.getBoundingClientRect();
                        const y = e.clientY - rect.top;

                        if (y < rect.height * 0.25) action = 'above';
                        else if (y > rect.height * 0.75) action = 'below';

                        if (action) {
                            // Check for Status Change Context (e.g. Kanban Column)
                            const statusContainer = item.closest('[data-status]') as HTMLElement;
                            const newStatus = statusContainer ? statusContainer.dataset.status : undefined;

                            await this.modal.fileAccess.moveTaskBlock(this.file, sourceLine, this.task.lineNum, action, newStatus);
                            await this.modal.updateTaskPreview();
                        }
                    }
                }
            };
        }

        // Indentation
        // If showIndent is true, we use absolute indentation (good for flat lists).
        // If we are using recursive nesting (which we are now moving to), we rely on container padding.
        // However, correct handling for 'Root' items that start deeply indented (e.g. orphan subtasks in filtered views):
        // They should probably retain their absolute indent?
        // But if we nest, we want relative.
        // Simple heuristic: 
        // If showIndent is true, apply margin.
        // For recursive children, we pass showIndent: false.
        // This works for:
        // - Roots (showIndent: true) -> Get absolute margin.
        // - Children (showIndent: false) -> Get 0 margin, but rely on parent container padding.
        // Perfect.
        if (this.options.showIndent !== false && this.task.indent > 0) {
            // Wait, if it's a Root in a filtered list (e.g. Child became root), and has indent 1.
            // visual: Indent 20px.
            // render children (indent 2) inside it with showIndent: false.
            // container padding 20px.
            // Grandchild visual: 20px + 20px = 40px. Correct (matching indent 2).
            item.style.marginLeft = `${this.task.indent * 20}px`;
            // item.style.borderLeft = '1px solid var(--background-modifier-border)'; // This might look weird if we have recursive guide lines too. Let's keep it minimal for now.
            // item.style.paddingLeft = '8px'; // Remove padding left if we are nesting
        }

        // Selection & Editing States
        if (this.modal.selectedParentLineIndex === this.task.lineNum) {
            item.addClass('is-selected');
        }

        if (this.modal.editingLineIndex === this.task.lineNum) {
            item.addClass('is-editing');
            item.style.backgroundColor = 'var(--background-modifier-active-hover)';
        }

        // Click Handlers
        item.onclick = (e) => {
            e.stopPropagation();
            this.modal.editingLineIndex = null;
            // Clear parent selection when editing a task
            this.modal.selectedParentLineIndex = null;
            this.modal.selectedParentTaskContent = null;
            this.modal.loadTaskForEditing(this.task.originalLine, this.task.lineNum);
        };

        const row = item.createDiv({ cls: 'preview-task-row' });
        row.style.position = 'relative';
        row.style.paddingLeft = '16px'; // Reduced gutter (Overall left shift)

        // Checkbox
        if (this.options.showCheckbox !== false) {
        }

        // Checkbox / Status Icon
        if (this.options.showCheckbox !== false) {
            const checkbox = row.createDiv({ cls: 'preview-task-checkbox' });
            if (this.task.status === 'done') {
                // Show checkmark icon for completed tasks
                checkbox.addClass('is-checked');
                checkbox.setText('✔');
                checkbox.style.fontSize = '10px';
                checkbox.style.textAlign = 'center';
                checkbox.style.lineHeight = '12px';
            } else if (this.task.status === 'doing') {
                checkbox.addClass('is-doing');
                checkbox.setText('/');
                checkbox.style.fontSize = '10px';
                checkbox.style.textAlign = 'center';
                checkbox.style.lineHeight = '12px';
            }

            checkbox.onclick = async (e) => {
                e.stopPropagation();
                await this.modal.fileAccess.toggleTaskStatus(
                    this.file,
                    this.task.lineNum,
                    this.task.status,
                    true, // autoCheck
                    this.modal.plugin.settings.autoDateManagement // autoDate
                );
                await this.modal.updateTaskPreview();
            };
        }

        // Content Wrapper
        const contentWrapper = row.createDiv({ cls: 'preview-task-content-wrapper' });

        const contentSpan = contentWrapper.createSpan({ cls: 'preview-task-content' });
        MarkdownRenderer.render(this.modal.app, this.task.content, contentSpan, this.file.path, this.modal);

        // Priority Icon
        if (this.options.showPriority !== false && this.task.priority && this.task.priority !== 'None') {
            const prioritySpan = contentWrapper.createSpan({ cls: 'task-priority-icon' });
            switch (this.task.priority) {
                case 'Highest': prioritySpan.setText(' 🔺'); break;
                case 'High': prioritySpan.setText(' ⏫'); break;
                case 'Medium': prioritySpan.setText(' 🔼'); break;
                case 'Low': prioritySpan.setText(' 🔽'); break;
                case 'Lowest': prioritySpan.setText(' ⏬'); break;
            }
            prioritySpan.style.marginRight = '5px';
        }

        // Metadata Icons (Dates)
        if (this.options.showDates !== false) {
            const metaSpan = contentWrapper.createSpan({ cls: 'task-metadata', style: 'margin-left: 8px; font-size: 0.8em; color: var(--text-muted);' });
            // Unified Relative Format Handler
            const formatRelativeDate = DateUtils.formatRelativeDate;

            if (this.task.createdDate) {
                const span = metaSpan.createSpan({ cls: 'task-date created-date' });
                span.setText(`➕ ${formatRelativeDate(this.task.createdDate)} `);
            }
            if (this.task.completedDate) {
                const span = metaSpan.createSpan({ cls: 'task-date completed-date' });
                span.setText(`✅ ${formatRelativeDate(this.task.completedDate)} `);
                span.style.textDecoration = 'none';
            }
            if (this.task.cancelledDate) {
                const span = metaSpan.createSpan({ cls: 'task-date cancelled-date' });
                span.setText(`❌ ${formatRelativeDate(this.task.cancelledDate)} `);
            }
            if (this.task.dueDate) {
                const span = metaSpan.createSpan({ cls: 'task-date due-date' });
                span.setText(`📅 ${formatRelativeDate(this.task.dueDate)} `);
            }
            if (this.task.scheduledDate) {
                const span = metaSpan.createSpan({ cls: 'task-date scheduled-date' });
                span.setText(`⏳ ${formatRelativeDate(this.task.scheduledDate)} `);
            }
            if (this.task.startDate) {
                const span = metaSpan.createSpan({ cls: 'task-date start-date' });
                span.setText(`🛫 ${formatRelativeDate(this.task.startDate)} `);
            }
        }

        // Remarks (Rendered before metadata to appear above dates)
        if (this.task.remarks) {
            contentWrapper.createDiv({ cls: 'preview-task-remark', text: this.task.remarks, style: 'margin-top: 4px; color: var(--text-muted); font-size: 0.9em;' });
        }

        // Actions Button Container
        const actionsContainer = row.createDiv({ cls: 'task-actions' });

        // Select Parent Button
        const selectParentBtn = actionsContainer.createDiv({ cls: 'task-action-btn select-parent-btn' });
        setIcon(selectParentBtn, 'corner-down-right'); // Icon indicating 'Step Into' / 'Child'
        selectParentBtn.title = 'Add Subtask (Select as Parent)';
        selectParentBtn.onclick = async (e) => {
            e.stopPropagation();
            this.modal.editingLineIndex = null;
            this.modal.description = '';
            this.modal.remarks = '';
            this.modal.priority = 'None';
            this.modal.dueDate = '';
            this.modal.startDate = '';
            this.modal.scheduledDate = '';

            this.modal.selectedParentLineIndex = this.task.lineNum;
            this.modal.selectedParentTaskContent = this.task.content;
            this.modal.refreshInputSection();
        };

        // Menu Wrapper
        const menuWrapper = actionsContainer.createDiv({ cls: 'task-menu-wrapper' });

        // Menu Trigger (Three Dots)
        const menuTrigger = menuWrapper.createDiv({ cls: 'task-action-btn menu-trigger-btn' });
        setIcon(menuTrigger, 'more-horizontal');

        // Menu Content (Hidden by default, shown on hover)
        const menuContent = menuWrapper.createDiv({ cls: 'task-menu-content' });

        // Archive Button
        const archiveBtn = menuContent.createDiv({ cls: 'task-action-btn archive-btn' });
        setIcon(archiveBtn, 'archive-x');
        archiveBtn.title = 'Archive (Strikethrough)';
        archiveBtn.onclick = async (e) => {
            e.stopPropagation();
            await this.modal.fileAccess.toggleTaskStrikethrough(
                this.file,
                this.task.lineNum,
                this.modal.plugin.settings.autoDateManagement // autoDate
            );
            await this.modal.updateTaskPreview();
        };

        // Delete Button
        const deleteBtn = menuContent.createDiv({ cls: 'task-action-btn delete-btn' });
        setIcon(deleteBtn, 'trash-2');
        deleteBtn.title = 'Delete Task';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm('Delete this task?')) {
                await this.modal.fileAccess.deleteTaskBlock(this.file, this.task.lineNum);
                await this.modal.updateTaskPreview();
            }
        };

        // Children (Recursive)
        if (this.task.children && this.task.children.length > 0) {
            const childrenContainer = container.createDiv({ cls: 'task-children-container' });

            // Add Fold/Expand Button to the PARENT item
            // Position absolute in the gutter

            const toggleBtn = row.createSpan({ cls: 'task-fold-btn' });
            setIcon(toggleBtn, 'chevron-down');
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.style.position = 'absolute';
            toggleBtn.style.left = '-6px'; // Align in gutter
            toggleBtn.style.fontSize = '0.8em';
            toggleBtn.style.opacity = '0.7';

            // Insert at beginning (logic remains same, but position is absolute)
            if (row.firstChild) {
                row.insertBefore(toggleBtn, row.firstChild);
            } else {
                row.appendChild(toggleBtn);
            }

            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                if (childrenContainer.style.display === 'none') {
                    childrenContainer.style.display = 'block';
                    setIcon(toggleBtn, 'chevron-down');
                } else {
                    childrenContainer.style.display = 'none';
                    setIcon(toggleBtn, 'chevron-right');
                }
            };

            this.task.children.forEach(child => {
                const nextOptions = { ...this.options };

                // If enabled, force checkox for children
                if (this.options.checkboxForChildren) {
                    nextOptions.showCheckbox = true;
                }

                new TaskItem(child, this.modal, this.file, {
                    ...nextOptions,
                    showIndent: false
                }).render(childrenContainer);
            });
            childrenContainer.style.marginLeft = '18px'; // Shift right to center under icon
            childrenContainer.style.paddingLeft = '8px'; // Remaining indent
            childrenContainer.style.borderLeft = '1px solid var(--background-modifier-border-hover)'; // Guide line
        }
    }
}
