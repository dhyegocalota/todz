import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import { applyProjectSchema } from './project-schema';

export class ProjectStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => applyProjectSchema(ctx.storage.sql));
  }
}
