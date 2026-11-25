import { TASK_BATCH_MAX_SIZE } from '@todz/types';
import {
  type OwnerConnection,
  addOwnerTasks,
  completeOwnerTasks,
  createProject,
  createWorkspace,
  issueKey,
  signInOwner,
} from './owner-scenario';
import { chunksOf, inSequence } from './sequence';

export type Fixture = {
  connection: OwnerConnection;
  hotProjectId: string;
  hotKey: string;
  projectIds: string[];
  doneTasks: number;
  openNumbers: number[];
};

const OPEN_TASKS_AFTER_SEED = 100;
const PROJECTS_PER_WORKSPACE = 10;
const HOT_WORKSPACE_INDEX = 0;

async function seededWorkspace({ connection, index }: { connection: OwnerConnection; index: number }): Promise<string[]> {
  const { workspaceId, inboxId } = await createWorkspace({ connection, name: `Perf ${index + 1}` });
  const others = await Promise.all(
    Array.from({ length: PROJECTS_PER_WORKSPACE - 1 }, (_, position) =>
      createProject({ connection, workspaceId, name: `Project ${position + 1}` }),
    ),
  );
  return [inboxId, ...others];
}

async function seededTasks({
  connection,
  projectId,
  taskCount,
}: {
  connection: OwnerConnection;
  projectId: string;
  taskCount: number;
}): Promise<number[]> {
  const titles = Array.from({ length: taskCount }, (_, index) => `seed task #${index + 1}`);
  const batches = await inSequence({
    items: chunksOf({ items: titles, size: TASK_BATCH_MAX_SIZE }),
    step: (batch) => addOwnerTasks({ connection, projectId, titles: batch }),
  });
  return batches.flat();
}

export async function seedFixture({
  origin,
  fetch,
  identity,
  taskCount,
  projectCount,
}: {
  origin: string;
  fetch: typeof globalThis.fetch;
  identity: string;
  taskCount: number;
  projectCount: number;
}): Promise<Fixture> {
  const connection = await signInOwner({ origin, fetch, identity });
  const workspaceIndexes = Array.from({ length: Math.ceil(projectCount / PROJECTS_PER_WORKSPACE) }, (_, index) => index);
  const [hotWorkspace, ...otherIndexes] = workspaceIndexes;
  if (hotWorkspace !== HOT_WORKSPACE_INDEX) throw new Error('the seed needs at least one workspace');
  const hotProjects = await seededWorkspace({ connection, index: hotWorkspace });
  const otherProjects = await Promise.all(otherIndexes.map((index) => seededWorkspace({ connection, index })));
  const [hotProjectId] = hotProjects;
  if (hotProjectId === undefined) throw new Error('the hot workspace has no Inbox');
  const numbers = await seededTasks({ connection, projectId: hotProjectId, taskCount });
  const doneNumbers = numbers.slice(0, numbers.length - OPEN_TASKS_AFTER_SEED);
  await inSequence({
    items: chunksOf({ items: doneNumbers, size: TASK_BATCH_MAX_SIZE }),
    step: (batch) => completeOwnerTasks({ connection, projectId: hotProjectId, numbers: batch }),
  });
  return {
    connection,
    hotProjectId,
    hotKey: await issueKey({ connection, projectId: hotProjectId }),
    projectIds: [...hotProjects, ...otherProjects.flat()],
    doneTasks: doneNumbers.length,
    openNumbers: numbers.slice(doneNumbers.length),
  };
}
