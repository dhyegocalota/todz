import { fileURLToPath } from 'node:url';

export const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
export const REGENERATE_COMMAND = 'pnpm --filter @todz/api site:assets';

export async function renderSiteAssets(): Promise<void> {
  throw new Error('renderSiteAssets is not implemented');
}

export function staleInputsOf({ root }: { root: string }): string[] {
  throw new Error(`staleInputsOf is not implemented for ${root}`);
}
