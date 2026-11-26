import { readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const SWIFT_TESTS_DIRECTORY = 'apps/macos/TodzKit/Tests/TodzKitTests';
const HOSTED_RUNNER_HELPER = `${SWIFT_TESTS_DIRECTORY}/HostedRunner.swift`;
const HOSTED_RUNNER_DEFINITION = 'environment[hostedRunnerVariable] == hostedRunnerValue';
const HOSTED_RUNNER_VARIABLE = 'private let hostedRunnerVariable = "GITHUB_ACTIONS"';
const HOSTED_RUNNER_VALUE = 'private let hostedRunnerValue = "true"';
const SWIFT_EXTENSION = '.swift';
const BUDGET_TEST_PATTERN = /^ *@Test(\([^\n]*\))? func \w*WithinTheBudget\(/gm;
const HOSTED_RUNNER_GATE = '.enabled(if: !isOnHostedRunner)';

function budgetTestDeclarations(): string[] {
  return readdirSync(repositoryPath(SWIFT_TESTS_DIRECTORY))
    .filter((name) => name.endsWith(SWIFT_EXTENSION))
    .flatMap((name) => {
      const path = posix.join(SWIFT_TESTS_DIRECTORY, name);
      return [...readRepositoryFile(path).matchAll(BUDGET_TEST_PATTERN)].map(([declaration]) => `${path}: ${declaration.trim()}`);
    });
}

describe('Swift timing budget tests', () => {
  test('the hosted runner helper reads GITHUB_ACTIONS and compares it with true', () => {
    const helper = readRepositoryFile(HOSTED_RUNNER_HELPER);
    expect([HOSTED_RUNNER_VARIABLE, HOSTED_RUNNER_VALUE, HOSTED_RUNNER_DEFINITION].filter((line) => !helper.includes(line))).toEqual([]);
  });

  test('at least one budget test exists', () => {
    expect(budgetTestDeclarations().length).toBeGreaterThan(0);
  });

  test('every budget test is skipped on a hosted runner and runs locally', () => {
    const ungated = budgetTestDeclarations().filter((declaration) => !declaration.includes(HOSTED_RUNNER_GATE));
    expect(ungated).toEqual([]);
  });
});
