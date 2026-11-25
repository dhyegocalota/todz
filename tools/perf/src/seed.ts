import type { OwnerConnection } from './owner-scenario';

export type Fixture = {
  connection: OwnerConnection;
  hotProjectId: string;
  hotKey: string;
  projectIds: string[];
  doneTasks: number;
  openNumbers: number[];
};

export function seedFixture(_: {
  origin: string;
  fetch: typeof fetch;
  identity: string;
  taskCount: number;
  projectCount: number;
}): Promise<Fixture> {
  throw new Error('seedFixture is not implemented');
}
