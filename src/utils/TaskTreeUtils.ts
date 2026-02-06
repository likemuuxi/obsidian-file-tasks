import { ViewTask } from '../views/BaseTaskView';

export class TaskTreeUtils {
    static buildTree(tasks: ViewTask[]): ViewTask[] {
        const roots: ViewTask[] = [];
        // We assume tasks are sorted by line number (occurrence order)
        // Use a stack to track parents: [ { task, indent } ]
        const stack: ViewTask[] = [];

        tasks.forEach(task => {
            task.children = []; // Initialize children

            // Pop stack tasks that are deeper or equal to current task (sibling or uncle)
            // But we must also check if they are actually parents.
            // Since this list might be filtered (e.g. Kanban), "indent" might jump.
            // Logic: A task is a child of the nearest previous task with strictly smaller indent.

            // However, simply popping the stack until we find a smaller indent works ONLY if the list is continuous.
            // In a filtered list, we might have:
            // - Task A (Indent 0) [Status: Done] -> Excluded from Todo
            // - Task B (Indent 1) [Status: Todo] -> Included
            // Process B: Stack empty. B becomes Root. Correct.

            // - Task A (Indent 0) [Status: Todo] -> Included
            // - Task B (Indent 1) [Status: Done] -> Excluded
            // - Task C (Indent 1) [Status: Todo] -> Included
            // Process A: Stack [A]
            // Process C: Stack [A]. A.indent (0) < C.indent (1). C is child of A. Correct.

            // Standard Outline logic:
            while (stack.length > 0) {
                const last = stack[stack.length - 1];
                if (!last || last.indent < task.indent) break;
                stack.pop();
            }

            if (stack.length > 0) {
                const parent = stack[stack.length - 1];
                if (parent) {
                    parent.children = parent.children || [];
                    parent.children.push(task);
                    // Also link parentLineNum useful for debugging or reverse lookups
                    task.parentLineNum = parent.lineNum;
                }
            } else {
                roots.push(task);
            }

            stack.push(task);
        });

        return roots;
    }
}
