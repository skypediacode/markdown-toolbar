export interface LineRange {
    startLine: number;
    endLine: number;
}

const headingPattern = /^(#{1,3})\s+(?:\d+(?:\.\d+)*\.?\s+)?(.+)$/;
const fencePattern = /^(\s*)(`{3,}|~{3,})/;
const orderedListPattern = /^(\s*)(\d+)\.\s+(.*)$/;

interface FenceState {
    marker: '`' | '~';
    length: number;
}

function normalizeRanges(lineCount: number, ranges?: LineRange[]): LineRange[] {
    if (!ranges || ranges.length === 0) {
        return [{ startLine: 0, endLine: Math.max(0, lineCount - 1) }];
    }

    const normalized = ranges
        .map(range => ({
            startLine: Math.max(0, range.startLine),
            endLine: Math.min(lineCount - 1, range.endLine)
        }))
        .filter(range => range.startLine <= range.endLine)
        .sort((a, b) => a.startLine - b.startLine);

    const merged: LineRange[] = [];
    for (const range of normalized) {
        const previous = merged[merged.length - 1];
        if (!previous || range.startLine > previous.endLine + 1) {
            merged.push({ ...range });
            continue;
        }

        previous.endLine = Math.max(previous.endLine, range.endLine);
    }

    return merged;
}

function getFenceStateBeforeLine(lines: string[], endLineExclusive: number): FenceState | null {
    let activeFence: FenceState | null = null;

    for (let i = 0; i < endLineExclusive; i++) {
        const fenceMatch = lines[i].match(fencePattern);
        if (!fenceMatch) {
            continue;
        }

        const marker = fenceMatch[2][0] as '`' | '~';
        const length = fenceMatch[2].length;

        if (!activeFence) {
            activeFence = { marker, length };
        } else if (activeFence.marker === marker && length >= activeFence.length) {
            activeFence = null;
        }
    }

    return activeFence;
}

function getLineRanges(text: string, ranges?: LineRange[]): { eol: string; lines: string[]; targetRanges: LineRange[] } {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const targetRanges = normalizeRanges(lines.length, ranges);
    return { eol, lines, targetRanges };
}

function getIndentWidth(indent: string): number {
    let width = 0;
    for (const char of indent) {
        width += char === '\t' ? 4 : 1;
    }
    return width;
}

function updateCounters(counters: number[], level: number): void {
    for (let i = 0; i < level - 1; i++) {
        if (counters[i] === 0) {
            counters[i] = 1;
        }
    }

    counters[level - 1]++;

    for (let i = level; i < counters.length; i++) {
        counters[i] = 0;
    }
}

function formatHeading(level: number, content: string, counters: number[]): string {
    const hashes = '#'.repeat(level);
    const section = counters.slice(0, level).join('.');
    return `${hashes} ${section} ${content}`;
}

export function renumberMarkdownHeadings(text: string, ranges?: LineRange[]): string {
    const { eol, lines, targetRanges } = getLineRanges(text, ranges);

    for (const range of targetRanges) {
        const counters = [0, 0, 0];
        let activeFence = getFenceStateBeforeLine(lines, range.startLine);

        for (let i = range.startLine; i <= range.endLine; i++) {
            const line = lines[i];
            const fenceMatch = line.match(fencePattern);

            if (fenceMatch) {
                const marker = fenceMatch[2][0] as '`' | '~';
                const length = fenceMatch[2].length;

                if (!activeFence) {
                    activeFence = { marker, length };
                } else if (activeFence.marker === marker && length >= activeFence.length) {
                    activeFence = null;
                }

                continue;
            }

            if (activeFence) {
                continue;
            }

            const headingMatch = line.match(headingPattern);
            if (!headingMatch) {
                continue;
            }

            const level = headingMatch[1].length;
            const content = headingMatch[2];

            updateCounters(counters, level);
            lines[i] = formatHeading(level, content, counters);
        }
    }

    return lines.join(eol);
}

export function renumberMarkdownOrderedLists(text: string, ranges?: LineRange[]): string {
    const { eol, lines, targetRanges } = getLineRanges(text, ranges);

    for (const range of targetRanges) {
        let activeFence = getFenceStateBeforeLine(lines, range.startLine);
        let counters: Array<{ indentWidth: number; value: number }> = [];

        for (let i = range.startLine; i <= range.endLine; i++) {
            const line = lines[i];
            const fenceMatch = line.match(fencePattern);

            if (fenceMatch) {
                const marker = fenceMatch[2][0] as '`' | '~';
                const length = fenceMatch[2].length;

                if (!activeFence) {
                    activeFence = { marker, length };
                } else if (activeFence.marker === marker && length >= activeFence.length) {
                    activeFence = null;
                }

                counters = [];
                continue;
            }

            if (activeFence) {
                continue;
            }

            const listMatch = line.match(orderedListPattern);
            if (!listMatch) {
                counters = [];
                continue;
            }

            const indent = listMatch[1];
            const content = listMatch[3];
            const indentWidth = getIndentWidth(indent);

            while (counters.length > 0 && indentWidth < counters[counters.length - 1].indentWidth) {
                counters.pop();
            }

            if (counters.length === 0 || indentWidth > counters[counters.length - 1].indentWidth) {
                counters.push({ indentWidth, value: 1 });
            } else {
                counters[counters.length - 1].value++;
            }

            lines[i] = `${indent}${counters[counters.length - 1].value}. ${content}`;
        }
    }

    return lines.join(eol);
}
