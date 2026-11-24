import { type SessionContext, routeParam } from './owner-request';
import { RouteParam } from './owner-routes';
import { openOwnedProject } from './project-routing';
import type { ProjectStore } from './project-store';

export function ownedProjectOf(context: SessionContext): Promise<DurableObjectStub<ProjectStore> | null> {
  const { env, owner } = context;
  return openOwnedProject({ env, owner, projectId: routeParam({ context, name: RouteParam.ProjectId }) });
}
