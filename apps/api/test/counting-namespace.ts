import { env } from 'cloudflare:workers';
import type { Env } from '../src/env';
import type { ProjectStore } from '../src/project-store';

export function countingEnv(): { countedEnv: Env; addressingCalls: string[] } {
  const addressingCalls: string[] = [];
  const namespace = new Proxy(env.PROJECT_STORE, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      return (...parameters: unknown[]) => {
        addressingCalls.push(String(property));
        return member.apply(target, parameters);
      };
    },
  }) as DurableObjectNamespace<ProjectStore>;
  return { countedEnv: { DIRECTORY: env.DIRECTORY, PROJECT_STORE: namespace }, addressingCalls };
}
