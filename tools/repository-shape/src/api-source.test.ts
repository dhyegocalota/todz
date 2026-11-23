import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles } from './repository-files';

const API_SOURCE_FOLDER = 'apps/api/src';
const ROUTING_MODULE = 'apps/api/src/project-routing.ts';
const CONSOLE_CALL = 'console.';
const PROJECT_STORE_MEMBER = 'PROJECT_STORE.';

const sourceFiles = repositoryFiles(API_SOURCE_FOLDER);

function filesContaining(text: string): string[] {
  return sourceFiles.filter((path) => readRepositoryFile(path).includes(text));
}

describe('the api source', () => {
  test('the repository has api source files to check', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  test('no file calls console, so no log carries a task, a secret or a digest', () => {
    expect(filesContaining(CONSOLE_CALL)).toEqual([]);
  });

  test('only the routing module reads a member of the project store namespace', () => {
    expect(filesContaining(PROJECT_STORE_MEMBER).filter((path) => path !== ROUTING_MODULE)).toEqual([]);
  });
});
