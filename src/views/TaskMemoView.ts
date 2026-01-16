import { App, TFile, setIcon, Menu, Modal, MarkdownRenderer } from 'obsidian';
import { TaskView, ViewTask } from './BaseTaskView';

export class TaskMemoView extends TaskView {

    render(tasks: ViewTask[], file: TFile): void {
        this.clear();
        this.container.addClass('task-memo-view');

        // We need to read the file content directly to find the Memos, 
        // as `tasks` passed here are parsed tasks (checkboxes).
        // Memos are simple list items `- ` under `# Memo` header.
        this.renderMemos(file);
    }

    async renderMemos(file: TFile) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        let memoSectionFound = false;
        const memos: { content: string, startLine: number, endLine: number }[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.trim() === '# Memo') {
                memoSectionFound = true;
                continue;
            }
            if (memoSectionFound) {
                const trimmedLine = line.trim();

                // Stop at next section
                if (trimmedLine.startsWith('#')) {
                    break;
                }

                // New Memo Item
                if (trimmedLine.startsWith('- ')) {
                    memos.push({
                        content: trimmedLine,
                        startLine: i,
                        endLine: i
                    });
                }
                // Continuation of previous memo (not empty, not a new item)
                else if (memos.length > 0 && trimmedLine.length > 0) {
                    // Append to the last memo
                    const lastMemo = memos[memos.length - 1];
                    lastMemo.content += '\n' + trimmedLine;
                    lastMemo.endLine = i;
                }
            }
        }

        if (memos.length === 0) {
            this.container.createDiv({ text: 'No memos yet.', cls: 'task-preview-empty-message' });
            return;
        }

        const list = this.container.createDiv({ cls: 'memo-list' });
        // Use for...of to handle potential async rendering better if needed, 
        // though MarkdownRenderer.render is void, it's safer for loop logic.
        for (const memoData of memos) {
            const { content: memo, startLine, endLine } = memoData;
            const item = list.createDiv({ cls: 'memo-item' });

            // content format "- [Timestamp] Text" with potential multiline
            // Using [\s\S]* to match across newlines
            const match = memo.match(/^- \[(.*?)\] ([\s\S]*)$/);

            let timestamp = '';
            let text = memo;

            if (match) {
                timestamp = match[1];
                text = match[2];

                // Header (Timestamp)
                const header = item.createDiv({ cls: 'memo-header' });
                header.createSpan({ text: timestamp, cls: 'memo-timestamp' });

                // Body (Content)
                const body = item.createDiv({ cls: 'memo-body' });
                const contentEl = body.createDiv({ cls: 'memo-content markdown-rendered' });

                // Render Markdown
                await MarkdownRenderer.render(this.app, text, contentEl, file.path, this);
            } else {
                // Fallback structure
                const body = item.createDiv({ cls: 'memo-body' });
                const contentEl = body.createDiv({ cls: 'memo-content markdown-rendered' });
                const cleanText = memo.replace(/^- /, '');

                // Render Markdown Fallback
                await MarkdownRenderer.render(this.app, cleanText, contentEl, file.path, this);
            }

            // --- Actions Container ---
            const actions = item.createDiv({ cls: 'memo-actions' });

            // Copy Button
            const copyBtn = actions.createDiv({ cls: 'memo-action-btn copy-btn' });
            setIcon(copyBtn, 'copy');
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(text);
                // Optional: Flash success
            };

            // Edit Button
            const editBtn = actions.createDiv({ cls: 'memo-action-btn edit-btn' });
            setIcon(editBtn, 'pencil');
            editBtn.onclick = (e) => {
                e.stopPropagation();
                new EditMemoModal(this.app, text, async (newText) => {
                    // Reconstruct the full memo content (preserving timestamp)
                    // If original matched timestamp, preserve it.
                    let newFullContent = '';
                    if (timestamp) {
                        newFullContent = `- [${timestamp}] ${newText}`;
                    } else {
                        // If it didn't match, maybe it was just a bullet.
                        newFullContent = `- ${newText}`;
                    }

                    await this.fileAccess.replaceMemoLines(file, startLine, endLine, newFullContent);
                    this.render(this.tasks, file); // Refresh
                }).open();
            };

            // Delete Button
            const deleteBtn = actions.createDiv({ cls: 'memo-action-btn delete-btn' });
            setIcon(deleteBtn, 'trash');
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                await this.fileAccess.deleteMemoLines(file, startLine, endLine);
                this.render(this.tasks, file); // Refresh
            };

            // Click to toggle expand (prevent conflict with actions)
            item.addEventListener('click', (e) => {
                // If clicked on action, stop (handled by stopPropagation above, but safety check)
                if ((e.target as HTMLElement).closest('.memo-actions')) return;
                // If clicked on link inside markdown, do not expand/collapse if it handles navigation?
                // MarkdownRenderer links usually handle themselves.
                // We might want to allow default action for links.
                if ((e.target as HTMLElement).tagName === 'A') return;

                const isExpanded = item.hasClass('is-expanded');

                // Collapse all first (single expansion policy)
                list.querySelectorAll('.memo-item.is-expanded').forEach(el => {
                    el.removeClass('is-expanded');
                });

                if (!isExpanded) {
                    item.addClass('is-expanded');
                }
            });
        }
    }
}

class EditMemoModal extends Modal {
    result: string;
    onSubmit: (result: string) => void;

    constructor(app: App, defaultText: string, onSubmit: (result: string) => void) {
        super(app);
        this.result = defaultText;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: 'Edit Memo' });

        const textareaContainer = contentEl.createDiv();
        const textarea = textareaContainer.createEl('textarea', { cls: 'memo-edit-textarea' });
        textarea.value = this.result;
        textarea.style.width = '100%';
        textarea.style.height = '150px';
        textarea.style.resize = 'vertical';

        textarea.oninput = (e) => {
            this.result = (e.target as HTMLTextAreaElement).value;
        };

        // Auto-focus logic
        setTimeout(() => textarea.focus(), 50);

        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

        const saveBtn = buttonContainer.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveBtn.onclick = () => {
            this.onSubmit(this.result);
            this.close();
        };

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => {
            this.close();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
