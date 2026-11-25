import type { Env } from '../env';

export enum DayEmailMissingPiece {
  PublicOrigin = 'public_origin',
  EmailSender = 'email_sender',
}

export async function runDayEmails({ scheduledTime }: { scheduledTime: number; env: Env }): Promise<void> {
  throw new Error(`runDayEmails is not implemented at ${scheduledTime}`);
}
