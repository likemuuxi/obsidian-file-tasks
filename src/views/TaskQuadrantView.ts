import { TFile } from 'obsidian';
import { TaskView, ViewTask } from './BaseTaskView';
import { TaskItem } from '../components/TaskItem';
import { TaskTreeUtils } from '../utils/TaskTreeUtils';

export class TaskQuadrantView extends TaskView {

    render(tasks: ViewTask[], file: TFile) {
        this.clear();
        this.container.addClass('task-quadrant-view');

        const matrix = this.container.createDiv({ cls: 'quadrant-matrix' });

        // Build Tree First to preserve hierarchy
        // We only care about root tasks for quadrant distribution
        const allRoots = TaskTreeUtils.buildTree(tasks);

        // Q1: Highest Priority Roots
        const q1 = allRoots.filter(t => t.priority === 'Highest');

        // Q2: High & Medium Priority Roots (High first)
        const q2 = allRoots
            .filter(t => t.priority === 'High' || t.priority === 'Medium')
            .sort((a, b) => {
                if (a.priority === b.priority) return 0;
                return a.priority === 'High' ? -1 : 1;
            });

        // Q3: No Priority Roots
        const q3 = allRoots.filter(t => !t.priority || t.priority === 'None');

        // Q4: Low & Lowest Priority Roots (Low first)
        const q4 = allRoots
            .filter(t => t.priority === 'Low' || t.priority === 'Lowest')
            .sort((a, b) => {
                if (a.priority === b.priority) return 0;
                return a.priority === 'Low' ? -1 : 1;
            });

        // Helper to render tree nodes directly
        const renderTreeList = (container: HTMLElement, roots: any[], modal: any, file: TFile) => {
            roots.forEach(t => {
                new TaskItem(t, modal, file, {
                    showIndent: false, // Indentation handled by recursive TaskItem? Actually TaskItem handles children if passed as tree node
                    showPriority: false,
                    showDates: false,
                    className: 'quadrant-item-wrapper',
                    draggable: true
                }).render(container);
            });
        };

        // Note: renderQuadrant now expects ROOT nodes (TaskNode[]), not ViewTask[]
        // We need to update renderQuadrant to accept pre-built roots
        this.renderQuadrant(matrix, 'Do First (Highest 🔺)', q1, 'q1');
        this.renderQuadrant(matrix, 'Schedule (High ⏫ & Medium 🔼)', q2, 'q2');
        this.renderQuadrant(matrix, 'Delegate (No Priority)', q3, 'q3');
        this.renderQuadrant(matrix, 'Don\'t Do (Low 🔽 & Lowest ⏬)', q4, 'q4');
    }

    renderQuadrant(container: HTMLElement, title: string, roots: any[], cls: string) { // roots is TaskNode[]
        const qDiv = container.createDiv({ cls: `quadrant-cell ${cls}` });

        // Define priority based on class
        let quadrantPriority = 'None';
        if (cls === 'q1') quadrantPriority = 'Highest';
        else if (cls === 'q2') quadrantPriority = 'High'; // Default to High for Q2
        else if (cls === 'q3') quadrantPriority = 'None';
        else if (cls === 'q4') quadrantPriority = 'Low'; // Default to Low for Q4

        // Persist Selection State
        if (this.modal.priority === quadrantPriority) {
            qDiv.addClass('is-selected');
        }

        // Click Selection
        qDiv.onclick = () => {
            // Visual Selection
            container.querySelectorAll('.quadrant-cell').forEach(el => el.removeClass('is-selected'));
            qDiv.addClass('is-selected');

            // Reset Form (Clear other fields)
            this.modal.editingLineIndex = null;
            this.modal.description = '';
            this.modal.remarks = '';
            this.modal.dueDate = '';
            this.modal.startDate = '';
            this.modal.scheduledDate = '';
            this.modal.selectedParentLineIndex = null;
            this.modal.selectedParentTaskContent = null;

            // Set Priority
            this.modal.priority = quadrantPriority;

            // Refresh Input Section to show selected priority and cleared fields
            this.modal.refreshInputSection();
        };

        // Drag & Drop
        qDiv.ondragover = (e) => {
            e.preventDefault();
            qDiv.addClass('drag-over');
        };

        qDiv.ondragleave = (e) => {
            e.preventDefault();
            qDiv.removeClass('drag-over');
        };

        qDiv.ondrop = async (e) => {
            e.preventDefault();
            qDiv.removeClass('drag-over');
            const lineNumStr = e.dataTransfer?.getData('text/plain');
            if (lineNumStr) {
                const lineNum = parseInt(lineNumStr);
                const file = this.modal.app.vault.getAbstractFileByPath(this.modal.targetFile) as TFile;
                if (file) {
                    await this.modal.fileAccess.updateTaskPriority(file, lineNum, quadrantPriority);
                    await this.modal.updateTaskPreview();
                }
            }
        };

        qDiv.createDiv({ cls: 'quadrant-header', text: title });
        const list = qDiv.createDiv({ cls: 'quadrant-list' });

        // Use passed roots directly
        roots.forEach(t => {
            new TaskItem(t, this.modal, this.modal.fileAccess.app.vault.getAbstractFileByPath(this.modal.targetFile) as TFile, {
                showIndent: false,
                showPriority: false, // Hide priority in quadrant view
                showDates: false,    // Hide dates in quadrant view
                className: 'quadrant-item-wrapper',
                draggable: true      // Enable drag-and-drop
            }).render(list);
        });
    }
}
