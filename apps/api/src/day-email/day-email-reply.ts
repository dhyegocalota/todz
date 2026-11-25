import type { Env } from '../env';

export enum ReplyOutcome {
  Added = 'added',
  UnknownRecipient = 'unknown_recipient',
  Limited = 'limited',
  TooLarge = 'too_large',
  Unparseable = 'unparseable',
  Automatic = 'automatic',
  Unauthenticated = 'unauthenticated',
  NotOwner = 'not_owner',
  NotAReply = 'not_a_reply',
  NoMessageId = 'no_message_id',
  DailyCap = 'daily_cap',
  Empty = 'empty',
  InvalidTitle = 'invalid_title',
  NoInbox = 'no_inbox',
  Failed = 'failed',
}

export async function handleReply(_reply: { message: ForwardableEmailMessage; env: Env; now: number }): Promise<void> {
  throw new Error('handleReply is not implemented');
}
