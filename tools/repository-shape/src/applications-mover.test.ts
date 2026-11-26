import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles } from './repository-files';

const MOVER_TESTS_PATHSPEC = 'apps/macos/TodzKit/Tests/TodzKitTests/*Application*Move*.swift';
const OFFER = 'apps/macos/Todz/Updates/ApplicationsMoveOffer.swift';
const SYSTEM_APPLICATIONS_FOLDER = '/Applications';
const DESTINATION_FOLDER_SYMBOL = 'ApplicationsMove.destinationFolderPath';
const COMPILE_TIME_DEBUG_GATE = '#if DEBUG\nprivate let isDebugBuild = true';
const DEBUG_ARGUMENT = 'isDebugBuild: isDebugBuild';
const LAUNCH_ACTIVATION = 'NSApp.activate';
const MOVE_KEY_EQUIVALENT = 'keyEquivalent';

describe('the Applications mover', () => {
  const moverTests = repositoryFiles(MOVER_TESTS_PATHSPEC).filter((path) => !path.endsWith('ApplicationsMoveTests.swift'));

  test('the mover tests are found', () => {
    expect(moverTests.length).toBeGreaterThan(1);
  });

  test.each(moverTests)('%s never points at the system Applications folder', (path) => {
    expect(readRepositoryFile(path)).not.toContain(SYSTEM_APPLICATIONS_FOLDER);
  });

  test('no test file names the destination folder constant', () => {
    const testFiles = repositoryFiles('apps/macos/TodzKit/Tests/TodzKitTests/*.swift');
    expect(testFiles.filter((path) => readRepositoryFile(path).includes(DESTINATION_FOLDER_SYMBOL))).toEqual([]);
  });

  test('the offer is gated on a compile-time Debug check', () => {
    const offer = readRepositoryFile(OFFER);
    expect(offer).toContain(COMPILE_TIME_DEBUG_GATE);
    expect(offer).toContain(DEBUG_ARGUMENT);
  });

  test('the offer never takes the foreground at launch and gives no button a key equivalent', () => {
    const offer = readRepositoryFile(OFFER);
    expect(offer).not.toContain(LAUNCH_ACTIVATION);
    expect(offer).not.toContain(MOVE_KEY_EQUIVALENT);
  });
});
