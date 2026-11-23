import type { ProjectStore } from './project-store';

export type Env = {
  DIRECTORY: D1Database;
  PROJECT_STORE: DurableObjectNamespace<ProjectStore>;
};
