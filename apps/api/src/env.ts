import type { ProjectStore } from './project-store';

export type Env = {
  DIRECTORY: D1Database;
  PROJECT_STORE: DurableObjectNamespace<ProjectStore>;
  SIGN_IN_PROVIDER?: string;
  EMAIL_SENDER?: string;
  PUBLIC_ORIGIN?: string;
};
