import { ActorKind } from '@todz/types';
import type { Actor } from './task';

export const OWNER_ACTOR: Actor = { kind: ActorKind.Owner };

export function agentActor(clientName: string): Actor {
  throw new Error('agentActor is not implemented');
}
