import { describe, expect, test } from 'vitest';
import { OWNER_ROUTES, OwnerRoute, matchOwnerRoute } from '../src/owner-routes';

const ORIGIN = 'https://api.todz.test';
const PROJECT = 'project-1';
const WORKSPACE = 'workspace-1';

function matched({ method, path }: { method: string; path: string }): ReturnType<typeof matchOwnerRoute> {
  return matchOwnerRoute(new Request(`${ORIGIN}${path}`, { method }));
}

describe('matchOwnerRoute', () => {
  test.each([
    ['POST', '/owner/sessions', OwnerRoute.SignIn, {}],
    ['DELETE', '/owner/sessions/current', OwnerRoute.SignOut, {}],
    ['GET', '/owner', OwnerRoute.ReadOwner, {}],
    ['PATCH', '/owner', OwnerRoute.UpdateOwner, {}],
    ['GET', '/owner/workspaces', OwnerRoute.ListWorkspaces, {}],
    ['POST', '/owner/workspaces', OwnerRoute.CreateWorkspace, {}],
    ['PATCH', `/owner/workspaces/${WORKSPACE}`, OwnerRoute.RenameWorkspace, { workspaceId: WORKSPACE }],
    ['POST', `/owner/workspaces/${WORKSPACE}/projects`, OwnerRoute.CreateProject, { workspaceId: WORKSPACE }],
    ['PATCH', `/owner/projects/${PROJECT}`, OwnerRoute.RenameProject, { projectId: PROJECT }],
    ['POST', `/owner/projects/${PROJECT}/tasks`, OwnerRoute.AddTasks, { projectId: PROJECT }],
    ['PATCH', `/owner/projects/${PROJECT}/tasks/12`, OwnerRoute.UpdateTask, { projectId: PROJECT, number: '12' }],
    ['DELETE', `/owner/projects/${PROJECT}/tasks/12`, OwnerRoute.DeleteTask, { projectId: PROJECT, number: '12' }],
    ['POST', `/owner/projects/${PROJECT}/tasks/complete`, OwnerRoute.CompleteTasks, { projectId: PROJECT }],
    ['POST', `/owner/projects/${PROJECT}/tasks/reopen`, OwnerRoute.ReopenTasks, { projectId: PROJECT }],
    ['GET', `/owner/projects/${PROJECT}/tasks/12/history`, OwnerRoute.ReadHistory, { projectId: PROJECT, number: '12' }],
    ['GET', `/owner/projects/${PROJECT}/changes`, OwnerRoute.ReadChanges, { projectId: PROJECT }],
    ['GET', `/owner/projects/${PROJECT}/changes?cursor=5`, OwnerRoute.ReadChanges, { projectId: PROJECT }],
    ['GET', `/owner/projects/${PROJECT}/socket`, OwnerRoute.WatchChanges, { projectId: PROJECT }],
  ])('%s %s is %s', (method, path, route, params) => {
    expect(matched({ method, path })).toEqual({ route, params });
  });

  test('every route of the enum is reachable through the table', () => {
    expect(Object.keys(OWNER_ROUTES).sort()).toEqual(Object.values(OwnerRoute).sort());
  });

  test('POST tasks/complete is CompleteTasks, never UpdateTask, and PATCH tasks/complete matches nothing', () => {
    expect(matched({ method: 'POST', path: `/owner/projects/${PROJECT}/tasks/complete` })?.route).toBe(OwnerRoute.CompleteTasks);
    expect(matched({ method: 'PATCH', path: `/owner/projects/${PROJECT}/tasks/complete` })).toBeNull();
  });

  test.each([['1'], ['9'], ['10'], ['999999999']])('a task number %s is accepted', (number) => {
    expect(matched({ method: 'PATCH', path: `/owner/projects/${PROJECT}/tasks/${number}` })?.route).toBe(OwnerRoute.UpdateTask);
    expect(matched({ method: 'GET', path: `/owner/projects/${PROJECT}/tasks/${number}/history` })?.route).toBe(OwnerRoute.ReadHistory);
  });

  test.each([['0'], ['01'], ['1000000000'], ['-1'], ['1.5'], ['1e3'], ['abc'], ['%31']])('a task number %s matches nothing', (number) => {
    expect(matched({ method: 'PATCH', path: `/owner/projects/${PROJECT}/tasks/${number}` })).toBeNull();
    expect(matched({ method: 'GET', path: `/owner/projects/${PROJECT}/tasks/${number}/history` })).toBeNull();
  });

  test.each([
    ['GET', '/owner/nothing'],
    ['PUT', '/owner'],
    ['GET', '/ownerx'],
    ['GET', '/owner/'],
    ['GET', '/owner/sessions'],
    ['POST', '/owner/sessions/current'],
    ['DELETE', '/owner/workspaces'],
    ['GET', `/owner/workspaces/${WORKSPACE}`],
    ['GET', `/owner/projects/${PROJECT}`],
    ['GET', `/owner/projects/${PROJECT}/tasks`],
    ['GET', `/owner/projects/${PROJECT}/tasks/1/history/extra`],
    ['GET', `/owner/projects/${PROJECT}/socket/extra`],
    ['POST', `/owner/projects/${PROJECT}/changes`],
    ['GET', '/mcp'],
  ])('%s %s matches nothing', (method, path) => {
    expect(matched({ method, path })).toBeNull();
  });
});
