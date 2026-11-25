import type { Env } from '../env';

export enum DigestCron {
  Daily = '0 11 * * *',
}

export enum DigestMissingPiece {
  AdminEmail = 'admin_email',
  SiteOrigin = 'site_origin',
  EmailSender = 'email_sender',
}

export async function runScheduled(_context: { controller: ScheduledController; env: Env }): Promise<void> {
  throw new Error('runScheduled is not implemented');
}
