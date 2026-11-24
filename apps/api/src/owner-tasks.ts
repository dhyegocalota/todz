import { type SessionHandler, unbuiltHandler } from './owner-request';
import { OwnerRoute } from './owner-routes';

type TaskRoute =
  | OwnerRoute.AddTasks
  | OwnerRoute.UpdateTask
  | OwnerRoute.CompleteTasks
  | OwnerRoute.ReopenTasks
  | OwnerRoute.ReadHistory
  | OwnerRoute.ReadChanges
  | OwnerRoute.WatchChanges;

export const TASK_HANDLERS: Record<TaskRoute, SessionHandler> = {
  [OwnerRoute.AddTasks]: unbuiltHandler,
  [OwnerRoute.UpdateTask]: unbuiltHandler,
  [OwnerRoute.CompleteTasks]: unbuiltHandler,
  [OwnerRoute.ReopenTasks]: unbuiltHandler,
  [OwnerRoute.ReadHistory]: unbuiltHandler,
  [OwnerRoute.ReadChanges]: unbuiltHandler,
  [OwnerRoute.WatchChanges]: unbuiltHandler,
};
