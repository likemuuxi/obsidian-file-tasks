import { TFile, setIcon } from 'obsidian';
import { TaskView, ViewTask } from './BaseTaskView';
import { TaskItem } from '../components/TaskItem';
import { TaskTreeUtils } from '../utils/TaskTreeUtils';

export class TaskListView extends TaskView {

    render(tasks: ViewTask[], file: TFile) {
        this.clear();

        if (tasks.length === 0) {
            this.container.createDiv({ text: 'No tasks found.', cls: 'task-preview-empty-message' });
            return;
        }

        const roots = TaskTreeUtils.buildTree(tasks);

        roots.forEach(taskObj => {
            // TaskItem handles recursion
            new TaskItem(taskObj, this.modal, file).render(this.container);
        });
    }
}

