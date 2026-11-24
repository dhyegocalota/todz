import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles } from './repository-files';

const API_SOURCE_FOLDER = 'apps/api/src';
const ROUTING_MODULE = 'apps/api/src/project-routing.ts';
const ENV_MODULE = 'apps/api/src/env.ts';
const WRANGLER_CONFIGURATION = 'apps/api/wrangler.jsonc';
const SIGN_IN_PROVIDER_VARIABLE = 'SIGN_IN_PROVIDER';
const CONSOLE_IDENTIFIER = /\bconsole\b/;
const PROJECT_STORE_IDENTIFIER = /\bPROJECT_STORE\b/;

const sourceFiles = repositoryFiles(API_SOURCE_FOLDER);

function filesMatching(pattern: RegExp): string[] {
  return sourceFiles.filter((path) => pattern.test(readRepositoryFile(path)));
}

describe('the api source', () => {
  test('the repository has api source files to check', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  test('no file names console, so no log carries a task, a secret or a digest', () => {
    expect(filesMatching(CONSOLE_IDENTIFIER)).toEqual([]);
  });

  test('the wrangler configuration never names the sign-in provider, so a deployed worker has none', () => {
    expect(readRepositoryFile(WRANGLER_CONFIGURATION)).not.toContain(SIGN_IN_PROVIDER_VARIABLE);
  });

  test('only the routing module and the env type name the project store namespace', () => {
    expect(filesMatching(PROJECT_STORE_IDENTIFIER).filter((path) => ![ROUTING_MODULE, ENV_MODULE].includes(path))).toEqual([]);
  });
});
