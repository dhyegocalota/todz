import {
  FairUseLimit,
  OWNER_STORED_BYTES_MAX,
  OWNER_WRITES_PER_DAY_MAX,
  OWNER_WORKSPACES_MAX,
  PROJECT_OPEN_TASKS_MAX,
  SIGN_UPS_PER_CLIENT_DAY_MAX,
  WORKSPACE_PROJECTS_MAX,
} from '@todz/types';
import { describe, expect, test } from 'vitest';
import type { Env } from '../src/env';
import { fairUseLimitsOf } from '../src/fair-use-limits';

const DEFAULTS = {
  [FairUseLimit.Workspaces]: OWNER_WORKSPACES_MAX,
  [FairUseLimit.Projects]: WORKSPACE_PROJECTS_MAX,
  [FairUseLimit.OpenTasks]: PROJECT_OPEN_TASKS_MAX,
  [FairUseLimit.DailyWrites]: OWNER_WRITES_PER_DAY_MAX,
  [FairUseLimit.StoredBytes]: OWNER_STORED_BYTES_MAX,
  [FairUseLimit.DailySignUps]: SIGN_UPS_PER_CLIENT_DAY_MAX,
};

function envWith(vars: Partial<Env>): Env {
  return vars as Env;
}

describe('fairUseLimitsOf', () => {
  test('an unset environment keeps every default', () => {
    expect(fairUseLimitsOf(envWith({}))).toEqual(DEFAULTS);
  });

  test('a set positive whole number replaces only its own limit', () => {
    const limits = fairUseLimitsOf(envWith({ FAIR_USE_OPEN_TASKS_PER_PROJECT_MAX: '3' }));
    expect(limits[FairUseLimit.OpenTasks]).toBe(3);
    expect(limits[FairUseLimit.DailyWrites]).toBe(OWNER_WRITES_PER_DAY_MAX);
  });

  test.each(['0', '-1', '1.5', 'ten', ''])('the value %j is refused and names its variable', (value) => {
    expect(() => fairUseLimitsOf(envWith({ FAIR_USE_WRITES_PER_DAY_MAX: value }))).toThrow('FAIR_USE_WRITES_PER_DAY_MAX');
  });
});
