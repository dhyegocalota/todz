export enum ParityScope {
  ProjectKey = 'project_key',
  OwnerKey = 'owner_key',
  NotOverMcp = 'not_over_mcp',
  Transport = 'transport',
  Deferred = 'deferred',
}

export type AppAction = { action: string; ownerRoute: string | null; tool: string | null; scope: ParityScope; reason: string | null };

const CREDENTIAL_REASON = 'a credential: an agent able to issue or revoke keys could widen its own access';
const IDENTITY_REASON = 'a person proves who they are: an agent never signs in for them';
const SYNC_REASON = 'sync transport between a Mac and the server; an agent reads tasks with list and show';

function projectKeyAction({ action, ownerRoute, tool }: { action: string; ownerRoute: string | null; tool: string }): AppAction {
  return { action, ownerRoute, tool, scope: ParityScope.ProjectKey, reason: null };
}

function ownerKeyAction({ action, ownerRoute, tool }: { action: string; ownerRoute: string; tool: string }): AppAction {
  return { action, ownerRoute, tool, scope: ParityScope.OwnerKey, reason: null };
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
  projectKeyAction({ action: 'Pick the next task to work on', ownerRoute: null, tool: 'next' }),
  projectKeyAction({ action: 'Add tasks', ownerRoute: 'add_tasks', tool: 'add' }),
  projectKeyAction({ action: 'See Today, Upcoming, Overdue and done tasks, and search them', ownerRoute: null, tool: 'list' }),
  projectKeyAction({ action: 'Open a task to read its notes', ownerRoute: null, tool: 'show' }),
  projectKeyAction({ action: 'Read what happened to a task', ownerRoute: 'read_history', tool: 'history' }),
  projectKeyAction({ action: 'Edit a task title, notes or due date, clear them, and reorder', ownerRoute: 'update_task', tool: 'update' }),
  projectKeyAction({ action: 'Complete tasks', ownerRoute: 'complete_tasks', tool: 'done' }),
  projectKeyAction({ action: 'Reopen a done task', ownerRoute: 'reopen_tasks', tool: 'reopen' }),
  projectKeyAction({ action: 'Delete a task', ownerRoute: null, tool: 'delete' }),
  projectKeyAction({ action: 'Move a task to another project of the workspace', ownerRoute: null, tool: 'move' }),
  projectKeyAction({ action: 'See the projects of a workspace', ownerRoute: null, tool: 'projects' }),
  ownerKeyAction({ action: 'List workspaces and their projects', ownerRoute: 'list_workspaces', tool: 'workspaces' }),
  ownerKeyAction({ action: 'Create a workspace', ownerRoute: 'create_workspace', tool: 'create_workspace' }),
  ownerKeyAction({ action: 'Rename a workspace', ownerRoute: 'rename_workspace', tool: 'rename_workspace' }),
  ownerKeyAction({ action: 'Delete a workspace', ownerRoute: 'delete_workspace', tool: 'delete_workspace' }),
  ownerKeyAction({ action: 'Create a project', ownerRoute: 'create_project', tool: 'create_project' }),
  ownerKeyAction({ action: 'Rename a project', ownerRoute: 'rename_project', tool: 'rename_project' }),
  ownerKeyAction({ action: 'Delete a project', ownerRoute: 'delete_project', tool: 'delete_project' }),
  withoutTool({ action: 'Read the changes of a project', ownerRoute: 'read_changes', scope: ParityScope.Transport, reason: SYNC_REASON }),
  withoutTool({ action: 'Watch a project for changes', ownerRoute: 'watch_changes', scope: ParityScope.Transport, reason: SYNC_REASON }),
  withoutTool({ action: 'List the keys of a project', ownerRoute: 'list_keys', scope: ParityScope.NotOverMcp, reason: CREDENTIAL_REASON }),
  withoutTool({ action: 'Issue a project key', ownerRoute: 'issue_key', scope: ParityScope.NotOverMcp, reason: CREDENTIAL_REASON }),
  withoutTool({ action: 'Revoke a project key', ownerRoute: 'revoke_key', scope: ParityScope.NotOverMcp, reason: CREDENTIAL_REASON }),
  withoutTool({ action: 'List the owner keys', ownerRoute: 'list_owner_keys', scope: ParityScope.NotOverMcp, reason: CREDENTIAL_REASON }),
  withoutTool({ action: 'Issue an owner key', ownerRoute: 'issue_owner_key', scope: ParityScope.NotOverMcp, reason: CREDENTIAL_REASON }),
  withoutTool({ action: 'Revoke an owner key', ownerRoute: 'revoke_owner_key', scope: ParityScope.NotOverMcp, reason: CREDENTIAL_REASON }),
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
  withoutTool({
    action: 'Leave an address for the cloud queue',
    ownerRoute: 'join_cloud_queue',
    scope: ParityScope.NotOverMcp,
    reason: IDENTITY_REASON,
  }),
  withoutTool({ action: 'Sign out', ownerRoute: 'sign_out', scope: ParityScope.NotOverMcp, reason: IDENTITY_REASON }),
  ownerKeyAction({ action: 'Read the account settings', ownerRoute: 'read_owner', tool: 'settings' }),
  ownerKeyAction({ action: 'Change the account settings', ownerRoute: 'update_owner', tool: 'update_settings' }),
];
