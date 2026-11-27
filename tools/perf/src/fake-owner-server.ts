import { fieldOf, listOf, numberOf, textOf } from './json-reader';
import { type RecordedRequest, type RecordingFetch, recordingFetch } from './recording-fetch';

export const FAKE_SESSION_TOKEN = 'session-token';
export const FAKE_OWNER_ID = 'owner-1';

const CREATED = 201;
const OK = 200;
const NOT_FOUND = 404;
const SEARCH_CURSOR = 'cursor';

type Route = { method: string; pattern: RegExp; answer: (request: RecordedRequest, parameters: string[]) => Response };

function taskCountOf({ counts, projectKey }: { counts: Map<string, number>; projectKey: string }): number {
  const count = counts.get(projectKey);
  if (count === undefined) return 0;
  return count;
}

function projectOf(identifier: string) {
  return { id: identifier, name: identifier, is_inbox: false, created_at: 0 };
}

export function fakeOwnerServer(): RecordingFetch {
  const state = { workspaceCount: 0, projectCount: 0, taskCounts: new Map<string, number>() };
  const routes: Route[] = [
    {
      method: 'POST',
      pattern: /^\/owner\/sessions$/,
      answer: () =>
        Response.json({ session_token: FAKE_SESSION_TOKEN, owner: { id: FAKE_OWNER_ID, time_zone: 'UTC' } }, { status: CREATED }),
    },
    {
      method: 'POST',
      pattern: /^\/owner\/workspaces$/,
      answer: () => {
        state.workspaceCount += 1;
        const inbox = { ...projectOf(`inbox-${state.workspaceCount}`), is_inbox: true };
        return Response.json(
          { workspace: { id: `workspace-${state.workspaceCount}`, name: 'workspace', created_at: 0, projects: [inbox] } },
          { status: CREATED },
        );
      },
    },
    {
      method: 'POST',
      pattern: /^\/owner\/workspaces\/([^/]+)\/projects$/,
      answer: () => {
        state.projectCount += 1;
        return Response.json({ project: projectOf(`project-${state.projectCount}`) }, { status: CREATED });
      },
    },
    {
      method: 'GET',
      pattern: /^\/owner\/workspaces$/,
      answer: () => {
        const inbox = { ...projectOf('inbox-1'), is_inbox: true };
        return Response.json({ workspaces: [{ id: 'workspace-1', name: 'Perf 1', created_at: 0, projects: [inbox] }] }, { status: OK });
      },
    },
    {
      method: 'POST',
      pattern: /^\/owner\/projects\/([^/]+)\/tasks$/,
      answer: (request, [projectIdentifier]) => {
        const drafts = listOf(fieldOf({ value: request.body, name: 'tasks' }));
        const projectKey = textOf(projectIdentifier);
        const firstNumber = taskCountOf({ counts: state.taskCounts, projectKey }) + 1;
        state.taskCounts.set(projectKey, firstNumber - 1 + drafts.length);
        const tasks = drafts.map((_, index) => ({ task: { number: firstNumber + index }, replayed: false }));
        return Response.json({ tasks }, { status: CREATED });
      },
    },
    {
      method: 'POST',
      pattern: /^\/owner\/projects\/([^/]+)\/tasks\/complete$/,
      answer: (request) => {
        const numbers = listOf(fieldOf({ value: request.body, name: 'numbers' })).map(numberOf);
        return Response.json({ tasks: numbers.map((number) => ({ task: { number }, already_done: false })) }, { status: OK });
      },
    },
    {
      method: 'GET',
      pattern: /^\/owner\/projects\/([^/]+)\/changes$/,
      answer: (request) => {
        const cursor = Number(new URLSearchParams(request.search).get(SEARCH_CURSOR));
        return Response.json({ tasks: [], cursor, has_more: false }, { status: OK });
      },
    },
    {
      method: 'GET',
      pattern: /^\/owner$/,
      answer: () => Response.json({ owner: { id: FAKE_OWNER_ID, time_zone: 'UTC' } }, { status: OK }),
    },
  ];
  return recordingFetch((request) => {
    const [matched] = routes.flatMap((route) => {
      const match = route.pattern.exec(request.pathname);
      if (match === null || route.method !== request.method) return [];
      return [{ route, parameters: match.slice(1) }];
    });
    if (matched === undefined) return new Response(null, { status: NOT_FOUND });
    return matched.route.answer(request, matched.parameters);
  });
}
