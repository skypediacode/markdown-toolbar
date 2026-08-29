const test = require('node:test');
const assert = require('node:assert/strict');
const {
    renumberMarkdownHeadings,
    renumberMarkdownOrderedLists
} = require('../out/sectionNumbering.js');

test('renumbers H2-H6 sections, keeps H1 as title, and skips fenced code blocks', () => {
    const input = [
        '# Document Title',
        '## Background',
        '```ts',
        '## Not a heading',
        '```',
        '### Details',
        '#### Deep Dive',
        '## Next Section',
        '### More Details'
    ].join('\n');

    const output = renumberMarkdownHeadings(input);

    assert.equal(output, [
        '# Document Title',
        '## 1. Background',
        '```ts',
        '## Not a heading',
        '```',
        '### 1.1 Details',
        '#### 1.1.1 Deep Dive',
        '## 2. Next Section',
        '### 2.1 More Details'
    ].join('\n'));
});

test('cleans existing numbers on H1 and updates H2-H4 numbers', () => {
    const input = [
        '# 1 Old Document Title',
        '## 1.1 Old Background',
        '### 1.1.1 Old Sub',
        '## 1.2 Another Section'
    ].join('\n');

    const output = renumberMarkdownHeadings(input);

    assert.equal(output, [
        '# Old Document Title',
        '## 1. Old Background',
        '### 1.1 Old Sub',
        '## 2. Another Section'
    ].join('\n'));
});

test('renumbers only selected lines', () => {
    const input = [
        '# Intro',
        '## 1. Overview',
        '## 9. Setup',
        '### 9.9 Nested',
        '## 2. Appendix'
    ].join('\n');

    const output = renumberMarkdownHeadings(input, [
        { startLine: 2, endLine: 3 }
    ]);

    assert.equal(output, [
        '# Intro',
        '## 1. Overview',
        '## 1. Setup',
        '### 1.1 Nested',
        '## 2. Appendix'
    ].join('\n'));
});

test('treats each selected range independently and does not touch unselected headings', () => {
    const input = [
        '## 7. Intro',
        '### 7.1 A',
        'text',
        '## 8. B',
        '### 8.9 C'
    ].join('\n');

    const output = renumberMarkdownHeadings(input, [
        { startLine: 1, endLine: 1 },
        { startLine: 3, endLine: 4 }
    ]);

    assert.equal(output, [
        '## 7. Intro',
        '### 1.1 A',
        'text',
        '## 1. B',
        '### 1.1 C'
    ].join('\n'));
});

test('resets counter on new H1 title sections', () => {
    const input = [
        '# Part 1',
        '## Overview',
        '## Details',
        '# Part 2',
        '## Summary'
    ].join('\n');

    const output = renumberMarkdownHeadings(input);

    assert.equal(output, [
        '# Part 1',
        '## 1. Overview',
        '## 2. Details',
        '# Part 2',
        '## 1. Summary'
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
