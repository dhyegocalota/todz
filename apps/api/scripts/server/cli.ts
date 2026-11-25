import { MINIMUM_APP_VERSION } from '@todz/types';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { publicOriginInWranglerText, readyLine } from './ready-line';

const WRANGLER_CONFIGURATION_PATH = fileURLToPath(new URL('../../wrangler.jsonc', import.meta.url));

console.log(
  readyLine({
    publicOrigin: publicOriginInWranglerText(readFileSync(WRANGLER_CONFIGURATION_PATH, 'utf8')),
    serverVersion: 'unstamped',
    minimumAppVersion: MINIMUM_APP_VERSION,
  }),
);
