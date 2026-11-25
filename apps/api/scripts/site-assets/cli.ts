import { REGENERATE_COMMAND, REPOSITORY_ROOT, renderSiteAssets, staleInputsOf } from './site-assets';

enum SiteAssetsCliMode {
  Generate = 'generate',
  Check = 'check',
}

const FAILURE_EXIT_CODE = 1;
const SUCCESS_EXIT_CODE = 0;

async function generate(): Promise<number> {
  await renderSiteAssets();
  console.log('wrote the site assets and their lock');
  return SUCCESS_EXIT_CODE;
}

async function check(root: string): Promise<number> {
  const staleInputs = staleInputsOf({ root });
  if (staleInputs.length === 0) return SUCCESS_EXIT_CODE;
  staleInputs.forEach((input) => console.error(`${input} is stale; run ${REGENERATE_COMMAND}`));
  return FAILURE_EXIT_CODE;
}

const HANDLERS: Record<SiteAssetsCliMode, (root: string) => Promise<number>> = {
  [SiteAssetsCliMode.Generate]: generate,
  [SiteAssetsCliMode.Check]: check,
};

const [, , modeArgument, rootArgument] = process.argv;
const mode = modeArgument as SiteAssetsCliMode;
if (!Object.values(SiteAssetsCliMode).includes(mode)) throw new Error(`usage: cli.ts ${Object.values(SiteAssetsCliMode).join(' | ')}`);
process.exitCode = await HANDLERS[mode](rootArgument || REPOSITORY_ROOT);
