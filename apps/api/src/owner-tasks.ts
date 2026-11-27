import { readChanges, watchChanges } from './owner-changes';
import type { SessionHandler } from './owner-request';
import { OwnerRoute } from './owner-routes';
import { addTasks, completeTasks, deleteTask, readHistory, reopenTasks, updateTask } from './owner-task-writes';

type TaskRoute =
  | OwnerRoute.AddTasks
  | OwnerRoute.UpdateTask
  | OwnerRoute.DeleteTask
  | OwnerRoute.CompleteTasks
  | OwnerRoute.ReopenTasks
  | OwnerRoute.ReadHistory
  | OwnerRoute.ReadChanges
  | OwnerRoute.WatchChanges;

export const TASK_HANDLERS: Record<TaskRoute, SessionHandler> = {
  [OwnerRoute.AddTasks]: addTasks,
  [OwnerRoute.UpdateTask]: updateTask,
  [OwnerRoute.DeleteTask]: deleteTask,
  [OwnerRoute.CompleteTasks]: completeTasks,
  [OwnerRoute.ReopenTasks]: reopenTasks,
  [OwnerRoute.ReadHistory]: readHistory,
  [OwnerRoute.ReadChanges]: readChanges,
  [OwnerRoute.WatchChanges]: watchChanges,
};
