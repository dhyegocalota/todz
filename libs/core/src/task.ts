import type { ActorKind, DueWindow, HistoryAction, TaskField, TaskPlacement, TaskState } from '@todz/types';

export type CalendarDate = string & { readonly calendarDate: unique symbol };

export type Actor = { kind: ActorKind.Owner } | { kind: ActorKind.Agent; clientName: string };

export type Task = {
  number: number;
  title: string;
  notes: string | null;
  dueDate: CalendarDate | null;
  state: TaskState;
  orderKey: string;
  idempotencyKey: string | null;
  createdBy: Actor;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};

export type HistoryEntry = {
  at: number;
  actor: Actor;
  action: HistoryAction;
  fields: TaskField[];
  note: string | null;
};

export type TaskDraft = {
  title: string;
  notes: string | null;
  dueDate: string | null;
  idempotencyKey: string | null;
};

export type Placement =
  | { kind: TaskPlacement.First }
  | { kind: TaskPlacement.Last }
  | { kind: TaskPlacement.Before; anchor: number }
  | { kind: TaskPlacement.After; anchor: number };

export type TaskPatch = {
  title?: string;
  notes?: string | null;
  dueDate?: string | null;
  placement?: Placement;
};

export type TaskFilter = {
  state: TaskState;
  dueWindows: DueWindow[];
  text: string | null;
  limit: number;
};
