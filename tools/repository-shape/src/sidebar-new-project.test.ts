import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles, repositoryPath } from './repository-files';
import { swiftCopyValue } from './swift-copy';

const MAIN_WINDOW_COPY_FILE = 'apps/macos/Copy/MainWindowCopy.swift';
const ACCESSIBILITY_COPY_FILE = 'apps/macos/Copy/AccessibilityCopy.swift';
const SIDEBAR_FILE = 'apps/macos/Todz/MainWindow/Sidebar/SidebarView.swift';
const NEW_PROJECT_BUTTON_FILE = 'apps/macos/Todz/MainWindow/Sidebar/NewProjectButton.swift';
const PROJECTS_HEADER_FILE = 'apps/macos/Todz/MainWindow/Sidebar/ProjectsHeader.swift';
const APP_COMMANDS_FILE = 'apps/macos/Todz/AppCommands.swift';
const APP_SOURCES_FOLDER = 'apps/macos';
const SWIFT_EXTENSION = '.swift';
const PROJECTS_HEADER = 'ProjectsHeader';
const NEW_PROJECT_HELP = '"Adds a project to \\(workspaceName)"';
const NEW_PROJECT_SHORTCUT = '.keyboardShortcut(newKey, modifiers: [.command, .shift])';
const MENU_ITEM_WITH_SHORTCUT =
  /Button\(MainWindowCopy\.newProject\) \{ windowState\.sheet = \.newProject \}\s+\.keyboardShortcut\(newKey, modifiers: \[\.command, \.shift\]\)/;
const STACKED_FOOTER = /VStack\(spacing: 0\) \{\s+list\s+NewProjectButton\(workspace: workspace\)\s+\}/;
const PADDED_CONTENT_SHAPE = /\.padding\(\)\s+\.frame\(maxWidth: \.infinity, alignment: \.leading\)\s+\.contentShape\(\.rect\)/;
const BUTTON_PIECES = [
  'windowState.sheet = .newProject',
  'Color.accentColor',
  '.help(MainWindowCopy.newProjectHelp(workspaceName: workspace.name))',
  '.accessibilityHint(MainWindowCopy.newProjectHelp(workspaceName: workspace.name))',
  '.disabled(!model.isReady)',
  '.contentShape(.rect)',
  '.todzAnimation(.snap, value: isHovering)',
];

function appSwiftSources(): string[] {
  return repositoryFiles(APP_SOURCES_FOLDER).filter((path) => path.endsWith(SWIFT_EXTENSION));
}

function occurrences({ text, piece }: { text: string; piece: string }): number {
  return text.split(piece).length - 1;
}

describe('the sidebar New Project button', () => {
  test('the copy names the button New Project and the help names the workspace', () => {
    const copy = readRepositoryFile(MAIN_WINDOW_COPY_FILE);
    expect(swiftCopyValue({ text: copy, name: 'newProjectButton' })).toBe('New Project');
    expect(copy).toContain('static func newProjectHelp(workspaceName: String) -> String');
    expect(copy).toContain(NEW_PROJECT_HELP);
  });

  test('the sidebar stacks the button under the list, never over its rows, and heads Projects with plain text', () => {
    const sidebar = readRepositoryFile(SIDEBAR_FILE);
    expect(sidebar).toMatch(STACKED_FOOTER);
    expect(sidebar).not.toContain('.safeAreaInset(edge: .bottom)');
    expect(sidebar).toContain('Text(MainWindowCopy.projects)');
  });

  test.each(BUTTON_PIECES)('the button carries %s', (piece) => {
    expect(readRepositoryFile(NEW_PROJECT_BUTTON_FILE)).toContain(piece);
  });

  test('the whole footer strip is the click target: the padding sits inside the content shape', () => {
    expect(readRepositoryFile(NEW_PROJECT_BUTTON_FILE)).toMatch(PADDED_CONTENT_SHAPE);
  });

  test('the button is never hidden and repeats no shortcut', () => {
    const button = readRepositoryFile(NEW_PROJECT_BUTTON_FILE);
    expect(button).not.toContain('.opacity(');
    expect(button).not.toContain('.keyboardShortcut(');
  });

  test('the hover-only Projects header is gone with its accessibility label', () => {
    expect(existsSync(repositoryPath(PROJECTS_HEADER_FILE))).toBe(false);
    expect(appSwiftSources().filter((path) => readRepositoryFile(path).includes(PROJECTS_HEADER))).toEqual([]);
    expect(readRepositoryFile(ACCESSIBILITY_COPY_FILE)).not.toContain('addProject');
  });

  test('shift command N stays the File menu New Project, bound once (pin)', () => {
    const commands = readRepositoryFile(APP_COMMANDS_FILE);
    expect(commands).toMatch(MENU_ITEM_WITH_SHORTCUT);
    const bindings = appSwiftSources().map((path) => occurrences({ text: readRepositoryFile(path), piece: NEW_PROJECT_SHORTCUT }));
    expect(bindings.reduce((total, count) => total + count, 0)).toBe(1);
  });
});
