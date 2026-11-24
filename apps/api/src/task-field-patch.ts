import type { TaskPatch } from '@todz/core';

type FieldArguments = { title?: string; notes?: string | null; due_date?: string | null };

export function fieldPatchOf(fields: FieldArguments): TaskPatch {
  return {
    ...('title' in fields && { title: fields.title }),
    ...('notes' in fields && { notes: fields.notes }),
    ...('due_date' in fields && { dueDate: fields.due_date }),
  };
}
