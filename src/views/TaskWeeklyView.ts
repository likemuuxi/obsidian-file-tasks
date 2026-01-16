import { TFile } from 'obsidian';
import { TaskView, ViewTask } from './BaseTaskView';
import { TaskItem } from '../components/TaskItem';
import { TaskTreeUtils } from '../utils/TaskTreeUtils';
import * as moment from 'moment';

export class TaskWeeklyView extends TaskView {

    render(tasks: ViewTask[], file: TFile) {
        this.clear();
        this.container.addClass('task-weekly-view');

        // Group by Date (Due > Scheduled > Start)
        const groups: Record<string, ViewTask[]> = {};
        const noDate: ViewTask[] = [];

        tasks.forEach(t => {
            const dateStr = t.dueDate || t.scheduledDate || t.startDate;
            if (dateStr) {
                // Simple grouping by date string YYYY-MM-DD
                if (!groups[dateStr]) groups[dateStr] = [];
                groups[dateStr].push(t);
            } else {
                noDate.push(t);
            }
        });

        const sortedDates = Object.keys(groups).sort();

        sortedDates.forEach(date => {
            const groupDiv = this.container.createDiv({ cls: 'weekly-group' });
            groupDiv.createDiv({ cls: 'weekly-group-header', text: date });

            const roots = TaskTreeUtils.buildTree(groups[date]);
            roots.forEach(t => {
                new TaskItem(t, this.modal, file, {
                    showIndent: false,
                    showCheckbox: true,
                    className: 'weekly-task-item'
                }).render(groupDiv);
            });
        });

        if (noDate.length > 0) {
            const groupDiv = this.container.createDiv({ cls: 'weekly-group' });
            groupDiv.createDiv({ cls: 'weekly-group-header', text: 'No Date' });
            const roots = TaskTreeUtils.buildTree(noDate);
            roots.forEach(t => {
                new TaskItem(t, this.modal, file, {
                    showIndent: false,
                    showCheckbox: true,
                    className: 'weekly-task-item'
                }).render(groupDiv);
            });
        }
    }
}
