# Changelog

## v1.0.8

- Improved `Update Section Numbers` logic:
  - Preserved `H1` as the unnumbered document title (automatically cleans old numbering on H1).
  - Numbered sections starting from `H2` (`1.`, `2.`, etc.) with standard trailing dot formatting.
  - Formatted nested sub-sections (`H3`–`H6`) with hierarchical dot separators (e.g. `1.1`, `1.1.1`).
  - Added full test suite covering multi-level section numbering and H1 resetting.

## v1.0.7

- Updated README with direct installation links to VS Code Marketplace and Open VSX Registry.
- Improved documentation layout and clarity.

## v1.0.6

- Refined extension display name and keywords in `package.json` for better marketplace discoverability.

## v1.0.5

- Polished README title and documentation presentation.

## v1.0.4

- Updated extension screenshots showcasing the toolbar and expanded `More` context submenu.
- Refined README structure and visual workflow examples.

## v1.0.3

- Redesigned and streamlined the right-click context menu.
- Removed extraneous sidebar command entries.
- Improved submenu command hierarchy and keybinding mappings.

## v1.0.0

- Initial release.
- Markdown formatting toolbar in the editor title bar.
- Right-click context menu with `Bold`, `Italic`, `Link`, and a nested `More` submenu.
- Keyboard shortcuts for formatting actions (`Ctrl+B`, `Ctrl+I`, `Ctrl+K`, and `Ctrl+M` chords).
- Toggle-aware inline formatting (bold, italic, strikethrough, inline code, inline math).
- Line-based transforms for headings, quotes, tasks, and lists.
- Insert helpers for code blocks, LaTeX math blocks, tables, and horizontal rules.
- Utilities to update section numbers and ordered list numbers.
