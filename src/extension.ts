import * as vscode from 'vscode';
import { LineRange, renumberMarkdownHeadings, renumberMarkdownOrderedLists } from './sectionNumbering';

// ── Types ────────────────────────────────────────────────────────────────────

interface InlineWrapSpec {
    prefix: string;
    suffix: string;
}

// ── Inline Toggle Helpers ────────────────────────────────────────────────────

// Scans the line at pos looking for the nearest matching prefix (to the left
// of the cursor) and suffix (to the right). Returns the full wrapped Range if
// the cursor is inside an existing wrap, or null otherwise.
function findSurroundingWrap(
    editor: vscode.TextEditor,
    pos: vscode.Position,
    { prefix, suffix }: InlineWrapSpec
): vscode.Range | null {
    const line = editor.document.lineAt(pos.line).text;
    const col = pos.character;
    const pLen = prefix.length;
    const sLen = suffix.length;

    // Guard: ensure a single-char delimiter isn't part of a longer one (e.g. * vs **)
    const validAt = (i: number, delim: string): boolean => {
        if (delim.length === 1) {
            return line[i - 1] !== delim && line[i + 1] !== delim;
        }
        return true;
    };

    // Rightmost valid prefix that ends at or before the cursor
    let prefixStart = -1;
    for (let i = 0; i + pLen <= col; i++) {
        if (line.slice(i, i + pLen) === prefix && validAt(i, prefix)) {
            prefixStart = i;
        }
    }
    if (prefixStart === -1) { return null; }

    const innerStart = prefixStart + pLen;

    // Leftmost valid suffix starting at or after the cursor (and after the inner content)
    let suffixStart = -1;
    for (let i = Math.max(col, innerStart); i + sLen <= line.length; i++) {
        if (line.slice(i, i + sLen) === suffix && validAt(i, suffix)) {
            suffixStart = i;
            break;
        }
    }
    if (suffixStart === -1 || suffixStart <= innerStart) { return null; }

    return new vscode.Range(
        new vscode.Position(pos.line, prefixStart),
        new vscode.Position(pos.line, suffixStart + sLen)
    );
}

function isWrapped(text: string, { prefix, suffix }: InlineWrapSpec): boolean {
    if (text.length < prefix.length + suffix.length + 1) { return false; }
    if (!text.startsWith(prefix) || !text.endsWith(suffix)) { return false; }
    // Italic (*) must not match bold (**): inner text must not start/end with *
    if (prefix === '*') {
        const inner = text.slice(prefix.length, text.length - suffix.length);
        if (inner.startsWith('*') || inner.endsWith('*')) { return false; }
    }
    return true;
}

function unwrap(text: string, { prefix, suffix }: InlineWrapSpec): string {
    return text.slice(prefix.length, text.length - suffix.length);
}

function applyInlineWrap(editor: vscode.TextEditor, spec: InlineWrapSpec): void {
    const { prefix, suffix } = spec;

    // Separate empty vs non-empty selections — handle them differently
    const nonEmpty = editor.selections.filter(s => !s.isEmpty);
    const empty = editor.selections.filter(s => s.isEmpty);

    if (nonEmpty.length > 0) {
        editor.edit(eb => {
            const eol = editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
            for (const sel of nonEmpty) {
                const text = editor.document.getText(sel);
                // Split on CRLF or LF so \r is never part of a line's content
                const lines = text.split(/\r?\n/);

                if (lines.length === 1) {
                    // Single line: toggle wrap on the whole selection
                    if (isWrapped(text, spec)) {
                        eb.replace(sel, unwrap(text, spec));
                    } else {
                        eb.replace(sel, `${prefix}${text}${suffix}`);
                    }
                } else {
                    // Multi-line: apply per non-empty line independently
                    const contentLines = lines.filter(l => l.trim() !== '');
                    const allWrapped = contentLines.length > 0 && contentLines.every(l => isWrapped(l, spec));
                    const result = lines.map(line => {
                        if (line.trim() === '') { return line; }
                        return allWrapped ? unwrap(line, spec) : `${prefix}${line}${suffix}`;
                    }).join(eol);
                    eb.replace(sel, result);
                }
            }
        });
    }

    if (empty.length > 0) {
        // For each cursor: if it sits inside an existing wrap, remove it; otherwise insert placeholder
        const toRemove: vscode.Range[] = [];
        const toInsert: vscode.Selection[] = [];

        for (const sel of empty) {
            const surrounding = findSurroundingWrap(editor, sel.active, spec);
            if (surrounding) {
                toRemove.push(surrounding);
            } else {
                toInsert.push(sel);
            }
        }

        if (toRemove.length > 0) {
            editor.edit(eb => {
                for (const range of toRemove) {
                    eb.replace(range, unwrap(editor.document.getText(range), spec));
                }
            });
        }

        if (toInsert.length > 0) {
            editor.selections = toInsert;
            const snippet = new vscode.SnippetString(`${escapeSnippet(prefix)}\${1:text}${escapeSnippet(suffix)}`);
            editor.insertSnippet(snippet);
        }
    }
}

