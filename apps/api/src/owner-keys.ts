import { type SessionHandler, unbuiltHandler } from './owner-request';
import { OwnerRoute } from './owner-routes';

type KeyRoute = OwnerRoute.ListKeys | OwnerRoute.IssueKey | OwnerRoute.RevokeKey;

export const KEY_HANDLERS: Record<KeyRoute, SessionHandler> = {
  [OwnerRoute.ListKeys]: unbuiltHandler,
  [OwnerRoute.IssueKey]: unbuiltHandler,
  [OwnerRoute.RevokeKey]: unbuiltHandler,
};
