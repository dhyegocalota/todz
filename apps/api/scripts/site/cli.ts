import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GENERATED_SITE_PATH, generatedSiteSource } from './generated-site';

enum SiteCliMode {
  Generate = 'generate',
  Check = 'check',
}

const FAILURE_EXIT_CODE = 1;
const SUCCESS_EXIT_CODE = 0;
const STALE_MESSAGE = `${GENERATED_SITE_PATH} is stale; run pnpm site:generate`;

async function generate(): Promise<number> {
  writeFileSync(GENERATED_SITE_PATH, await generatedSiteSource());
  console.log(`wrote ${GENERATED_SITE_PATH}`);
  return SUCCESS_EXIT_CODE;
}

function staleExitCode(): number {
  console.error(STALE_MESSAGE);
  return FAILURE_EXIT_CODE;
}

async function check(): Promise<number> {
  if (!existsSync(GENERATED_SITE_PATH)) return staleExitCode();
  const current = readFileSync(GENERATED_SITE_PATH, 'utf8');
  if (current === (await generatedSiteSource())) return SUCCESS_EXIT_CODE;
  return staleExitCode();
}

const HANDLERS: Record<SiteCliMode, () => Promise<number>> = {
  [SiteCliMode.Generate]: generate,
  [SiteCliMode.Check]: check,
};

const mode = process.argv[2] as SiteCliMode;
if (!Object.values(SiteCliMode).includes(mode)) throw new Error(`usage: cli.ts ${Object.values(SiteCliMode).join(' | ')}`);
process.exitCode = await HANDLERS[mode]();
