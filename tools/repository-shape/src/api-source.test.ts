import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles } from './repository-files';

const API_SOURCE_FOLDER = 'apps/api/src';
const ROUTING_MODULE = 'apps/api/src/project-routing.ts';
const ENV_MODULE = 'apps/api/src/env.ts';
const WRANGLER_CONFIGURATION = 'apps/api/wrangler.jsonc';
const SIGN_IN_PROVIDER_VARIABLE = 'SIGN_IN_PROVIDER';
const PACKAGE_MANIFEST = 'apps/api/package.json';
const DEV_SCRIPT = 'dev';
const MIGRATIONS_COMMAND = 'wrangler d1 migrations apply directory --local';
const DEV_COMMAND = 'wrangler dev';
const CONSOLE_IDENTIFIER = /\bconsole\b/;
const CONSOLE_EMAIL_SENDER = 'apps/api/src/email-sender.ts';
const PROJECT_STORE_IDENTIFIER = /\bPROJECT_STORE\b/;

const sourceFiles = repositoryFiles(API_SOURCE_FOLDER);

function filesMatching(pattern: RegExp): string[] {
  return sourceFiles.filter((path) => pattern.test(readRepositoryFile(path)));
}

describe('the api source', () => {
  test('the repository has api source files to check', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  test('only the development email sender names console, so no other log carries a task, a secret or a digest', () => {
    expect(filesMatching(CONSOLE_IDENTIFIER)).toEqual([CONSOLE_EMAIL_SENDER]);
  });

  test('the wrangler configuration never names the sign-in provider, so a deployed worker has none', () => {
    expect(readRepositoryFile(WRANGLER_CONFIGURATION)).not.toContain(SIGN_IN_PROVIDER_VARIABLE);
  });

  test('the dev script applies the directory migrations locally before it starts wrangler dev', () => {
    const { scripts } = JSON.parse(readRepositoryFile(PACKAGE_MANIFEST)) as { scripts: Record<string, string> };
    const devScript = scripts[DEV_SCRIPT];
    if (devScript === undefined) throw new Error('the api has no dev script');
    expect(devScript.indexOf(MIGRATIONS_COMMAND)).toBeGreaterThanOrEqual(0);
    expect(devScript.indexOf(MIGRATIONS_COMMAND)).toBeLessThan(devScript.indexOf(DEV_COMMAND));
  });

  test('only the routing module and the env type name the project store namespace', () => {
    expect(filesMatching(PROJECT_STORE_IDENTIFIER).filter((path) => ![ROUTING_MODULE, ENV_MODULE].includes(path))).toEqual([]);
  });
});
