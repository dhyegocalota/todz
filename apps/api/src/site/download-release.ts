import type { Env } from '../env';

export async function isDownloadReleased(_env: Pick<Env, 'ASSETS'>): Promise<boolean> {
  throw new Error('isDownloadReleased is not implemented');
}
