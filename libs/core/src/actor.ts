import { ActorKind, CLIENT_NAME_MAX_LENGTH, RuleIssue } from '@todz/types';
import { RuleViolation } from './errors';
import type { Actor } from './task';

const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

export const OWNER_ACTOR: Actor = { kind: ActorKind.Owner };

export function agentActor(clientName: string): Actor {
  const trimmedName = clientName.trim();
  const isEmpty = trimmedName === '';
  const isTooLong = [...trimmedName].length > CLIENT_NAME_MAX_LENGTH;
  const hasControlCharacter = CONTROL_CHARACTER_PATTERN.test(trimmedName);
  if (isEmpty || isTooLong || hasControlCharacter) throw new RuleViolation({ issue: RuleIssue.ClientNameInvalid });
  return { kind: ActorKind.Agent, clientName: trimmedName };
}
