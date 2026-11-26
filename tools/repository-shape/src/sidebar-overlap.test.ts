import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const SIDEBAR_FILE = 'apps/macos/Todz/MainWindow/Sidebar/SidebarView.swift';
const STACK_WITH_HEADER =
  /VStack\(spacing: 0\) \{\s+WorkspaceSwitcher\(workspace: workspace, isMainWindow: true\)\s+list\s+NewProjectButton\(workspace: workspace\)\s+\}/;
const TRANSPARENT_INSET = '.safeAreaInset(';

describe('the sidebar workspace header', () => {
  test('is stacked above the list, so scrolling rows never pass under its name', () => {
    expect(readRepositoryFile(SIDEBAR_FILE)).toMatch(STACK_WITH_HEADER);
  });

  test('is never a transparent inset over the list', () => {
    expect(readRepositoryFile(SIDEBAR_FILE)).not.toContain(TRANSPARENT_INSET);
  });
});
