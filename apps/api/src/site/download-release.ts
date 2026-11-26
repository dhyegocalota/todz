import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpStatus } from '../http-status';
import { DOWNLOAD_LATEST_PATH, SITE_URL } from './site-urls';

const RELEASED_LOCATION_PATTERN = /^\/download\/\d{1,4}\.\d{1,4}\.\d{1,4}\/Todz-\d{1,4}\.\d{1,4}\.\d{1,4}\.dmg$/;
const MANUAL_REDIRECT = 'manual';

export async function isDownloadReleased({ ASSETS }: Pick<Env, 'ASSETS'>): Promise<boolean> {
  if (ASSETS === undefined) throw new Error('the ASSETS binding is missing');
  const answer = await ASSETS.fetch(new Request(`${SITE_URL}${DOWNLOAD_LATEST_PATH}`, { redirect: MANUAL_REDIRECT }));
  if (answer.status === HttpStatus.NotFound) return false;
  const location = answer.headers.get(HttpHeader.Location);
  const isReleasedRedirect = answer.status === HttpStatus.Found && location !== null && RELEASED_LOCATION_PATTERN.test(location);
  if (isReleasedRedirect) return true;
  throw new Error(`/download/latest answered ${answer.status} ${location}`);
}
