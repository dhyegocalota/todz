import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles } from './repository-files';

const API_SOURCE_FOLDER = 'apps/api/src';
const ROUTING_MODULE = 'apps/api/src/project-routing.ts';
const ENV_MODULE = 'apps/api/src/env.ts';
const WRANGLER_CONFIGURATION = 'apps/api/wrangler.jsonc';
const MACOS_PROJECT = 'apps/macos/project.yml';
const PACKAGE_MANIFEST = 'apps/api/package.json';
const PACKAGE_MANIFESTS_PATHSPEC = '*package.json';
const DEV_SCRIPT = 'dev';
const DEV_EMAIL_SCRIPT = 'dev:email';
const DEV_EMAIL_CLOUDFLARE_SCRIPT = 'dev:email:cloudflare';
const MIGRATIONS_COMMAND = 'wrangler d1 migrations apply todz-directory --local';
const DEV_COMMAND = 'wrangler dev';
const LOCAL_ORIGIN = 'http://localhost:8787';
const LOCAL_ORIGIN_VARIABLE = `--var PUBLIC_ORIGIN:${LOCAL_ORIGIN}`;
const LOCAL_UPSTREAM_FLAG = '--local-upstream localhost:8787';
const REMOTE_FLAG = '--remote';
const PRODUCTION_DATABASE_NAME = 'todz-directory';
const PRODUCTION_DATABASE_ID = 'dc22b1c3-1869-44a0-b805-91bf92017f19';
const PRODUCTION_HOST = 'api.todz.app';
const PRODUCTION_ORIGIN = `https://${PRODUCTION_HOST}`;
const RATE_LIMIT_NAMESPACE_ID = '8601';
const ACCOUNT_ID = 'e2035d8e0b7173d520ccf643f6f4661c';
const PREVIEW_DATABASE_ID = '00000000-0000-0000-0000-000000000000';
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_PERIOD_SECONDS = 60;
const RESOURCE_NAME_PREFIX = 'todz';
const TRAILING_COMMA_PATTERN = /,(\s*[}\]])/g;
const NO_LOCAL_PROVIDER_PATTERN = /"(fake|console)"/;
const SEND_EMAIL_BINDING_PATTERN =
  /"send_email":\s*\[\s*\{\s*"name":\s*"EMAIL",\s*"allowed_sender_addresses":\s*\["noreply@todz\.app"\]\s*,?\s*\}\s*,?\s*\]/;
const ASSETS_PATTERN =
  /"assets":\s*\{\s*"directory":\s*"\.\/public",\s*"run_worker_first":\s*\["\/owner",\s*"\/owner\/\*",\s*"\/mcp",\s*"\/sign-in"\]\s*,?\s*\}/;
const DEBUG_API_BASE_URL_PATTERN = /configs:\s*\n\s+Debug:\s*\n\s+TODZ_API_BASE_URL: (\S+)\s*\n/;
const RELEASE_API_BASE_URL_PATTERN = /\n\s+Release:\s*\n\s+TODZ_API_BASE_URL: (\S+)\s*\n/;
const INFO_PLIST_API_BASE_URL_PATTERN = /TodzAPIBaseURL: \$\(TODZ_API_BASE_URL\)/;
const FIRST_CAPTURE = 1;
const CONSOLE_IDENTIFIER = /\bconsole\b/;
const CONSOLE_EMAIL_SENDER = 'apps/api/src/email-sender.ts';
const PROJECT_STORE_IDENTIFIER = /\bPROJECT_STORE\b/;

const sourceFiles = repositoryFiles(API_SOURCE_FOLDER);

type WranglerConfiguration = {
  name: string;
  account_id: string;
  d1_databases: { binding: string; database_name: string; database_id: string; preview_database_id: string }[];
  routes: { pattern: string; custom_domain: boolean }[];
  vars: Record<string, string>;
  ratelimits: { name: string; namespace_id: string; simple: { limit: number; period: number } }[];
  workers_dev: boolean;
  preview_urls: boolean;
};

type PackageManifest = { scripts?: Record<string, string> };

function filesMatching(pattern: RegExp): string[] {
  return sourceFiles.filter((path) => pattern.test(readRepositoryFile(path)));
}

function wranglerConfiguration(): WranglerConfiguration {
  return JSON.parse(readRepositoryFile(WRANGLER_CONFIGURATION).replace(TRAILING_COMMA_PATTERN, '$1')) as WranglerConfiguration;
}

function scriptCommands(path: string): [string, string][] {
  const { scripts } = JSON.parse(readRepositoryFile(path)) as PackageManifest;
  if (scripts === undefined) return [];
  return Object.entries(scripts);
}

function apiScript(name: string): string {
  const entry = scriptCommands(PACKAGE_MANIFEST).find(([scriptName]) => scriptName === name);
  if (entry === undefined) throw new Error(`the api has no ${name} script`);
  const [, command] = entry;
  return command;
}

function scriptsNaming(flag: string): string[] {
  return repositoryFiles(PACKAGE_MANIFESTS_PATHSPEC).flatMap((path) =>
    scriptCommands(path)
      .filter(([, command]) => command.includes(flag))
      .map(([name]) => `${path}: ${name}`),
  );
}

function projectSetting(pattern: RegExp): string | undefined {
  return pattern.exec(readRepositoryFile(MACOS_PROJECT))?.[FIRST_CAPTURE];
}

