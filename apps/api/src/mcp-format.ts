import type { AddedTask, CompletedTask, Task, TaskList } from '@todz/core';
import type { TaskState } from '@todz/types';
import type { ProjectFailure } from './project-result';

export function taskLine(task: Task): string {
  throw new Error('taskLine is not implemented');
}

export function taskBlock(task: Task): string {
  throw new Error('taskBlock is not implemented');
}

export function listAnswer({ state, list }: { state: TaskState; list: TaskList }): string {
  throw new Error('listAnswer is not implemented');
}

export function addedAnswer(added: AddedTask[]): string {
  throw new Error('addedAnswer is not implemented');
}

export function updatedAnswer(task: Task): string {
  throw new Error('updatedAnswer is not implemented');
}

export function completedAnswer(completed: CompletedTask[]): string {
  throw new Error('completedAnswer is not implemented');
}

export function nextAnswer(task: Task | null): string {
  throw new Error('nextAnswer is not implemented');
}

export function nextPromptText(task: Task | null): string {
  throw new Error('nextPromptText is not implemented');
}

export function failureText(failure: ProjectFailure): string {
  throw new Error('failureText is not implemented');
}
