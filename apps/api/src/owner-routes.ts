import { HttpMethod } from './http-method';

export enum RouteParam {
  WorkspaceId = 'workspaceId',
  ProjectId = 'projectId',
  Number = 'number',
  KeyId = 'keyId',
  ConnectedAppId = 'connectedAppId',
}

export enum OwnerRoute {
  SignIn = 'sign_in',
  ReadSignInMethod = 'read_sign_in_method',
  RequestSignInLink = 'request_sign_in_link',
  SignOut = 'sign_out',
  ReadOwner = 'read_owner',
  UpdateOwner = 'update_owner',
  ListWorkspaces = 'list_workspaces',
  CreateWorkspace = 'create_workspace',
  RenameWorkspace = 'rename_workspace',
  DeleteWorkspace = 'delete_workspace',
  CreateProject = 'create_project',
  RenameProject = 'rename_project',
  DeleteProject = 'delete_project',
  AddTasks = 'add_tasks',
  UpdateTask = 'update_task',
  CompleteTasks = 'complete_tasks',
  ReopenTasks = 'reopen_tasks',
  ReadHistory = 'read_history',
  ReadChanges = 'read_changes',
  WatchChanges = 'watch_changes',
  ListKeys = 'list_keys',
  IssueKey = 'issue_key',
  RevokeKey = 'revoke_key',
  ListOwnerKeys = 'list_owner_keys',
  IssueOwnerKey = 'issue_owner_key',
  RevokeOwnerKey = 'revoke_owner_key',
  ListConnectedApps = 'list_connected_apps',
  DisconnectApp = 'disconnect_app',
}

const TASK_NUMBER_PATTERN = '[1-9][0-9]{0,8}';
const WORKSPACE_PATH = `/owner/workspaces/:${RouteParam.WorkspaceId}`;
const OWNER_KEYS_PATH = '/owner/keys';
const CONNECTED_APPS_PATH = '/owner/connected-apps';
const PROJECT_PATH = `/owner/projects/:${RouteParam.ProjectId}`;
const TASK_PATH = `${PROJECT_PATH}/tasks/:${RouteParam.Number}(${TASK_NUMBER_PATTERN})`;

type OwnerRouteDefinition = { method: HttpMethod; pattern: URLPattern };

export type OwnerRouteMatch = { route: OwnerRoute; params: Record<string, string> };

function definition({ method, pathname }: { method: HttpMethod; pathname: string }): OwnerRouteDefinition {
  return { method, pattern: new URLPattern({ pathname }) };
}

export const OWNER_ROUTES: Record<OwnerRoute, OwnerRouteDefinition> = {
  [OwnerRoute.SignIn]: definition({ method: HttpMethod.Post, pathname: '/owner/sessions' }),
  [OwnerRoute.ReadSignInMethod]: definition({ method: HttpMethod.Get, pathname: '/owner/sign-in-method' }),
  [OwnerRoute.RequestSignInLink]: definition({ method: HttpMethod.Post, pathname: '/owner/sign-in-links' }),
  [OwnerRoute.SignOut]: definition({ method: HttpMethod.Delete, pathname: '/owner/sessions/current' }),
  [OwnerRoute.ReadOwner]: definition({ method: HttpMethod.Get, pathname: '/owner' }),
  [OwnerRoute.UpdateOwner]: definition({ method: HttpMethod.Patch, pathname: '/owner' }),
  [OwnerRoute.ListWorkspaces]: definition({ method: HttpMethod.Get, pathname: '/owner/workspaces' }),
  [OwnerRoute.CreateWorkspace]: definition({ method: HttpMethod.Post, pathname: '/owner/workspaces' }),
  [OwnerRoute.RenameWorkspace]: definition({ method: HttpMethod.Patch, pathname: WORKSPACE_PATH }),
  [OwnerRoute.DeleteWorkspace]: definition({ method: HttpMethod.Delete, pathname: WORKSPACE_PATH }),
  [OwnerRoute.CreateProject]: definition({ method: HttpMethod.Post, pathname: `${WORKSPACE_PATH}/projects` }),
  [OwnerRoute.RenameProject]: definition({ method: HttpMethod.Patch, pathname: PROJECT_PATH }),
  [OwnerRoute.DeleteProject]: definition({ method: HttpMethod.Delete, pathname: PROJECT_PATH }),
  [OwnerRoute.AddTasks]: definition({ method: HttpMethod.Post, pathname: `${PROJECT_PATH}/tasks` }),
  [OwnerRoute.UpdateTask]: definition({ method: HttpMethod.Patch, pathname: TASK_PATH }),
  [OwnerRoute.CompleteTasks]: definition({ method: HttpMethod.Post, pathname: `${PROJECT_PATH}/tasks/complete` }),
  [OwnerRoute.ReopenTasks]: definition({ method: HttpMethod.Post, pathname: `${PROJECT_PATH}/tasks/reopen` }),
  [OwnerRoute.ReadHistory]: definition({ method: HttpMethod.Get, pathname: `${TASK_PATH}/history` }),
  [OwnerRoute.ReadChanges]: definition({ method: HttpMethod.Get, pathname: `${PROJECT_PATH}/changes` }),
  [OwnerRoute.WatchChanges]: definition({ method: HttpMethod.Get, pathname: `${PROJECT_PATH}/socket` }),
  [OwnerRoute.ListKeys]: definition({ method: HttpMethod.Get, pathname: `${PROJECT_PATH}/keys` }),
  [OwnerRoute.IssueKey]: definition({ method: HttpMethod.Post, pathname: `${PROJECT_PATH}/keys` }),
  [OwnerRoute.RevokeKey]: definition({ method: HttpMethod.Delete, pathname: `${PROJECT_PATH}/keys/:${RouteParam.KeyId}` }),
  [OwnerRoute.ListOwnerKeys]: definition({ method: HttpMethod.Get, pathname: OWNER_KEYS_PATH }),
  [OwnerRoute.IssueOwnerKey]: definition({ method: HttpMethod.Post, pathname: OWNER_KEYS_PATH }),
  [OwnerRoute.RevokeOwnerKey]: definition({ method: HttpMethod.Delete, pathname: `${OWNER_KEYS_PATH}/:${RouteParam.KeyId}` }),
  [OwnerRoute.ListConnectedApps]: definition({ method: HttpMethod.Get, pathname: CONNECTED_APPS_PATH }),
  [OwnerRoute.DisconnectApp]: definition({ method: HttpMethod.Delete, pathname: `${CONNECTED_APPS_PATH}/:${RouteParam.ConnectedAppId}` }),
};

function namedParams(groups: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(groups).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

function matchOf({ request, route }: { request: Request; route: OwnerRoute }): OwnerRouteMatch[] {
  const { method, pattern } = OWNER_ROUTES[route];
  if (method !== request.method) return [];
  const result = pattern.exec(request.url);
  if (result === null) return [];
  return [{ route, params: namedParams(result.pathname.groups) }];
}

export function matchOwnerRoute(request: Request): OwnerRouteMatch | null {
  const [firstMatch] = Object.values(OwnerRoute).flatMap((route) => matchOf({ request, route }));
  if (firstMatch === undefined) return null;
  return firstMatch;
}
