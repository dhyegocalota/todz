import { type SessionHandler, unbuiltHandler } from './owner-request';
import { OwnerRoute } from './owner-routes';

type WorkspaceRoute =
  OwnerRoute.ListWorkspaces | OwnerRoute.CreateWorkspace | OwnerRoute.RenameWorkspace | OwnerRoute.CreateProject | OwnerRoute.RenameProject;

export const WORKSPACE_HANDLERS: Record<WorkspaceRoute, SessionHandler> = {
  [OwnerRoute.ListWorkspaces]: unbuiltHandler,
  [OwnerRoute.CreateWorkspace]: unbuiltHandler,
  [OwnerRoute.RenameWorkspace]: unbuiltHandler,
  [OwnerRoute.CreateProject]: unbuiltHandler,
  [OwnerRoute.RenameProject]: unbuiltHandler,
};