describe('the api source', () => {
  test('the repository has api source files to check', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  test('only the development email sender names console, so no other log carries a task, a secret or a digest', () => {
    expect(filesMatching(CONSOLE_IDENTIFIER)).toEqual([CONSOLE_EMAIL_SENDER]);
  });

  test('the wrangler configuration is production: the email provider, the cloudflare sender and the https origin on todz.app', () => {
    expect(wranglerConfiguration().vars).toEqual({
      SIGN_IN_PROVIDER: 'email',
      EMAIL_SENDER: 'cloudflare',
      PUBLIC_ORIGIN: PRODUCTION_ORIGIN,
    });
  });

  test('the wrangler configuration never names the fake provider or the console sender', () => {
    expect(readRepositoryFile(WRANGLER_CONFIGURATION)).not.toMatch(NO_LOCAL_PROVIDER_PATTERN);
  });

  test('the wrangler configuration binds the todz-directory database by its id', () => {
    const [directory, ...others] = wranglerConfiguration().d1_databases;
    expect(others).toEqual([]);
    expect(directory).toMatchObject({
      binding: 'DIRECTORY',
      database_name: PRODUCTION_DATABASE_NAME,
      database_id: PRODUCTION_DATABASE_ID,
    });
  });

  test('the wrangler configuration names the todz account, so no other account can be deployed to by mistake', () => {
    expect(wranglerConfiguration().account_id).toBe(ACCOUNT_ID);
  });

  test('the database has a preview id that is not the production one, so wrangler dev --remote fails closed', () => {
    const [directory] = wranglerConfiguration().d1_databases;
    expect(directory?.preview_database_id).toBe(PREVIEW_DATABASE_ID);
    expect(directory?.preview_database_id).not.toBe(directory?.database_id);
  });

  test('the wrangler configuration serves api.todz.app as a custom domain and no other host', () => {
    const configuration = wranglerConfiguration();
    expect(configuration.routes).toEqual([{ pattern: PRODUCTION_HOST, custom_domain: true }]);
    expect(configuration.workers_dev).toBe(false);
    expect(configuration.preview_urls).toBe(false);
  });

  test('the wrangler configuration limits the sign-in posts per client with the shared limits', () => {
    expect(wranglerConfiguration().ratelimits).toEqual([
      {
        name: 'SIGN_IN_LIMITER',
        namespace_id: RATE_LIMIT_NAMESPACE_ID,
        simple: { limit: RATE_LIMIT_MAX, period: RATE_LIMIT_PERIOD_SECONDS },
      },
    ]);
  });

  test('every cloudflare resource name starts with todz', () => {
    const configuration = wranglerConfiguration();
    const names = [configuration.name, ...configuration.d1_databases.map((database) => database.database_name)];
    expect(names.filter((name) => !name.startsWith(RESOURCE_NAME_PREFIX))).toEqual([]);
  });

  test('no package script reaches a remote Cloudflare resource', () => {
    expect(scriptsNaming(REMOTE_FLAG)).toEqual([]);
  });

  test('the wrangler configuration binds EMAIL to the one allowed sender', () => {
    const configuration = readRepositoryFile(WRANGLER_CONFIGURATION);
    expect(configuration).toMatch(SEND_EMAIL_BINDING_PATTERN);
  });

  test('the static assets never answer before the Worker on an API path', () => {
    const configuration = readRepositoryFile(WRANGLER_CONFIGURATION);
    expect(configuration).toMatch(ASSETS_PATTERN);
  });

  test.each([
    { script: DEV_SCRIPT, variables: ['--var SIGN_IN_PROVIDER:fake', '--var EMAIL_SENDER:console'] },
    { script: DEV_EMAIL_SCRIPT, variables: ['--var SIGN_IN_PROVIDER:email', '--var EMAIL_SENDER:console'] },
    { script: DEV_EMAIL_CLOUDFLARE_SCRIPT, variables: ['--var SIGN_IN_PROVIDER:email', '--var EMAIL_SENDER:cloudflare'] },
  ])(
    'the $script script migrates todz-directory locally, then runs wrangler dev with the development overrides',
    ({ script, variables }) => {
      const command = apiScript(script);
      expect(command.indexOf(MIGRATIONS_COMMAND)).toBeGreaterThanOrEqual(0);
      expect(command.indexOf(MIGRATIONS_COMMAND)).toBeLessThan(command.indexOf(DEV_COMMAND));
      [...variables, LOCAL_ORIGIN_VARIABLE, LOCAL_UPSTREAM_FLAG].forEach((fragment) => expect(command).toContain(fragment));
    },
  );

  test('only the routing module and the env type name the project store namespace', () => {
    expect(filesMatching(PROJECT_STORE_IDENTIFIER).filter((path) => ![ROUTING_MODULE, ENV_MODULE].includes(path))).toEqual([]);
  });
});

describe('the macOS app api address', () => {
  test('Debug talks to the local Worker and Release to api.todz.app', () => {
    expect(projectSetting(DEBUG_API_BASE_URL_PATTERN)).toBe(LOCAL_ORIGIN);
    expect(projectSetting(RELEASE_API_BASE_URL_PATTERN)).toBe(PRODUCTION_ORIGIN);
  });

  test('the Info.plist reads the build setting instead of a literal address', () => {
    expect(readRepositoryFile(MACOS_PROJECT)).toMatch(INFO_PLIST_API_BASE_URL_PATTERN);
  });
});
