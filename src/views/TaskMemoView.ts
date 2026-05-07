import { App, TFile, setIcon, Menu, Modal, MarkdownRenderer } from 'obsidian';
import { TaskView, ViewTask } from './BaseTaskView';

export class TaskMemoView extends TaskView {

    render(tasks: ViewTask[], file: TFile): void {
        this.clear();
        this.container.addClass('task-memo-view');

        // We need to read the file content directly to find the Memos, 
        // as `tasks` passed here are parsed tasks (checkboxes).
        // Memos are simple list items `- ` under `# Memos` header.
        this.renderMemos(file);
    }

    async renderMemos(file: TFile) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        const fileName = file.basename;

        const taskBlocks: Map<string, string> = new Map();
        const taskLinksToMemo: Map<string, { linktext: string; lineNum: number }[]> = new Map();

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            if (!line) continue;
            const taskMatch = line.match(/^(\s*-\s\[(.)\])\s(.*)$/);
            if (taskMatch && taskMatch[3]) {
                const blockIdMatch = taskMatch[3].match(/\^([a-zA-Z0-9][\w-]*)\s*$/);
                if (blockIdMatch && blockIdMatch[1]) {
                    const taskContent = taskMatch[3].replace(/\s*\^[\w-]+\s*$/, '').trim();
                    taskBlocks.set(blockIdMatch[1], taskContent);
                }

                const taskRefRegex = /\[\[[^\]]*#\^(memo-[\w-]+)(?:\|[^\]]*)?\]\]/g;
                let refMatch;
                while ((refMatch = taskRefRegex.exec(taskMatch[3])) !== null) {
                    if (refMatch[1]) {
                        const memoBlockId = refMatch[1];
                        if (!taskLinksToMemo.has(memoBlockId)) {
                            taskLinksToMemo.set(memoBlockId, []);
                        }
                        const taskBlockIdMatch = taskMatch[3].match(/\^([a-zA-Z0-9][\w-]*)\s*$/);
                        const taskBlockId = taskBlockIdMatch ? taskBlockIdMatch[1] : '';
                        const taskContent = taskMatch[3].replace(/\s*\^[\w-]+\s*$/, '').replace(/\[\[[^\]]*#\^[\w-]+(?:\|[^\]]*)?\]\]/g, '').trim();
                        taskLinksToMemo.get(memoBlockId)!.push({
                            linktext: taskBlockId ? `[[${fileName}#^${taskBlockId}|${taskContent.substring(0, 20)}]]` : taskContent,
                            lineNum: lineIdx
                        });
                    }
                }
            }
        }

        let memoSectionFound = false;
        const memos: { content: string, startLine: number, endLine: number, blockId?: string }[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line && line.trim() === '# Memos') {
                memoSectionFound = true;
                continue;
            }
            if (memoSectionFound && line) {
                const trimmedLine = line.trim();

                if (trimmedLine.startsWith('#')) {
                    break;
                }

                if (trimmedLine.startsWith('- ')) {
                    let blockId: string | undefined;
                    const blockIdMatch = trimmedLine.match(/\s\^([a-zA-Z0-9][\w-]*)\s*$/);
                    if (blockIdMatch) {
                        blockId = blockIdMatch[1];
                    }
                    memos.push({
                        content: trimmedLine,
                        startLine: i,
                        endLine: i,
                        blockId
                    });
                }
                else if (memos.length > 0 && trimmedLine.length > 0) {
                    const lastMemo = memos[memos.length - 1];
                    if (lastMemo) {
                        lastMemo.content += '\n' + trimmedLine;
                        lastMemo.endLine = i;
                    }
                }
            }
        }

        if (memos.length === 0) {
            this.container.createDiv({ text: 'No memos yet.', cls: 'task-preview-empty-message' });
            return;
        }

        const list = this.container.createDiv({ cls: 'memo-list' });
        for (const memoData of memos) {
            const { content: memo, startLine, endLine, blockId } = memoData;
            const item = list.createDiv({ cls: 'memo-item' });
            if (blockId) {
                item.setAttribute('data-block-id', blockId);
            }

            let memoText = memo;
            if (blockId) {
                memoText = memo.replace(new RegExp(`\\s\\^${blockId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`), '');
            }

            const displayText = memoText.replace(/\[\[[^\]]*#\^[\w-]+(?:\|[^\]]*)?\]\]/g, '').trim();

            const match = displayText.match(/^- \[(.*?)\] ([\s\S]*)$/);

            let timestamp = '';
            let text = displayText;

            if (match && match[1] && match[2]) {
                timestamp = match[1];
                text = match[2];

                const header = item.createDiv({ cls: 'memo-header' });
                const clockIcon = header.createSpan({ cls: 'memo-clock-icon' });
                setIcon(clockIcon, 'clock');
                header.createSpan({ text: timestamp, cls: 'memo-timestamp' });

                if (blockId) {
                    const linkedTasks = taskLinksToMemo.get(blockId);
                    if (linkedTasks && linkedTasks.length > 0) {
                        const linkedContainer = header.createDiv({ cls: 'memo-linked-tasks' });
                        for (const taskRef of linkedTasks) {
                            const taskLink = taskRef.linktext;
                            const taskLineNum = taskRef.lineNum;
                            const blockIdMatch = taskLink.match(/#\^([\w-]+)/);
                            const taskBlockId = blockIdMatch ? blockIdMatch[1] : '';
                            const aliasMatch = taskLink.match(/\|([^[\]]*)\]\]$/);
                            const alias = aliasMatch && aliasMatch[1] ? aliasMatch[1] : taskLink;
                            const tagWrapper = linkedContainer.createSpan({ cls: 'memo-linked-task-tag' });
                            const checkIcon = tagWrapper.createSpan({ cls: 'memo-task-check-icon' });
                            setIcon(checkIcon, 'square-check');
                            if (taskBlockId) {
                                const linktext = `${fileName}#^${taskBlockId}`;
                                const linkEl = tagWrapper.createEl('a', {
                                    cls: 'internal-link',
                                    text: alias,
                                    attr: {
                                        'data-href': linktext,
                                        'href': linktext,
                                        'target': '_blank',
                                        'rel': 'noopener',
                                    }
                                });
                                linkEl.addEventListener('mouseover', (event) => {
                                    this.app.workspace.trigger('hover-link', {
                                        event,
                                        source: 'file-tasks',
                                        hoverParent: this.container,
                                        targetEl: linkEl,
                                        linktext: linktext,
                                        sourcePath: file.path,
                                    });
                                });
                            } else {
                                tagWrapper.createSpan({ text: alias });
                            }
                            tagWrapper.addEventListener('click', (e) => {
                                e.stopPropagation();
                                this.modal.currentViewType = 'list';
                                this.modal.updateTabVisuals();
                                this.modal.refreshInputSection();
                                this.modal.updateTaskPreview();
                                setTimeout(() => {
                                    const taskEl = this.modal.contentEl.querySelector(`[data-line="${taskLineNum}"]`) as HTMLElement;
                                    if (taskEl) {
                                        taskEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        taskEl.addClass('task-item-highlight');
                                        setTimeout(() => taskEl.removeClass('task-item-highlight'), 2000);
                                    }
                                }, 150);
                            });
                        }
                    }
                }

                const body = item.createDiv({ cls: 'memo-body' });
                const contentEl = body.createDiv({ cls: 'memo-content markdown-rendered' });
                await MarkdownRenderer.render(this.app, text, contentEl, file.path, this.modal.component);
            } else {
                const body = item.createDiv({ cls: 'memo-body' });
                const contentEl = body.createDiv({ cls: 'memo-content markdown-rendered' });
                const cleanText = displayText.replace(/^- /, '');
                await MarkdownRenderer.render(this.app, cleanText, contentEl, file.path, this.modal.component);
            }

            const actions = item.createDiv({ cls: 'memo-actions' });

            const copyBtn = actions.createDiv({ cls: 'memo-action-btn copy-btn' });
            setIcon(copyBtn, 'copy');
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(text);
            };

            const editBtn = actions.createDiv({ cls: 'memo-action-btn edit-btn' });
            setIcon(editBtn, 'pencil');
            editBtn.onclick = (e) => {
                e.stopPropagation();
                new EditMemoModal(this.app, text, async (newText) => {
                    let newFullContent = '';
                    if (timestamp) {
                        newFullContent = `- [${timestamp}] ${newText}`;
                    } else {
                        newFullContent = `- ${newText}`;
                    }
                    if (blockId) {
                        newFullContent += ` ^${blockId}`;
                    }

                    await this.fileAccess.replaceMemoLines(file, startLine, endLine, newFullContent);
                    if (this.modal) this.modal.updateTaskPreview();
                    else this.render([], file);
                }).open();
            };

            const deleteBtn = actions.createDiv({ cls: 'memo-action-btn delete-btn' });
            setIcon(deleteBtn, 'trash');
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                await this.fileAccess.deleteMemoLines(file, startLine, endLine);
                if (this.modal) this.modal.updateTaskPreview();
                else this.render([], file);
            };

            item.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).closest('.memo-actions')) return;
                if ((e.target as HTMLElement).closest('.memo-linked-task-tag')) return;
                if ((e.target as HTMLElement).tagName === 'A') return;

                const isExpanded = item.hasClass('is-expanded');
                list.querySelectorAll('.memo-item.is-expanded').forEach(el => {
                    el.removeClass('is-expanded');
                });
                if (!isExpanded) {
                    item.addClass('is-expanded');
                }
            });

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const menu = new Menu();
                menu.addItem((menuItem) => {
                    menuItem
                        .setTitle('Jump to Memo')
                        .setIcon('forward')
                        .onClick(async () => {
                            if (this.modal) this.modal.close();
                            const leaf = this.app.workspace.getLeaf(false);
                            if (leaf) {
                                await (leaf as any).openFile(file, {
                                    eState: {
                                        line: startLine,
                                        mode: "source"
                                    }
                                });
                            }
                        });
                });
                if (blockId) {
                    menu.addItem((menuItem) => {
                        menuItem
                            .setTitle('Copy Block Reference')
                            .setIcon('copy')
                            .onClick(() => {
                                const ref = `[[${file.basename}#^${blockId}]]`;
                                navigator.clipboard.writeText(ref);
                            });
                    });
                }
                menu.showAtPosition({ x: e.pageX, y: e.pageY });
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
