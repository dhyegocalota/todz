import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';

export class ProjectStore extends DurableObject<Env> {}
