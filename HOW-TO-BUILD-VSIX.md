# How to Build VSIX Package for Markdown Toolbar & Keyboard Shortcuts

This document provides step-by-step instructions on how to build and package this VS Code extension from source into a `.vsix` file.

## Prerequisites

Regardless of the packaging method you choose, you **must** have the following installed on your system:

- **Node.js** (v20.0.0 or higher is recommended) — required to compile TypeScript and run the packaging tools.
- **npm** (usually bundled with Node.js) — required to install dependencies and global packages.
- **Git** (to clone and manage the codebase)

---

## Step 1: Prepare the Project

Before packaging the extension, you must set up the project locally and compile the TypeScript code:

1. **Install Project Dependencies**:
   Open a terminal in the project root directory and run:

   ```bash
   npm install
   ```

2. **Compile the TypeScript Source**:
   The extension source code is written in TypeScript and must be compiled to JavaScript:

   ```bash
   npm run compile
   ```

   This creates the compiled JavaScript files in the `out/` directory.

3. **Run Tests (Optional)**:
   Ensure everything functions properly before packaging:
   ```bash
   npm test
   ```

---

## Step 2: Choose a Packaging Method

Once the code is compiled, you can package it into a `.vsix` file using one of the two methods below:

### Method 1: Local Packaging (Recommended)

This method uses the project's local developer dependencies. You do not need to install any additional global tools.

Run the packaging script defined in [package.json](file:///E:/myApps/markdown-toolbar/package.json):

```bash
npm run package
```

_Behind the scenes, this executes `vsce package --no-yarn --allow-missing-repository` using the project's locally installed `@vscode/vsce` package via npm scripts._

### Method 2: Global Packaging (Alternative)

This method installs the packaging tool globally on your system. This is useful if you package multiple extensions and prefer to use a single global tool.

1. **Install VSCE globally**:
   ```bash
   npm install -g @vscode/vsce
   ```
2. **Run VSCE package command**:
   ```bash
   vsce package --no-yarn --allow-missing-repository
   ```

---

## Output

Both methods will produce a file named `markdown-toolbar-and-shortcuts-X.Y.Z.vsix` (e.g., `markdown-toolbar-and-shortcuts-1.0.7.vsix`) in the project root folder.

---

## How to Install the Built VSIX Package

Once you have generated the `.vsix` file, you can install it into VS Code in one of two ways:

### Command Line Interface (CLI)

Run the following command in your terminal, replacing the version number if necessary:

```bash
code --install-extension markdown-toolbar-and-shortcuts-1.0.7.vsix
```

### VS Code User Interface

1. Open Visual Studio Code.
2. Open the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Click the **...** (Views and More Actions) button at the top right of the Extensions panel.
4. Select **Install from VSIX...** from the dropdown menu.
5. Browse to the root of this project, select the generated `.vsix` file, and click **Install**.

---

## What is Included in the VSIX Package?

The packaging tool respects the configuration in [.vscodeignore](file:///E:/myApps/markdown-toolbar/.vscodeignore). The following files and directories are ignored and **not** included in the final `.vsix` bundle:

- Development files (TypeScript files `*.ts`, sourcemaps `*.map`, `tsconfig.json`)
- Git history (`.git`, `.gitignore`)
- Test suites (`test/`, `.vscode-test/`, `out/test/`)
- Documentation/prompt scratch files (`claude.md`, `prompt.md`)
- Temp directories and logs
