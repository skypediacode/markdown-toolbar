const test = require('node:test');
const assert = require('node:assert/strict');
const {
    renumberMarkdownHeadings,
    renumberMarkdownOrderedLists
} = require('../out/sectionNumbering.js');

test('renumbers the whole document and skips fenced code blocks', () => {
    const input = [
        '# Intro',
        '## Background',
        '```ts',
        '## Not a heading',
        '```',
        '### Details',
        '# Next'
    ].join('\n');

    const output = renumberMarkdownHeadings(input);

    assert.equal(output, [
        '# 1 Intro',
        '## 1.1 Background',
        '```ts',
        '## Not a heading',
        '```',
        '### 1.1.1 Details',
        '# 2 Next'
    ].join('\n'));
});

test('renumbers only selected lines while preserving numbering context from earlier headings', () => {
    const input = [
        '# 1 Intro',
        '## 1.1 Overview',
        '## 9.9 Setup',
        '### 9.9.9 Nested',
        '# 2 Appendix'
    ].join('\n');

    const output = renumberMarkdownHeadings(input, [
        { startLine: 2, endLine: 3 }
    ]);

    assert.equal(output, [
        '# 1 Intro',
        '## 1.1 Overview',
        '## 1.1 Setup',
        '### 1.1.1 Nested',
        '# 2 Appendix'
    ].join('\n'));
});

test('treats each selected range independently and does not touch unselected headings', () => {
    const input = [
        '# 7 Intro',
        '## 7.1 A',
        'text',
        '## 8.9 B',
        '### 8.9.4 C'
    ].join('\n');

    const output = renumberMarkdownHeadings(input, [
        { startLine: 1, endLine: 1 },
        { startLine: 3, endLine: 4 }
    ]);

    assert.equal(output, [
        '# 7 Intro',
        '## 1.1 A',
        'text',
        '## 1.1 B',
        '### 1.1.1 C'
    ].join('\n'));
});

test('renumbers ordered lists for the whole document and skips fenced code blocks', () => {
    const input = [
        '1. first',
        '9. second',
        '   3. nested a',
        '   7. nested b',
        '',
        '```md',
        '5. leave me',
        '```',
        '',
        '8. third'
    ].join('\n');

    const output = renumberMarkdownOrderedLists(input);

    assert.equal(output, [
        '1. first',
        '2. second',
        '   1. nested a',
        '   2. nested b',
        '',
        '```md',
        '5. leave me',
        '```',
        '',
        '1. third'
    ].join('\n'));
});

test('renumbers ordered lists only inside the selected range', () => {
    const input = [
        '3. keep',
        '9. first',
        '4. second',
        '- bullet',
        '7. untouched'
    ].join('\n');

    const output = renumberMarkdownOrderedLists(input, [
        { startLine: 1, endLine: 2 }
    ]);

    assert.equal(output, [
        '3. keep',
        '1. first',
        '2. second',
        '- bullet',
        '7. untouched'
    ].join('\n'));
});
