import { type SessionHandler, unbuiltHandler } from './owner-request';
import { OwnerRoute } from './owner-routes';
import { addTasks, completeTasks, readHistory, reopenTasks, updateTask } from './owner-task-writes';

type TaskRoute =
  | OwnerRoute.AddTasks
  | OwnerRoute.UpdateTask
  | OwnerRoute.CompleteTasks
  | OwnerRoute.ReopenTasks
  | OwnerRoute.ReadHistory
  | OwnerRoute.ReadChanges
  | OwnerRoute.WatchChanges;

export const TASK_HANDLERS: Record<TaskRoute, SessionHandler> = {
  [OwnerRoute.AddTasks]: addTasks,
  [OwnerRoute.UpdateTask]: updateTask,
  [OwnerRoute.CompleteTasks]: completeTasks,
  [OwnerRoute.ReopenTasks]: reopenTasks,
  [OwnerRoute.ReadHistory]: readHistory,
  [OwnerRoute.ReadChanges]: unbuiltHandler,
  [OwnerRoute.WatchChanges]: unbuiltHandler,
};
