import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { publicOriginOf, readyLine } from './ready-line';

const WRANGLER_CONFIGURATION_PATH = fileURLToPath(new URL('../../wrangler.jsonc', import.meta.url));

console.log(readyLine({ publicOrigin: publicOriginOf(readFileSync(WRANGLER_CONFIGURATION_PATH, 'utf8')) }));
