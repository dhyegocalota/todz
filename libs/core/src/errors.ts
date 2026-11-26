import type { FairUseLimit, RuleIssue } from '@todz/types';
import { formatShortId } from './short-id';

export class RuleViolation extends Error {
  readonly issue: RuleIssue;
  readonly index: number | null;

  constructor({ issue, index = null }: { issue: RuleIssue; index?: number | null }) {
    super(issue);
    this.name = 'RuleViolation';
    this.issue = issue;
    this.index = index;
  }
}

export class LimitViolation extends Error {
  readonly limit: FairUseLimit;

  constructor({ limit }: { limit: FairUseLimit }) {
    super(limit);
    this.name = 'LimitViolation';
    this.limit = limit;
  }
}

export class TaskNotFoundError extends Error {
  readonly number: number;

  constructor(number: number) {
    super(formatShortId(number));
    this.name = 'TaskNotFoundError';
    this.number = number;
  }
}

export function atBatchIndex<Result>({ index, run }: { index: number; run: () => Result }): Result {
  try {
    return run();
  } catch (error) {
    if (!(error instanceof RuleViolation)) throw error;
    throw new RuleViolation({ issue: error.issue, index });
  }
}
