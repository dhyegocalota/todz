import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const SOURCE_ROOT = join(import.meta.dirname, '..', '..', 'src');
const BUILD_TIME_IMPORT_PATTERN =
  /(from |import |import\(|require\()\s*['"](react|react-dom|react-email|@react-email|(\.\.?\/)+scripts)(\/[^'"]*)?['"]/;
const TYPESCRIPT_FILE_PATTERN = /\.tsx?$/;

function sourceFilesOf(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesOf(path);
    return TYPESCRIPT_FILE_PATTERN.test(path) ? [path] : [];
  });
}

describe('the Worker source', () => {
  test('imports no React, React Email or build script, which run only at build time', () => {
    const renderingFiles = sourceFilesOf(SOURCE_ROOT).filter((path) => BUILD_TIME_IMPORT_PATTERN.test(readFileSync(path, 'utf8')));
    expect(renderingFiles).toEqual([]);
  });

  test.each([
    "import { render } from '@react-email/render';",
    "import { Button } from 'react-email';",
    "import { createElement } from 'react';",
    "import 'react-dom';",
    "const render = await import('@react-email/render');",
    "const react = require('react');",
    "import { filledHtmlOf } from '../../scripts/emails/render-email';",
  ])('flags %s', (line) => {
    expect(BUILD_TIME_IMPORT_PATTERN.test(line)).toBe(true);
  });

  test('lets a Worker import through', () => {
    expect(BUILD_TIME_IMPORT_PATTERN.test("import { filledHtmlOf } from './email-slot';")).toBe(false);
  });
});