function escapeSnippet(s: string): string {
    return s.replace(/[$\\{}|]/g, '\\$&');
}

// ── Line-Based Transform Helpers ─────────────────────────────────────────────

function getSelectedLines(editor: vscode.TextEditor): number[] {
    const lineNumbers = new Set<number>();
    for (const sel of editor.selections) {
        const startLine = sel.start.line;
        const endLine =
            sel.end.character === 0 && sel.end.line > sel.start.line
                ? sel.end.line - 1
                : sel.end.line;
        for (let i = startLine; i <= endLine; i++) {
            lineNumbers.add(i);
        }
    }
    return [...lineNumbers].sort((a, b) => a - b);
}

function applyLineTransform(
    editor: vscode.TextEditor,
    transform: (lineText: string) => string
): void {
    const lines = getSelectedLines(editor);
    editor.edit(eb => {
        for (const lineNum of lines) {
            const line = editor.document.lineAt(lineNum);
            eb.replace(line.range, transform(line.text));
        }
    });
}

function makeHeadingTransform(prefix: string): (line: string) => string {
    return (line: string) => {
        const stripped = line.replace(/^#{1,6}\s+/, '');
        if (line.startsWith(prefix)) {
            return stripped;
        }
        return `${prefix}${stripped}`;
    };
}

function makeTogglePrefixTransform(prefix: string): (line: string) => string {
    return (line: string) => {
        if (line.startsWith(prefix)) {
            return line.slice(prefix.length);
        }
        return `${prefix}${line}`;
    };
}

function makeTaskTransform(checked: boolean): (line: string) => string {
    const target = checked ? '- [x] ' : '- [ ] ';
    const other  = checked ? '- [ ] ' : '- [x] ';
    return (line: string) => {
        if (line.startsWith(target)) { return line.slice(target.length); }
        if (line.startsWith(other))  { return `${target}${line.slice(other.length)}`; }
        if (line.startsWith('- '))   { return `${target}${line.slice(2)}`; }
        return `${target}${line}`;
    };
}

function applyOrderedList(editor: vscode.TextEditor): void {
    const pattern = /^\d+\.\s/;
    const lines = getSelectedLines(editor);
    editor.edit(eb => {
        let counter = 1;
        for (const lineNum of lines) {
            const line = editor.document.lineAt(lineNum);
            const text = line.text;
            if (pattern.test(text)) {
                eb.replace(line.range, text.replace(pattern, ''));
            } else {
                eb.replace(line.range, `${counter}. ${text}`);
                counter++;
            }
        }
    });
}

// ── Complex Insertions ───────────────────────────────────────────────────────

function insertLink(editor: vscode.TextEditor): void {
    const sel = editor.selection;
    const selected = editor.document.getText(sel);
    if (!selected) {
        editor.insertSnippet(new vscode.SnippetString('[${1:text}](${2:url})'));
        return;
    }
    const eol = editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const lines = selected.split(/\r?\n/);
    if (lines.length === 1) {
        editor.insertSnippet(new vscode.SnippetString(`[${escapeSnippet(selected)}](\${1:url})`), sel);
    } else {
        // Multi-line: wrap each non-empty line; URL left as placeholder text
        const result = lines.map(l => l.trim() === '' ? l : `[${l}](url)`).join(eol);
        editor.edit(eb => eb.replace(sel, result));
    }
}

function insertImage(editor: vscode.TextEditor): void {
    const sel = editor.selection;
    const selected = editor.document.getText(sel);
    if (!selected) {
        editor.insertSnippet(new vscode.SnippetString('![${1:alt}](${2:url})'));
        return;
    }
    const eol = editor.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const lines = selected.split(/\r?\n/);
    if (lines.length === 1) {
        editor.insertSnippet(new vscode.SnippetString(`![${escapeSnippet(selected)}](\${1:url})`), sel);
    } else {
        const result = lines.map(l => l.trim() === '' ? l : `![${l}](url)`).join(eol);
        editor.edit(eb => eb.replace(sel, result));
    }
}

function insertCodeBlock(editor: vscode.TextEditor): void {
    const sel = editor.selection;
    const selected = editor.document.getText(sel);
    if (selected) {
        editor.edit(eb => {
            eb.replace(sel, `\`\`\`\n${selected}\n\`\`\``);
        });
    } else {
        editor.insertSnippet(new vscode.SnippetString('```${1:language}\n${2:code}\n```'));
    }
}

function insertBlockMath(editor: vscode.TextEditor): void {
    const sel = editor.selection;
    const selected = editor.document.getText(sel);
    if (selected) {
        editor.edit(eb => {
            eb.replace(sel, `$$\n${selected}\n$$`);
        });
    } else {
        editor.insertSnippet(new vscode.SnippetString('$$\n${1:expression}\n$$'));
    }
}

function insertTable(editor: vscode.TextEditor): void {
    const template =
        '| Header 1 | Header 2 | Header 3 |\n' +
        '| -------- | -------- | -------- |\n' +
        '| Cell 1   | Cell 2   | Cell 3   |';
    const pos = editor.selection.active;
    const lineText = editor.document.lineAt(pos.line).text;
    const prefix = lineText.trim().length > 0 ? '\n' : '';
    editor.edit(eb => eb.insert(pos, `${prefix}${template}\n`));
}

function insertHorizontalRule(editor: vscode.TextEditor): void {
    const pos = editor.selection.active;
    const lineText = editor.document.lineAt(pos.line).text;
    const prefix = lineText.trim().length > 0 ? '\n' : '';
    editor.edit(eb => eb.insert(pos, `${prefix}---\n`));
}

// ── Section Number Updater ───────────────────────────────────────────────────

function getSectionNumberingRanges(editor: vscode.TextEditor): LineRange[] | undefined {
    const nonEmptySelections = editor.selections.filter(selection => !selection.isEmpty);
    if (nonEmptySelections.length === 0) {
        return undefined;
    }

    return nonEmptySelections.map(selection => ({
        startLine: selection.start.line,
        endLine:
            selection.end.character === 0 && selection.end.line > selection.start.line
                ? selection.end.line - 1
                : selection.end.line
    }));
}

function getDocumentRange(document: vscode.TextDocument): vscode.Range {
    const lastLine = document.lineCount - 1;
    return new vscode.Range(
        new vscode.Position(0, 0),
        document.lineAt(lastLine).range.end
    );
}

function updateSectionNumbers(editor: vscode.TextEditor): void {
    const doc = editor.document;
    const ranges = getSectionNumberingRanges(editor);
    const updatedText = renumberMarkdownHeadings(doc.getText(), ranges);

    if (updatedText === doc.getText()) {
        return;
    }

    editor.edit(eb => {
        eb.replace(getDocumentRange(doc), updatedText);
    });
}

function updateListNumbers(editor: vscode.TextEditor): void {
    const doc = editor.document;
    const ranges = getSectionNumberingRanges(editor);
    const updatedText = renumberMarkdownOrderedLists(doc.getText(), ranges);

    if (updatedText === doc.getText()) {
        return;
    }

    editor.edit(eb => {
        eb.replace(getDocumentRange(doc), updatedText);
    });
}

// ── activate ─────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
    const reg = (id: string, fn: () => void | Thenable<void>) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, fn));

    const getEditor = (): vscode.TextEditor | undefined => {
        const e = vscode.window.activeTextEditor;
        return e && e.document.languageId === 'markdown' ? e : undefined;
    };

    reg('markdownToolbar.openCodexSidebar', async () => {
        try {
            await vscode.commands.executeCommand('chatgpt.openSidebar');
        } catch {
            void vscode.window.showWarningMessage(
                'Open Codex Sidebar requires the Codex extension from OpenAI to be installed and enabled.'
            );
        }
    });

    // Inline formatting
    reg('markdownToolbar.bold', () => {
        const e = getEditor(); if (e) { applyInlineWrap(e, { prefix: '**', suffix: '**' }); }
    });
    reg('markdownToolbar.italic', () => {
        const e = getEditor(); if (e) { applyInlineWrap(e, { prefix: '*', suffix: '*' }); }
    });
    reg('markdownToolbar.inlineCode', () => {
        const e = getEditor(); if (e) { applyInlineWrap(e, { prefix: '`', suffix: '`' }); }
    });
    reg('markdownToolbar.strikethrough', () => {
        const e = getEditor(); if (e) { applyInlineWrap(e, { prefix: '~~', suffix: '~~' }); }
    });
    reg('markdownToolbar.inlineMath', () => {
        const e = getEditor(); if (e) { applyInlineWrap(e, { prefix: '$', suffix: '$' }); }
    });

    // Line-based formatting
    reg('markdownToolbar.heading1', () => {
        const e = getEditor(); if (e) { applyLineTransform(e, makeHeadingTransform('# ')); }
    });
    reg('markdownToolbar.heading2', () => {
        const e = getEditor(); if (e) { applyLineTransform(e, makeHeadingTransform('## ')); }
    });
    reg('markdownToolbar.heading3', () => {
        const e = getEditor(); if (e) { applyLineTransform(e, makeHeadingTransform('### ')); }
    });
    reg('markdownToolbar.quote', () => {
        const e = getEditor(); if (e) { applyLineTransform(e, makeTogglePrefixTransform('> ')); }
    });
    reg('markdownToolbar.unorderedList', () => {
        const e = getEditor(); if (e) { applyLineTransform(e, makeTogglePrefixTransform('- ')); }
    });
    reg('markdownToolbar.taskListUnchecked', () => {
        const e = getEditor(); if (e) { applyLineTransform(e, makeTaskTransform(false)); }
    });
    reg('markdownToolbar.taskListChecked', () => {
        const e = getEditor(); if (e) { applyLineTransform(e, makeTaskTransform(true)); }
    });
    reg('markdownToolbar.orderedList', () => {
        const e = getEditor(); if (e) { applyOrderedList(e); }
    });

    // Complex insertions
    reg('markdownToolbar.link', () => {
        const e = getEditor(); if (e) { insertLink(e); }
    });
    reg('markdownToolbar.image', () => {
        const e = getEditor(); if (e) { insertImage(e); }
    });
    reg('markdownToolbar.codeBlock', () => {
        const e = getEditor(); if (e) { insertCodeBlock(e); }
    });
    reg('markdownToolbar.blockMath', () => {
        const e = getEditor(); if (e) { insertBlockMath(e); }
    });
    reg('markdownToolbar.table', () => {
        const e = getEditor(); if (e) { insertTable(e); }
    });
    reg('markdownToolbar.horizontalRule', () => {
        const e = getEditor(); if (e) { insertHorizontalRule(e); }
    });

    // Utility
    reg('markdownToolbar.updateSectionNumbers', () => {
        const e = getEditor(); if (e) { updateSectionNumbers(e); }
    });
    reg('markdownToolbar.updateListNumbers', () => {
        const e = getEditor(); if (e) { updateListNumbers(e); }
    });
}

export function deactivate(): void { /* nothing to clean up */ }
