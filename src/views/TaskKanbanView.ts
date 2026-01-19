import { TFile, setIcon } from 'obsidian';
import { TaskView, ViewTask } from './BaseTaskView';
import { TaskItem } from '../components/TaskItem';
import { TaskTreeUtils } from '../utils/TaskTreeUtils';

export class TaskKanbanView extends TaskView {

    render(tasks: ViewTask[], file: TFile) {
        this.clear();
        this.container.addClass('task-kanban-view');

        const columns = [
            { id: 'todo', title: 'To Do', status: 'todo' },
            { id: 'doing', title: 'Doing', status: 'doing' },
            { id: 'done', title: 'Done', status: 'done' }
        ];

        const board = this.container.createDiv({ cls: 'kanban-board' });

        columns.forEach(col => {
            const colDiv = board.createDiv({ cls: 'kanban-column' });
            // Header
            const header = colDiv.createDiv({ cls: 'kanban-column-header', text: col.title });

            // Click Header to Select
            header.onclick = (e) => {
                e.stopPropagation();
                // 1. Highlight UI
                this.highlightColumn(col.status);
                // 2. Set Logic
                this.modal.setActiveKanbanStatus(col.status);
                // 3. Focus Input
                this.modal.focusInput();
            };

            const listDiv = colDiv.createDiv({ cls: 'kanban-column-list' });
            listDiv.dataset.status = col.status;

            // Allow dropping on empty list
            listDiv.ondragover = (e) => {
                e.preventDefault();
                listDiv.addClass('drag-over');
            };
            listDiv.ondragleave = (e) => {
                const related = e.relatedTarget as Node;
                if (listDiv.contains(related)) return;
                listDiv.removeClass('drag-over');
            };
            listDiv.ondrop = async (e) => {
                // Only handle if NOT dropped on a task item (which stops propagation)
                e.stopPropagation();
                listDiv.removeClass('drag-over');

                const sourceLineStr = e.dataTransfer?.getData('text/plain');
                if (sourceLineStr) {
                    const sourceLine = parseInt(sourceLineStr);
                    // Keep task in original position (in-place status update)
                    await this.modal.fileAccess.moveTaskBlock(
                        file,
                        sourceLine,
                        sourceLine,
                        'above',
                        col.status,
                        this.modal.plugin.settings.autoDateManagement // autoDate
                    );
                    await this.modal.updateTaskPreview();
                }
            };
        });

        // 2. Build Full Tree & Distribute to Columns
        // This ensures child tasks (even if status differs) stay with their parent
        const roots = TaskTreeUtils.buildTree(tasks);

        roots.forEach(taskObj => {
            // Find target column based on ROOT status
            const status = taskObj.status;
            // Map to column container
            // We need ref to listDivs. 
            // Query DOM? Or store in map? DOM query is easy: .kanban-column-list[data-status="..."]
            const listDiv = this.container.querySelector(`.kanban-column-list[data-status="${status}"]`) as HTMLElement;

            if (listDiv) {
                const card = listDiv.createDiv({ cls: 'kanban-card-wrapper' });
                new TaskItem(taskObj, this.modal, file, {
                    showIndent: false,
                    showCheckbox: false,
                    className: 'kanban-card-inner',
                    draggable: true,
                    checkboxForChildren: true
                }).render(card);
            }
        });
    }

    highlightColumn(status: string) {
        // Remove from all
        this.container.querySelectorAll('.kanban-column').forEach(el => el.removeClass('is-selected'));

        // Add to target
        const listDiv = this.container.querySelector(`.kanban-column-list[data-status="${status}"]`);
        if (listDiv && listDiv.parentElement) {
            listDiv.parentElement.addClass('is-selected');
        }
    }
}
