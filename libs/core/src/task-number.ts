import { RuleIssue } from '@todz/types';
import { RuleViolation } from './errors';
import { FIRST_TASK_NUMBER } from './project-tasks';

export function assertTaskNumber(number: number): void {
  const isTaskNumber = Number.isSafeInteger(number) && number >= FIRST_TASK_NUMBER;
  if (!isTaskNumber) throw new RuleViolation({ issue: RuleIssue.TaskNumberInvalid });
}
