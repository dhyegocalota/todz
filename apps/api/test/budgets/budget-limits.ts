import { ClientEra } from '../mcp-client';

export type WorkBudget = { roundTrips: number; statements: number; projectCalls: number };

export enum RowsReadUseCase {
  Add = 'add',
  UpdateFirst = 'update first',
  UpdateLast = 'update last',
  UpdateBefore = 'update before',
  UpdateAfter = 'update after',
  ListOpen = 'list open',
  Next = 'next',
  DueNow = 'due now',
  ReadChanges = 'read changes from 0',
  ReadHistory = 'read history',
}

export const OWNER_PROJECT_ROUTE_BUDGET: WorkBudget = { roundTrips: 1, statements: 1, projectCalls: 1 };
export const OWNER_WORKSPACE_LIST_BUDGET: WorkBudget = { roundTrips: 3, statements: 3, projectCalls: 0 };

export const DAY_EMAIL_TICK_BUDGET: WorkBudget = { roundTrips: 2, statements: 5, projectCalls: 0 };
export const DAY_EMAIL_OWNER_BUDGET: WorkBudget = { roundTrips: 6, statements: 6, projectCalls: 0 };
export const DAY_EMAIL_REPLY_BUDGET: WorkBudget = { roundTrips: 4, statements: 4, projectCalls: 1 };

export const MCP_LIST_BUDGET_OF_ERA: Record<ClientEra, WorkBudget> = {
  [ClientEra.Legacy]: { roundTrips: 1, statements: 2, projectCalls: 1 },
  [ClientEra.Modern]: { roundTrips: 1, statements: 1, projectCalls: 1 },
};

export const MCP_NEXT_NUDGED_BUDGET_OF_ERA: Record<ClientEra, WorkBudget> = {
  [ClientEra.Legacy]: { roundTrips: 1, statements: 2, projectCalls: 2 },
  [ClientEra.Modern]: { roundTrips: 1, statements: 1, projectCalls: 2 },
};

export const ROWS_READ_BUDGET: Record<RowsReadUseCase, number> = {
  [RowsReadUseCase.Add]: 10,
  [RowsReadUseCase.UpdateFirst]: 10,
  [RowsReadUseCase.UpdateLast]: 10,
  [RowsReadUseCase.UpdateBefore]: 10,
  [RowsReadUseCase.UpdateAfter]: 10,
  [RowsReadUseCase.ListOpen]: 105,
  [RowsReadUseCase.Next]: 105,
  [RowsReadUseCase.DueNow]: 105,
  [RowsReadUseCase.ReadChanges]: 113,
  [RowsReadUseCase.ReadHistory]: 7,
};
