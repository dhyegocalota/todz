export enum ParityScope {
  Project = 'project',
  Owner = 'owner',
  NotOverMcp = 'not_over_mcp',
  Transport = 'transport',
  Deferred = 'deferred',
}

export type AppAction = { action: string; ownerRoute: string | null; tool: string | null; scope: ParityScope; reason: string | null };

const CREDENTIAL_REASON = 'a credential: an agent able to list or disconnect apps could widen its own access';
const IDENTITY_REASON = 'a person proves who they are: an agent never signs in for them';
const SYNC_REASON = 'sync transport between a Mac and the server; an agent reads tasks with list and show';

function projectAction({ action, ownerRoute, tool }: { action: string; ownerRoute: string | null; tool: string }): AppAction {
  return { action, ownerRoute, tool, scope: ParityScope.Project, reason: null };
}

function ownerAction({ action, ownerRoute, tool }: { action: string; ownerRoute: string; tool: string }): AppAction {
  return { action, ownerRoute, tool, scope: ParityScope.Owner, reason: null };
}

function withoutTool({
  action,
  ownerRoute,
  scope,
  reason,
}: {
  action: string;
  ownerRoute: string;
  scope: ParityScope;
  reason: string;
}): AppAction {
  return { action, ownerRoute, tool: null, scope, reason };
}

export const APP_ACTIONS: AppAction[] = [
  projectAction({ action: 'Pick the next task to work on', ownerRoute: null, tool: 'next' }),
  projectAction({ action: 'Add tasks', ownerRoute: 'add_tasks', tool: 'add' }),
  projectAction({ action: 'See Today, Upcoming, Overdue and done tasks, and search them', ownerRoute: null, tool: 'list' }),
  projectAction({ action: 'Open a task to read its notes', ownerRoute: null, tool: 'show' }),
  projectAction({ action: 'Read what happened to a task', ownerRoute: 'read_history', tool: 'history' }),
  projectAction({ action: 'Edit a task title, notes or due date, clear them, and reorder', ownerRoute: 'update_task', tool: 'update' }),
  projectAction({ action: 'Complete tasks', ownerRoute: 'complete_tasks', tool: 'done' }),
  projectAction({ action: 'Reopen a done task', ownerRoute: 'reopen_tasks', tool: 'reopen' }),
  projectAction({ action: 'Delete a task', ownerRoute: 'delete_task', tool: 'delete' }),
  projectAction({ action: 'Move a task to another project of the workspace', ownerRoute: null, tool: 'move' }),
  projectAction({ action: 'See the projects of a workspace', ownerRoute: null, tool: 'projects' }),
  ownerAction({ action: 'List workspaces and their projects', ownerRoute: 'list_workspaces', tool: 'workspaces' }),
  ownerAction({ action: 'Create a workspace', ownerRoute: 'create_workspace', tool: 'create_workspace' }),
  ownerAction({ action: 'Rename a workspace', ownerRoute: 'rename_workspace', tool: 'rename_workspace' }),
  ownerAction({ action: 'Delete a workspace', ownerRoute: 'delete_workspace', tool: 'delete_workspace' }),
  ownerAction({ action: 'Create a project', ownerRoute: 'create_project', tool: 'create_project' }),
  ownerAction({ action: 'Rename a project', ownerRoute: 'rename_project', tool: 'rename_project' }),
  ownerAction({ action: 'Delete a project', ownerRoute: 'delete_project', tool: 'delete_project' }),
  withoutTool({ action: 'Read the changes of a project', ownerRoute: 'read_changes', scope: ParityScope.Transport, reason: SYNC_REASON }),
  withoutTool({ action: 'Watch a project for changes', ownerRoute: 'watch_changes', scope: ParityScope.Transport, reason: SYNC_REASON }),
  withoutTool({
    action: 'List the connected apps',
    ownerRoute: 'list_connected_apps',
    scope: ParityScope.NotOverMcp,
    reason: CREDENTIAL_REASON,
  }),
  withoutTool({ action: 'Disconnect an app', ownerRoute: 'disconnect_app', scope: ParityScope.NotOverMcp, reason: CREDENTIAL_REASON }),
  withoutTool({ action: 'Sign in', ownerRoute: 'sign_in', scope: ParityScope.NotOverMcp, reason: IDENTITY_REASON }),
  withoutTool({
    action: 'Read the sign-in method',
    ownerRoute: 'read_sign_in_method',
    scope: ParityScope.NotOverMcp,
    reason: IDENTITY_REASON,
  }),
  withoutTool({
    action: 'Ask for a sign-in link',
    ownerRoute: 'request_sign_in_link',
    scope: ParityScope.NotOverMcp,
    reason: IDENTITY_REASON,
  }),
  withoutTool({ action: 'Sign out', ownerRoute: 'sign_out', scope: ParityScope.NotOverMcp, reason: IDENTITY_REASON }),
  ownerAction({ action: 'Read the account settings', ownerRoute: 'read_owner', tool: 'settings' }),
  ownerAction({ action: 'Change the account settings', ownerRoute: 'update_owner', tool: 'update_settings' }),
];
