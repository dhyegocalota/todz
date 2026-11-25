export const JOIN_FORM_CLASS = 'join-form';
export const JOIN_BUTTON_CLASS = 'join-button';
export const EMAIL_FIELD_NAME = 'email';
export const ARIA_DISABLED = 'aria-disabled';
export const STAMP_FIELD_NAME = 'stamp';
export const HONEYPOT_FIELD_NAME = 'todz_fax';
export const WAITLIST_ANSWERED_EVENT = 'waitlist-answered';
export const UNREACHABLE_ANSWER = 'unreachable';
export const JOIN_STATE_ATTRIBUTE = 'joinState';
export const JOIN_OUTCOME_ATTRIBUTE = 'joinOutcome';
export const WAITING_ANSWER = 'waiting';

export enum JoinFormState {
  Waiting = 'waiting',
  Ready = 'ready',
  Sending = 'sending',
}

export enum JoinOutcome {
  Joined = 'joined',
  Invalid = 'invalid',
  CheckFailed = 'check-failed',
  TryAgain = 'try-again',
  OpensSoon = 'opens-soon',
}
