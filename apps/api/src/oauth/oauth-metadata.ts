import type { Env } from '../env';

export function serveOAuthMetadata(_context: { request: Request; env: Env }): Response {
  throw new Error('serveOAuthMetadata is not implemented');
}
