import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const SOURCE_ROOT = join(import.meta.dirname, '..', '..', 'src');
const RENDERING_IMPORT_PATTERN = /from ['"](react|react-dom|@react-email)(\/[^'"]*)?['"]/;
const TYPESCRIPT_FILE_PATTERN = /\.tsx?$/;

function sourceFilesOf(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesOf(path);
    return TYPESCRIPT_FILE_PATTERN.test(path) ? [path] : [];
  });
}

describe('the Worker source', () => {
  test('imports no React or React Email package, which render only at build time', () => {
    const renderingFiles = sourceFilesOf(SOURCE_ROOT).filter((path) => RENDERING_IMPORT_PATTERN.test(readFileSync(path, 'utf8')));
    expect(renderingFiles).toEqual([]);
  });

  test('flags a rendering import', () => {
    expect(RENDERING_IMPORT_PATTERN.test("import { render } from '@react-email/render';")).toBe(true);
  });
});
