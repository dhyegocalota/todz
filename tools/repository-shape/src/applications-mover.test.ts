import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const RUN_TESTS = 'apps/macos/TodzKit/Tests/TodzKitTests/ApplicationsMoveRunTests.swift';
const SCRATCH_SYSTEM = 'apps/macos/TodzKit/Tests/TodzKitTests/ScratchApplicationsMoveSystem.swift';
const OFFER = 'apps/macos/Todz/Updates/ApplicationsMoveOffer.swift';
const SYSTEM_APPLICATIONS_FOLDER = '/Applications';
const COMPILE_TIME_DEBUG_GATE = '#if DEBUG\nprivate let isDebugBuild = true';
const DEBUG_ARGUMENT = 'isDebugBuild: isDebugBuild';

describe('the Applications mover', () => {
  test.each([RUN_TESTS, SCRATCH_SYSTEM])('%s never points at the system Applications folder', (path) => {
    expect(readRepositoryFile(path)).not.toContain(SYSTEM_APPLICATIONS_FOLDER);
  });

  test('the offer is gated on a compile-time Debug check', () => {
    const offer = readRepositoryFile(OFFER);
    expect(offer).toContain(COMPILE_TIME_DEBUG_GATE);
    expect(offer).toContain(DEBUG_ARGUMENT);
  });
});
