import type { Actor, AddedTask, CompletedTask, ReopenedTask, Task, TaskDraft, TaskFilter, TaskList, TaskPatch } from '@todz/core';
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import { applyProjectSchema } from './project-schema';
import type { ProjectResult } from './project-result';

export class ProjectStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => applyProjectSchema(ctx.storage.sql));
  }

  addTasks({ actor, drafts }: { actor: Actor; drafts: TaskDraft[] }): ProjectResult<AddedTask[]> {
    throw new Error('ProjectStore.addTasks is not implemented');
  }

  updateTask({ actor, number, patch }: { actor: Actor; number: number; patch: TaskPatch }): ProjectResult<Task> {
    throw new Error('ProjectStore.updateTask is not implemented');
  }

  completeTasks({ actor, numbers, note }: { actor: Actor; numbers: number[]; note: string | null }): ProjectResult<CompletedTask[]> {
    throw new Error('ProjectStore.completeTasks is not implemented');
  }

  reopenTasks({ actor, numbers }: { actor: Actor; numbers: number[] }): ProjectResult<ReopenedTask[]> {
    throw new Error('ProjectStore.reopenTasks is not implemented');
  }

  listTasks({ today, filter }: { today: string; filter: TaskFilter }): ProjectResult<TaskList> {
    throw new Error('ProjectStore.listTasks is not implemented');
  }

  nextTask({ today }: { today: string }): ProjectResult<Task | null> {
    throw new Error('ProjectStore.nextTask is not implemented');
  }
}
