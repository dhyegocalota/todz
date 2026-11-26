import { type TaskDraft, assertBatchSize, normalizeCompletionNote, normalizeNotes, normalizeTitle, validateDrafts } from '@todz/core';
import { type ProjectFailure, resultOf } from './project-result';

function failureOf(run: () => void): ProjectFailure | null {
  const result = resultOf(run);
  if (result.ok) return null;
  return result.failure;
}

export function draftsFailureOf(drafts: TaskDraft[]): ProjectFailure | null {
  return failureOf(() => validateDrafts(drafts));
}

export function fieldsFailureOf({ title, notes }: { title?: string; notes?: string | null }): ProjectFailure | null {
  return failureOf(() => {
    if (title !== undefined) normalizeTitle(title);
    if (notes !== undefined) normalizeNotes(notes);
  });
}

export function batchFailureOf(size: number): ProjectFailure | null {
  return failureOf(() => assertBatchSize(size));
}

export function completionFailureOf({ size, note }: { size: number; note: string | null }): ProjectFailure | null {
  return failureOf(() => {
    assertBatchSize(size);
    normalizeCompletionNote(note);
  });
}
