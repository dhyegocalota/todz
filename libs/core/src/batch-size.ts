import { RuleIssue, TASK_BATCH_MAX_SIZE } from '@todz/types';
import { RuleViolation } from './errors';

export function assertBatchSize(size: number): void {
  if (size === 0) throw new RuleViolation({ issue: RuleIssue.BatchEmpty });
  if (size > TASK_BATCH_MAX_SIZE) throw new RuleViolation({ issue: RuleIssue.BatchTooLarge });
}
