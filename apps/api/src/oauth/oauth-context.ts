import type { Env } from '../env';

export type OAuthContext = { request: Request; env: Env; now: number; executionContext: ExecutionContext; issuer: string };

export type OAuthHandler = (context: OAuthContext) => Promise<Response>;
