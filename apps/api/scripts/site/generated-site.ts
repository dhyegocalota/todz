import { fileURLToPath } from 'node:url';

export const GENERATED_SITE_PATH = fileURLToPath(new URL('../../src/site/generated/self-host-html.ts', import.meta.url));

export async function generatedSiteSource(): Promise<string> {
  throw new Error('generatedSiteSource is not implemented');
}
