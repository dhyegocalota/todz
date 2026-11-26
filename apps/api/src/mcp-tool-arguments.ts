import { type Placement, type TaskDraft, type TaskPatch, parseShortId } from '@todz/core';
import { DueWindow, LIST_LIMIT_DEFAULT, TaskPlacement, TaskState } from '@todz/types';
import { z } from 'zod';
import { MCP_COPY } from './mcp-copy';
import { MOVE_KEY_PREFIX } from './move-task';
import { fieldPatchOf } from './task-field-patch';

function isFreeKey(key: string): boolean {
  return !key.startsWith(MOVE_KEY_PREFIX);
}

export const AddArgumentsSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().describe(MCP_COPY.fields.title),
      notes: z.string().nullable().default(null).describe(MCP_COPY.fields.notes),
      due_date: z.string().nullable().default(null).describe(MCP_COPY.fields.dueDate),
      idempotency_key: z.string().refine(isFreeKey, MCP_COPY.reservedKey).nullable().default(null).describe(MCP_COPY.fields.idempotencyKey),
    }),
  ),
});

export const ListArgumentsSchema = z.object({
  state: z.enum(TaskState).default(TaskState.Open).describe(MCP_COPY.fields.state),
  due: z.array(z.enum(DueWindow)).default([]).describe(MCP_COPY.fields.due),
  text: z.string().nullable().default(null).describe(MCP_COPY.fields.text),
  limit: z.number().int().default(LIST_LIMIT_DEFAULT).describe(MCP_COPY.fields.limit),
});

const PlacementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum([TaskPlacement.First, TaskPlacement.Last]) }),
  z.object({ kind: z.enum([TaskPlacement.Before, TaskPlacement.After]), anchor: z.string() }),
]);

export const UpdateArgumentsSchema = z.object({
  id: z.string().describe(MCP_COPY.fields.id),
  title: z.string().optional().describe(MCP_COPY.fields.title),
  notes: z.string().nullable().optional().describe(MCP_COPY.fields.notes),
  due_date: z.string().nullable().optional().describe(MCP_COPY.fields.dueDate),
  placement: PlacementSchema.optional().describe(MCP_COPY.fields.placement),
});

export const DoneArgumentsSchema = z.object({
  ids: z.array(z.string()).describe(MCP_COPY.fields.ids),
  note: z.string().nullable().default(null).describe(MCP_COPY.fields.note),
});

export const ShowArgumentsSchema = z.object({
  id: z.string().describe(MCP_COPY.fields.id),
});

export const HistoryArgumentsSchema = z.object({
  id: z.string().describe(MCP_COPY.fields.id),
});

export const ReopenArgumentsSchema = z.object({
  ids: z.array(z.string()).describe(MCP_COPY.fields.ids),
});

export const DeleteArgumentsSchema = z.object({
  id: z.string().describe(MCP_COPY.fields.id),
  confirm: z.string().describe(MCP_COPY.fields.confirm),
});

export const MoveArgumentsSchema = z.object({
  id: z.string().describe(MCP_COPY.fields.id),
  project: z.string().describe(MCP_COPY.fields.project),
});

type AddArguments = z.infer<typeof AddArgumentsSchema>;
type UpdateArguments = z.infer<typeof UpdateArgumentsSchema>;
type PlacementArgument = z.infer<typeof PlacementSchema>;

function placementOf(placement: PlacementArgument): Placement | null {
  if (!('anchor' in placement)) return { kind: placement.kind };
  const anchor = parseShortId(placement.anchor);
  if (anchor === null) return null;
  return { kind: placement.kind, anchor };
}

export function draftsOf({ tasks }: AddArguments): TaskDraft[] {
  return tasks.map((task) => ({ title: task.title, notes: task.notes, dueDate: task.due_date, idempotencyKey: task.idempotency_key }));
}

export function taskNumbers(ids: string[]): number[] | null {
  const numbers = ids.map(parseShortId).filter((number) => number !== null);
  if (numbers.length !== ids.length) return null;
  return numbers;
}

export function patchOf(args: UpdateArguments): TaskPatch | null {
  const fields = fieldPatchOf(args);
  if (args.placement === undefined) return fields;
  const placement = placementOf(args.placement);
  if (placement === null) return null;
  return { ...fields, placement };
}
