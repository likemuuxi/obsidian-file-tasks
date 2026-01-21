import { App, TFile, moment } from 'obsidian';

export class FileAccess {
    app: App;

    constructor(app: App) {
        this.app = app;
    }

    getNextStatus(currentStatus: string): string {
        switch (currentStatus) {
            case 'todo': return 'done'; // [ ] -> [x]
            case 'done': return 'todo'; // [x] -> [ ]
            case 'doing': return 'done'; // [/] -> [x]
            default: return 'todo';
        }
    }

    getStatusChar(status: string): string {
        switch (status) {
            case 'todo': return ' ';
            case 'doing': return '/';
            case 'done': return 'x';
            default: return ' ';
        }
    }

    async toggleTaskStatus(file: TFile, lineNumber: number, currentStatus: string, autoCheck: boolean = true, autoDate: boolean = false) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        if (lines.length <= lineNumber) {
            console.error('Line number out of bounds');
            return;
        }

        const initialLine = lines[lineNumber];
        if (!initialLine) return;

        const nextStatus = this.getNextStatus(currentStatus);
        const newStatusChar = this.getStatusChar(nextStatus);
        const statusRegex = /^(\s*-\s\[)(.)(\]\s.*)$/;

        const visited = new Set<number>();

        // Helper to set status of a specific line
        const setLineStatus = (index: number, status: string) => {
            if (visited.has(index)) return; // Prevent loop
            const line = lines[index];
            const match = line.match(statusRegex);
            if (match) {
                const char = this.getStatusChar(status);
                // Only update if changed
                if (match[2] !== char) {
                    let newLine = `${match[1]}${char}${match[3]}`;

                    // Auto Date Logic
                    if (autoDate) {
                        const today = moment().format('YYYY-MM-DD HH:mm');
                        const completionDateStr = ` ✅ ${today}`;

                        if (status === 'done') {
                            // Add completion date if not present
                            if (!newLine.includes(completionDateStr)) {
                                // Insert before remarks (%%) or at end
                                const remarkIndex = newLine.indexOf('%%');
                                if (remarkIndex !== -1) {
                                    newLine = newLine.substring(0, remarkIndex).trimEnd() + completionDateStr + ' ' + newLine.substring(remarkIndex);
                                } else {
                                    newLine = newLine.trimEnd() + completionDateStr;
                                }
                            }
                            // Remove any cancellation date if present
                            newLine = newLine.replace(/\s*❌\s*\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2})?/g, '');
                        } else {
                            // Remove completion date if present (unchecking or doing)
                            // Regex to remove " ✅ YYYY-MM-DD" (allowing for flexible whitespace)
                            newLine = newLine.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2})?/g, '');
                        }
                    }

                    lines[index] = newLine;
                    visited.add(index);
                }
            }
        };

        const getLineStatus = (index: number): string | null => {
            const line = lines[index];
            const match = line.match(statusRegex);
            if (match) {
                const char = match[2];
                if (char === 'x' || char === 'X') return 'done';
                if (char === '/') return 'doing';
                return 'todo';
            }
            return null;
        };

        // 1. Update Target
        setLineStatus(lineNumber, nextStatus);

        if (autoCheck) {
            // 2. Cascade Down (Update Children)
            const targetIndent = this.getIndentLevel(initialLine);
            for (let i = lineNumber + 1; i < lines.length; i++) {
                const l = lines[i];
                if (l.trim() === '') continue;
                if (this.getIndentLevel(l) <= targetIndent) break; // End of subtree

                // Set child status to match parent
                // If parent DONE -> Child DONE.
                // If parent TODO -> Child TODO.
                // If parent DOING -> Child TODO? (User said "切换为未完成")
                // Assuming sync: match parent's new status.
                setLineStatus(i, nextStatus);
            }

            // 3. Bubble Up (Update Parents)
            let currentIdx = lineNumber;
            while (true) {
                const currentIndent = this.getIndentLevel(lines[currentIdx]);
                let parentIdx = -1;
                // Find parent
                for (let i = currentIdx - 1; i >= 0; i--) {
                    if (lines[i].trim() !== '' && this.getIndentLevel(lines[i]) < currentIndent) {
                        parentIdx = i;
                        break;
                    }
                }

                if (parentIdx === -1) break; // No parent

                const parentStatus = getLineStatus(parentIdx);
                const parentIndent = this.getIndentLevel(lines[parentIdx]);

                // Scan Siblings
                let siblingCount = 0;
                let doneCount = 0;
                let doingCount = 0;
                let todoCount = 0;

                // We need to identify strictly immediate children of the parent
                // The current task (lines[currentIdx]) IS a child. Its indent is `currentIndent`.
                // So siblings are lines with indent === currentIndent in the parent's block.

                // Scan parent's block
                for (let i = parentIdx + 1; i < lines.length; i++) {
                    const l = lines[i];
                    if (l.trim() === '') continue;
                    const lev = this.getIndentLevel(l);
                    if (lev <= parentIndent) break; // End of parent block

                    if (lev === currentIndent) {
                        siblingCount++;
                        const s = getLineStatus(i);
                        if (s === 'done') doneCount++;
                        else if (s === 'doing') doingCount++;
                        else todoCount++;
                    }
                }

                let newParentStatus = parentStatus;
                if (siblingCount > 0) {
                    if (doneCount === siblingCount) {
                        newParentStatus = 'done';
                    } else if (todoCount === siblingCount) {
                        newParentStatus = 'todo';
                    } else {
                        // Mixed state (some done, some doing, or some todo)
                        newParentStatus = 'doing';
                    }
                }

                if (newParentStatus !== parentStatus) {
                    setLineStatus(parentIdx, newParentStatus);
                    currentIdx = parentIdx; // Continue up
                    continue;
                }

                break;
            }
        }

        const newContent = lines.join('\n');
        await this.app.vault.modify(file, newContent);
    }

    async appendTask(file: TFile, taskLine: string) {
        const content = await this.app.vault.read(file);
        // Ensure ends with newline
        const newContent = content.endsWith('\n') ? content + taskLine : content + '\n' + taskLine;
        await this.app.vault.modify(file, newContent);
    }

    async updateTaskStatuses(file: TFile, updates: { lineNumber: number, status: string }[]) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        let modified = false;

        updates.forEach(({ lineNumber, status }) => {
            if (lines.length > lineNumber) {
                const line = lines[lineNumber];
                const newStatusChar = this.getStatusChar(status);
                const statusRegex = /^(\s*-\s\[).(\]\s.*)$/;
                const match = line.match(statusRegex);

                if (match) {
                    lines[lineNumber] = `${match[1]}${newStatusChar}${match[2]}`;
                    modified = true;
                }
            }
        });

        if (modified) {
            const newContent = lines.join('\n');
            await this.app.vault.modify(file, newContent);
        }
    }

    async insertTaskAtIndex(file: TFile, lineIndex: number, taskLine: string) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        if (lineIndex < 0) lineIndex = 0;
        if (lineIndex > lines.length) lineIndex = lines.length;

        lines.splice(lineIndex, 0, taskLine);
        const newContent = lines.join('\n');
        await this.app.vault.modify(file, newContent);
    }

    async replaceTask(file: TFile, lineIndex: number, newTaskLine: string) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        if (lineIndex >= 0 && lineIndex < lines.length) {
            lines[lineIndex] = newTaskLine;
            const newContent = lines.join('\n');
            await this.app.vault.modify(file, newContent);
        } else {
            console.error('Line index out of bounds');
        }
    }
    async updateTaskPriority(file: TFile, lineNumber: number, newPriority: string) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        if (lineNumber >= 0 && lineNumber < lines.length) {
            let line = lines[lineNumber];

            // Remove existing priority icons
            const priorityIcons = ['🔺', '⏫', '🔼', '🔽', '⏬'];
            priorityIcons.forEach(icon => {
                line = line.replace(icon, '').trim();
            });

            // Insert new priority icon
            // Priority is usually appended or inserted before tags/dates. 
            // For now, let's append it to the end of the description part, but before other metadata if possible.
            // Or just append to end for simplicity, as our parser handles any position.

            let iconToAdd = '';
            switch (newPriority) {
                case 'Highest': iconToAdd = ' 🔺'; break;
                case 'High': iconToAdd = ' ⏫'; break;
                case 'Medium': iconToAdd = ' 🔼'; break;
                case 'Low': iconToAdd = ' 🔽'; break;
                case 'Lowest': iconToAdd = ' ⏬'; break;
                case 'None': iconToAdd = ''; break;
            }

            if (iconToAdd) {
                // Try to insert before dates if present, otherwise append
                const dateRegex = /(📅|🛫|⏳)/;
                const match = line.match(dateRegex);
                if (match && match.index) {
                    line = line.substring(0, match.index).trimEnd() + iconToAdd + ' ' + line.substring(match.index);
                } else {
                    line = line.trimEnd() + iconToAdd;
                }
            }

            lines[lineNumber] = line;
            const newContent = lines.join('\n');
            await this.app.vault.modify(file, newContent);
        }
    }
    private getIndentStr(line: string): string {
        const match = line.match(/^(\s*)/);
        return match ? match[1] : '';
    }

    private getIndentLevel(line: string): number {
        const indent = this.getIndentStr(line);
        // Normalize: tab = 4 spaces (standard approximation)
        return indent.replace(/\t/g, '    ').length;
    }

    async toggleTaskStrikethrough(file: TFile, lineNumber: number, autoDate: boolean = false) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        if (lineNumber >= 0 && lineNumber < lines.length) {
            let line = lines[lineNumber];

            // Regex to separate status, content, and metadata
            const statusMatch = line.match(/^(\s*-\s\[.\]\s)(.*)$/);
            if (statusMatch) {
                let prefix = statusMatch[1];
                let body = statusMatch[2];
                let metadata = '';
                const metadataRegex = /(\s+([🔺⏫🔼🔽☕✅❌➕]|(?:🛫|⏳|📅)\s\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2})?|%%.*?%%).*)$/;
                const metaMatch = body.match(metadataRegex);
                if (metaMatch) {
                    metadata = metaMatch[1];
                    body = body.substring(0, body.length - metadata.length);
                }

                // Check if body starts and ends with ~~
                if (body.startsWith('~~') && body.endsWith('~~')) {
                    // Remove
                    body = body.substring(2, body.length - 2);
                    // Restore status to Todo
                    prefix = prefix.replace(/\[-\]/, '[ ]');

                    if (autoDate) {
                        // Remove cancellation date from metadata if present
                        metadata = metadata.replace(/\s*❌\s*\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2})?/g, '');
                    }
                } else {
                    // Add
                    body = `~~${body}~~`;
                    // Change status to Cancelled [-]
                    prefix = prefix.replace(/\[.\]/, '[-]');

                    if (autoDate) {
                        const today = moment().format('YYYY-MM-DD HH:mm');
                        const cancelDateStr = ` ❌ ${today}`;
                        if (!metadata.includes(cancelDateStr)) {
                            metadata = metadata + cancelDateStr;
                        }
                        // Remove completion date if present
                        metadata = metadata.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2})?/g, '');
                    }
                }

                lines[lineNumber] = `${prefix}${body}${metadata}`;
                await this.app.vault.modify(file, lines.join('\n'));
            }
        }
    }

    async moveTaskBlock(file: TFile, sourceIndex: number, targetIndex: number, action: 'child' | 'above' | 'below' | 'root', newStatus?: string, autoDate: boolean = false) {
        const content = await this.app.vault.read(file);
        let lines = content.split('\n');

        if (sourceIndex < 0 || sourceIndex >= lines.length || targetIndex < 0 || targetIndex >= lines.length) return;
        if (sourceIndex === targetIndex && !newStatus) return;

        // 1. Identify Source Block
        const sourceIndentLevel = this.getIndentLevel(lines[sourceIndex]);
        let sourceEnd = sourceIndex;
        for (let i = sourceIndex + 1; i < lines.length; i++) {
            if (lines[i].trim() !== '' && this.getIndentLevel(lines[i]) <= sourceIndentLevel) break;
            sourceEnd = i;
        }
        let block = lines.slice(sourceIndex, sourceEnd + 1);

        // 2. Remove Source
        lines.splice(sourceIndex, block.length);

        // Adjust Target
        let adjustedTargetIndex = targetIndex;
        if (sourceIndex < targetIndex) {
            adjustedTargetIndex -= block.length;
        }

        // Output safety check
        if (adjustedTargetIndex < 0) adjustedTargetIndex = 0; // Should not happen given constraints

        // Apply Status Change if needed
        if (newStatus) {
            const newStatusChar = this.getStatusChar(newStatus);
            // Update ALL tasks in the block recursively
            block = block.map(line => {
                if (/^\s*-\s\[.\]/.test(line)) {
                    let newLine = line.replace(/^(\s*-\s\[).(\])/, `$1${newStatusChar}$2`);

                    if (autoDate) {
                        const today = moment().format('YYYY-MM-DD HH:mm');
                        const completionDateStr = ` ✅ ${today}`;

                        if (newStatus === 'done') {
                            // Add completion date if not present
                            if (!newLine.includes(completionDateStr)) {
                                // Insert before remarks (%%) or at end
                                const remarkIndex = newLine.indexOf('%%');
                                if (remarkIndex !== -1) {
                                    newLine = newLine.substring(0, remarkIndex).trimEnd() + completionDateStr + ' ' + newLine.substring(remarkIndex);
                                } else {
                                    newLine = newLine.trimEnd() + completionDateStr;
                                }
                            }
                            // Remove cancellation date if present
                            newLine = newLine.replace(/\s*❌\s*\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2})?/g, '');
                        } else {
                            // Remove completion date if present (unchecking or doing)
                            newLine = newLine.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2})?/g, '');
                        }
                    }
                    return newLine;
                }
                return line;
            });
        }

        // 3. Indentation & Insertion
        const targetLine = lines[adjustedTargetIndex];
        const targetIndentStr = targetLine ? this.getIndentStr(targetLine) : '';
        const sourceIndentStr = this.getIndentStr(block[0]);
        const indentUnit = '\t';

        let insertIndex = adjustedTargetIndex;
        let newBaseIndent = '';

        if (action === 'root') {
            insertIndex = adjustedTargetIndex + 1; // Append after target
            newBaseIndent = ''; // Force Root
        } else if (action === 'child') {
            insertIndex = adjustedTargetIndex + 1;
            newBaseIndent = targetIndentStr + indentUnit;
        } else if (action === 'above') {
            insertIndex = adjustedTargetIndex;
            newBaseIndent = targetIndentStr;
        } else if (action === 'below') {
            // Insert after target's subtree
            if (targetLine) {
                const targetIndentLevel = this.getIndentLevel(targetLine);
                let targetEnd = adjustedTargetIndex;
                for (let i = adjustedTargetIndex + 1; i < lines.length; i++) {
                    if (lines[i].trim() !== '' && this.getIndentLevel(lines[i]) <= targetIndentLevel) break;
                    targetEnd = i;
                }
                insertIndex = targetEnd + 1;
                newBaseIndent = targetIndentStr;
            } else {
                insertIndex = adjustedTargetIndex + 1;
                newBaseIndent = '';
            }
        }

        // Re-indent Block
        block = block.map(line => {
            if (line.startsWith(sourceIndentStr)) {
                return newBaseIndent + line.substring(sourceIndentStr.length);
            }
            return line;
        });

        // 4. Insert Block
        lines.splice(insertIndex, 0, ...block);
        await this.app.vault.modify(file, lines.join('\n'));
    }

    async deleteTaskBlock(file: TFile, lineIndex: number) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        if (lineIndex < 0 || lineIndex >= lines.length) return;

        // 1. Identify Source Block (Task + Subtree)
        const sourceIndentLevel = this.getIndentLevel(lines[lineIndex]);
        let sourceEnd = lineIndex;
        for (let i = lineIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            // Stop if line is not empty and has indentation <= source
            if (line.trim() !== '' && this.getIndentLevel(line) <= sourceIndentLevel) break;
            sourceEnd = i;
        }

        // 2. Remove Block
        lines.splice(lineIndex, sourceEnd - lineIndex + 1);

        await this.app.vault.modify(file, lines.join('\n'));
    }
    async appendMemo(file: TFile, memoLine: string) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        // Find "# Memos" line
        const memoIndex = lines.findIndex(l => l.trim() === '# Memos');

        let newContent = '';
        if (memoIndex !== -1) {
            // Insert after # Memos header
            lines.splice(memoIndex + 1, 0, memoLine);
            newContent = lines.join('\n');
        } else {
            // Append # Memos and content at the end if not exists?
            // User requirement: "Memos are always added below # Memos".
            // If it doesn't exist, Create it.
            if (lines[lines.length - 1].trim() !== '') {
                lines.push('');
            }
            lines.push('# Memos');
            lines.push('\n');
            lines.push(memoLine);
            newContent = lines.join('\n');
        }

        await this.app.vault.modify(file, newContent);
    }

    async deleteMemoLines(file: TFile, startLine: number, endLine: number) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        if (startLine < 0 || endLine >= lines.length || startLine > endLine) {
            console.error('Invalid line range for deletion');
            return;
        }

        // Remove lines from startLine to endLine (inclusive)
        lines.splice(startLine, endLine - startLine + 1);

        const newContent = lines.join('\n');
        await this.app.vault.modify(file, newContent);
    }

    async replaceMemoLines(file: TFile, startLine: number, endLine: number, newContent: string) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        if (startLine < 0 || endLine >= lines.length || startLine > endLine) {
            console.error('Invalid line range for replacement');
            return;
        }

        // Replace the range with new lines
        // newContent might be multiple lines
        const newLines = newContent.split('\n');

        lines.splice(startLine, endLine - startLine + 1, ...newLines);

        const finalContent = lines.join('\n');
        await this.app.vault.modify(file, finalContent);
    }

    async moveTaskToProject(sourceFile: TFile, targetFile: TFile, lineNum: number) {
        if (sourceFile.path === targetFile.path) return;

        const sourceContent = await this.app.vault.read(sourceFile);
        const sourceLines = sourceContent.split('\n');

        if (lineNum < 0 || lineNum >= sourceLines.length) return;

        // 1. Identify Source Block (Task + Subtree)
        const sourceIndentLevel = this.getIndentLevel(sourceLines[lineNum]);
        let sourceEnd = lineNum;
        for (let i = lineNum + 1; i < sourceLines.length; i++) {
            const line = sourceLines[i];
            if (line.trim() !== '' && this.getIndentLevel(line) <= sourceIndentLevel) break;
            sourceEnd = i;
        }

        const block = sourceLines.slice(lineNum, sourceEnd + 1);

        // 2. Remove from Source
        sourceLines.splice(lineNum, sourceEnd - lineNum + 1);
        await this.app.vault.modify(sourceFile, sourceLines.join('\n'));

        // 3. Append/Insert to Target
        const targetContent = await this.app.vault.read(targetFile);
        const targetLines = targetContent.split('\n');

        // Check for # Memo or # Memos header to insert BEFORE
        // We want to put it at the end of the Task section, which is effectively before the Memo section.
        const memoIndex = targetLines.findIndex(l => l.trim() === '# Memos');

        if (memoIndex !== -1) {
            // Insert before Memo header
            // Ensure there is a blank line before Memo header if we are inserting right up against it?
            // Actually, just splicing it in at memoIndex shifts memo down.
            // We might want to ensure a newline after the block if the memo header is right there.

            // If the line before memoIndex is not empty, maybe add spacing? 
            // For now, simple insertion.
            targetLines.splice(memoIndex, 0, ...block);
            // If the block didn't end with a newline (it's array of strings), it's fine.
            // But if the previous line was non-empty and we insert, it's fine.

            await this.app.vault.modify(targetFile, targetLines.join('\n'));
        } else {
            // Append to end (existing behavior)
            const newTargetContent = targetContent.endsWith('\n') ?
                targetContent + block.join('\n') :
                targetContent + '\n' + block.join('\n');
            await this.app.vault.modify(targetFile, newTargetContent);
        }
    }

    async getIncompleteTaskCount(file: TFile): Promise<number> {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        let count = 0;
        const statusRegex = /^\s*-\s\[(.)\]/;

        for (const line of lines) {
            const match = line.match(statusRegex);
            if (match) {
                const statusChar = match[1];
                // Count [ ] (space) and [/] (doing) as incomplete
                // Exclude [x] (done) and [-] (cancelled)
                if (statusChar === ' ' || statusChar === '/') {
                    count++;
                }
            }
        }
        return count;
    }

    async getCompletionStats(taskDirectory: string, specificFiles?: TFile[]): Promise<{ total: number, incomplete: number, rate: number }> {
        let targetFiles: TFile[];

        if (specificFiles) {
            targetFiles = specificFiles;
        } else {
            const files = this.app.vault.getFiles();
            // Filter files based on taskDirectory if set
            targetFiles = taskDirectory && taskDirectory !== '/'
                ? files.filter(f => f.path.startsWith(taskDirectory))
                : files;
        }

        let totalTasks = 0;
        let incompleteTasks = 0;

        const statusRegex = /^\s*-\s\[(.)\]/;

        for (const file of targetFiles) {
            // Skip non-markdown
            if (file.extension !== 'md') continue;

            const content = await this.app.vault.read(file);
            const lines = content.split('\n');

            for (const line of lines) {
                const match = line.match(statusRegex);
                if (match) {
                    const statusChar = match[1];
                    // Count valid task lines
                    if ([' ', 'x', '/', '-'].includes(statusChar)) {
                        totalTasks++;
                        // Count incomplete
                        if (statusChar === ' ' || statusChar === '/') {
                            incompleteTasks++;
                        }
                    }
                }
            }
        }

        const rate = totalTasks > 0 ? (incompleteTasks / totalTasks) : 0;
        return { total: totalTasks, incomplete: incompleteTasks, rate };
    }
    async getMemoCount(file: TFile): Promise<number> {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        let count = 0;
        let memoSectionFound = false;

        for (const line of lines) {
            if (line.trim() === '# Memos') {
                memoSectionFound = true;
                continue;
            }
            if (memoSectionFound) {
                const trimmed = line.trim();
                if (trimmed.startsWith('#')) break;
                if (trimmed.startsWith('- ')) count++;
            }
        }
        return count;
    }
}
