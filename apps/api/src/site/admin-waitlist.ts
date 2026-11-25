export enum ConfirmationState {
  Sent = 'sent',
  Failed = 'failed',
}

export enum AdminNotice {
  None = 'none',
  CheckInbox = 'check-inbox',
  TryAgain = 'try-again',
  Closed = 'closed',
  Forbidden = 'forbidden',
}

export type WaitlistRow = { address: string; joinedAt: number; confirmation: ConfirmationState };

export type WaitlistSummary = { total: number; joinedLastDay: number; failedConfirmations: number; rows: WaitlistRow[] };
