import type { RuleIssue } from '@todz/types';
import { RuleViolation, TaskNotFoundError } from './errors';
import type { Clock } from './ports';
import type { CalendarDate } from './task';

export const CLOCK_NOW = 1_795_446_000_000;
export const TODAY = '2026-11-23' as CalendarDate;

export function fixedClock(now: number): Clock {
  return { now: () => now };
}

function captureError<ErrorInstance extends Error>({
  run,
  errorClass,
}: {
  run: () => unknown;
  errorClass: new (...parameters: never[]) => ErrorInstance;
}): ErrorInstance {
  try {
    run();
  } catch (error) {
    if (error instanceof errorClass) return error;
    throw error;
  }
  throw new Error(`expected ${errorClass.name}`);
}

export function captureViolation(run: () => unknown): RuleViolation {
  return captureError({ run, errorClass: RuleViolation });
}

export function captureNotFound(run: () => unknown): TaskNotFoundError {
  return captureError({ run, errorClass: TaskNotFoundError });
}

export function violationIssueOf(run: () => unknown): RuleIssue {
  return captureViolation(run).issue;
}

export function violationMessageOf(run: () => unknown): string {
  return captureViolation(run).message;
}
