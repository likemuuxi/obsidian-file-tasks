import { TFile, setIcon, moment } from 'obsidian';
import { TaskView, ViewTask } from './BaseTaskView';
import { TaskItem } from '../components/TaskItem';
import { TaskTreeUtils } from '../utils/TaskTreeUtils';

interface QuickFilter {
    id: string;
    label: string;
    icon: string;
    match: (t: ViewTask) => boolean;
}

const QUICK_FILTERS: QuickFilter[] = [
    {
        id: 'active',
        label: 'Active',
        icon: 'list-todo',
        match: (t) => t.status === 'todo' || t.status === 'doing',
    },
    {
        id: 'today',
        label: 'Today',
        icon: 'sun',
        match: (t) => hasDateInRange(t, 0, 0),
    },
    {
        id: 'thisWeek',
        label: 'This Week',
        icon: 'calendar-days',
        match: (t) => {
            const start = moment().startOf('week').format('YYYY-MM-DD');
            const end = moment().endOf('week').format('YYYY-MM-DD');
            return [t.dueDate, t.startDate, t.scheduledDate, t.createdDate, t.completedDate].some(d => {
                if (!d) return false;
                const dt = d.substring(0, 10);
                return dt >= start && dt <= end;
            });
        },
    },
    {
        id: 'overdue',
        label: 'Overdue',
        icon: 'alert-circle',
        match: (t) => {
            const today = moment().format('YYYY-MM-DD');
            return [t.dueDate, t.startDate, t.scheduledDate].some(d => d && d.substring(0, 10) < today)
                && t.status !== 'done' && t.status !== 'cancelled';
        },
    },
    {
        id: 'done',
        label: 'Done',
        icon: 'check-circle-2',
        match: (t) => t.status === 'done',
    },
];

function hasDateInRange(t: ViewTask, startOffset: number, endOffset: number): boolean {
    const start = moment().add(startOffset, 'day').format('YYYY-MM-DD');
    const end = moment().add(endOffset, 'day').format('YYYY-MM-DD');
    return [t.dueDate, t.startDate, t.scheduledDate, t.createdDate, t.completedDate].some(d => {
        if (!d) return false;
        const dt = d.substring(0, 10);
        return dt >= start && dt <= end;
    });
}

export class TaskListView extends TaskView {
    private activeFilterId: string | null = null;

    render(tasks: ViewTask[], file: TFile) {
        this.clear();

        this.renderToolbar();

        if (tasks.length === 0) {
            this.container.createDiv({ text: 'No tasks found.', cls: 'task-preview-empty-message' });
            return;
        }

        const filtered = this.activeFilterId
            ? tasks.filter(t => {
                const f = QUICK_FILTERS.find(qf => qf.id === this.activeFilterId);
                return f ? f.match(t) : true;
            })
            : tasks;

        if (filtered.length === 0) {
            this.container.createDiv({ text: 'No tasks match the filter.', cls: 'task-preview-empty-message' });
            return;
        }

        const roots = TaskTreeUtils.buildTree(filtered);

        roots.forEach(taskObj => {
            new TaskItem(taskObj, this.modal, file).render(this.container);
        });
    }

    private renderToolbar() {
        const toolbar = this.container.createDiv({ cls: 'task-list-toolbar-wrapper' });
        const row = toolbar.createDiv({ cls: 'task-list-sort-toolbar' });

        const allBtn = row.createDiv({ cls: 'task-list-sort-btn' });
        setIcon(allBtn, 'layers');
        allBtn.createSpan({ text: 'All' });
        if (!this.activeFilterId) allBtn.addClass('active');
        allBtn.onclick = () => {
            this.activeFilterId = null;
            this.modal.updateTaskPreview();
        };

        QUICK_FILTERS.filter(f => f.id !== 'done' || this.modal.showCompleted).forEach(f => {
            const btn = row.createDiv({ cls: 'task-list-sort-btn' });
            setIcon(btn, f.icon);
            btn.createSpan({ text: f.label });
            if (this.activeFilterId === f.id) btn.addClass('active');
            btn.onclick = () => {
                this.activeFilterId = this.activeFilterId === f.id ? null : f.id;
                this.modal.updateTaskPreview();
            };
        });
    }
}
