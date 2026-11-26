import {
  FairUseLimit,
  OWNER_STORED_BYTES_MAX,
  OWNER_WRITES_PER_DAY_MAX,
  OWNER_WORKSPACES_MAX,
  PROJECT_LIVE_KEYS_MAX,
  PROJECT_OPEN_TASKS_MAX,
  SIGN_UPS_PER_CLIENT_DAY_MAX,
  WORKSPACE_PROJECTS_MAX,
} from '@todz/types';
import type { Env } from './env';

export type FairUseLimits = Record<FairUseLimit, number>;

const POSITIVE_WHOLE_NUMBER_PATTERN = /^[1-9]\d*$/;

const VAR_OF_LIMIT = {
  [FairUseLimit.Workspaces]: 'FAIR_USE_WORKSPACES_MAX',
  [FairUseLimit.Projects]: 'FAIR_USE_PROJECTS_PER_WORKSPACE_MAX',
  [FairUseLimit.OpenTasks]: 'FAIR_USE_OPEN_TASKS_PER_PROJECT_MAX',
  [FairUseLimit.LiveKeys]: 'FAIR_USE_LIVE_KEYS_PER_PROJECT_MAX',
  [FairUseLimit.DailyWrites]: 'FAIR_USE_WRITES_PER_DAY_MAX',
  [FairUseLimit.StoredBytes]: 'FAIR_USE_STORED_BYTES_MAX',
  [FairUseLimit.DailySignUps]: 'FAIR_USE_SIGN_UPS_PER_CLIENT_DAY_MAX',
} as const satisfies Record<FairUseLimit, keyof Env>;

const DEFAULT_OF_LIMIT: FairUseLimits = {
  [FairUseLimit.Workspaces]: OWNER_WORKSPACES_MAX,
  [FairUseLimit.Projects]: WORKSPACE_PROJECTS_MAX,
  [FairUseLimit.OpenTasks]: PROJECT_OPEN_TASKS_MAX,
  [FairUseLimit.LiveKeys]: PROJECT_LIVE_KEYS_MAX,
  [FairUseLimit.DailyWrites]: OWNER_WRITES_PER_DAY_MAX,
  [FairUseLimit.StoredBytes]: OWNER_STORED_BYTES_MAX,
  [FairUseLimit.DailySignUps]: SIGN_UPS_PER_CLIENT_DAY_MAX,
};

function limitOf({ env, limit }: { env: Env; limit: FairUseLimit }): number {
  const variable = VAR_OF_LIMIT[limit];
  const configured = env[variable];
  if (configured === undefined) return DEFAULT_OF_LIMIT[limit];
  if (!POSITIVE_WHOLE_NUMBER_PATTERN.test(configured)) throw new Error(`${variable} must be a positive whole number`);
  return Number(configured);
}

export function fairUseLimitsOf(env: Env): FairUseLimits {
  return Object.fromEntries(Object.values(FairUseLimit).map((limit) => [limit, limitOf({ env, limit })])) as FairUseLimits;
}
