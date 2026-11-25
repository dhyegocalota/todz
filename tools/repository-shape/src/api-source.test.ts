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
const DEV_SITE_SCRIPT = 'dev:site';
const LOCAL_SITE_ORIGIN = 'http://localhost:8788';
const LOCAL_SITE_ORIGIN_VARIABLE = `--var SITE_ORIGIN:${LOCAL_SITE_ORIGIN}`;
const LOCAL_SITE_PORT_FLAG = '--port 8788';
const LOCAL_SITE_UPSTREAM_FLAG = '--local-upstream localhost:8788';
const ASSET_HEADERS_FILE = 'apps/api/public/_headers';
const ASSET_HEADERS_PATTERN =
  /^\/\*\n {2}X-Content-Type-Options: nosniff\n {2}Strict-Transport-Security: max-age=31536000\n {2}Referrer-Policy: no-referrer\n\n\/icon\.svg\n {2}Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\n$/;
const SITE_HOST = 'todz.app';
const SITE_ORIGIN = `https://${SITE_HOST}`;
const TURNSTILE_SITE_KEY = '0x4AAAAAAGSI2K7Qe9Vad2nL';
const WWW_HOST = `www.${SITE_HOST}`;
const REMOTE_FLAG = '--remote';
const PRODUCTION_DATABASE_NAME = 'todz-directory';
const PRODUCTION_DATABASE_ID = 'dc22b1c3-1869-44a0-b805-91bf92017f19';
const PRODUCTION_HOST = 'api.todz.app';
const PRODUCTION_ORIGIN = `https://${PRODUCTION_HOST}`;
const RATE_LIMIT_NAMESPACE_ID = '8601';
const ADDRESS_RATE_LIMIT_NAMESPACE_ID = '8602';
const GLOBAL_RATE_LIMIT_NAMESPACE_ID = '8603';
const WAITLIST_RATE_LIMIT_NAMESPACE_ID = '8604';
const WAITLIST_ADDRESS_RATE_LIMIT_NAMESPACE_ID = '8605';
const WAITLIST_GLOBAL_RATE_LIMIT_NAMESPACE_ID = '8606';
const ADMIN_RATE_LIMIT_NAMESPACE_ID = '8607';
const ADMIN_ADDRESS_RATE_LIMIT_NAMESPACE_ID = '8608';
const ADMIN_GLOBAL_RATE_LIMIT_NAMESPACE_ID = '8609';
const LOCAL_ADMIN_EMAIL_VARIABLE = '--var ADMIN_EMAIL:admin@todz.test';
const ACCOUNT_ID = 'e2035d8e0b7173d520ccf643f6f4661c';
const PREVIEW_DATABASE_ID = '00000000-0000-0000-0000-000000000000';
const RATE_LIMIT_PERIOD_SECONDS = 60;
const SHARED_CONSTANTS = 'libs/types/src/constants.ts';
const TURNSTILE_SECRET_NAME = 'TURNSTILE_SECRET_KEY';
const TURNSTILE_TEST_KEY_VARIABLES = [
  '--var TURNSTILE_SITE_KEY:1x00000000000000000000AA',
  '--var TURNSTILE_SECRET_KEY:1x0000000000000000000000000000000AA',
];
const RESOURCE_NAME_PREFIX = 'todz';
const TRAILING_COMMA_PATTERN = /,(\s*[}\]])/g;
const NO_LOCAL_PROVIDER_PATTERN = /"(fake|console)"/;
const SEND_EMAIL_BINDING_PATTERN =
  /"send_email":\s*\[\s*\{\s*"name":\s*"EMAIL",\s*"allowed_sender_addresses":\s*\["noreply@todz\.app"\]\s*,?\s*\}\s*,?\s*\]/;
const ASSETS_PATTERN =
  /"assets":\s*\{\s*"directory":\s*"\.\/public",\s*"run_worker_first":\s*\["\/owner",\s*"\/owner\/\*",\s*"\/mcp",\s*"\/sign-in",\s*"\/sign-in\/challenge",\s*"\/health"\]\s*,?\s*\}/;
const DEBUG_API_BASE_URL_PATTERN = /configs:\s*\n\s+Debug:\s*\n\s+TODZ_API_BASE_URL: (\S+)\s*\n/;
const RELEASE_API_BASE_URL_PATTERN = /\n\s+Release:\s*\n\s+TODZ_API_BASE_URL: (\S+)\s*\n/;
const INFO_PLIST_API_BASE_URL_PATTERN = /TodzAPIBaseURL: \$\(TODZ_API_BASE_URL\)/;
const FIRST_CAPTURE = 1;
const CONSOLE_IDENTIFIER = /\bconsole\b/;
const CONSOLE_DAY_EMAIL_LOG = 'apps/api/src/day-email/day-email-log.ts';
const CONSOLE_EMAIL_SENDER = 'apps/api/src/email-sender.ts';
const SCHEDULED_MODULE = 'apps/api/src/scheduled.ts';
const DIGEST_CRON = '0 11 * * *';
const DAY_EMAIL_CRON = '*/15 * * * *';
const SCHEDULED_CRON_ENUM_PATTERN = /enum ScheduledCron \{([^}]*)\}/;
const QUOTED_VALUE_PATTERN = /'([^']+)'/g;
const PRODUCTION_OBSERVABILITY = { enabled: true, logs: { invocation_logs: false } };
const DIGEST_CRON_PATTERN = /enum ScheduledCron \{\s*WaitlistDigest = '([^']+)'/;
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
  triggers: { crons: string[] };
  observability: unknown;
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

function sharedLimit(name: string): number {
  const value = new RegExp(`export const ${name} = (\\d+);`).exec(readRepositoryFile(SHARED_CONSTANTS))?.[FIRST_CAPTURE];
  if (value === undefined) throw new Error(`libs/types declares no ${name}`);
  return Number(value);
}

function projectSetting(pattern: RegExp): string | undefined {
  return pattern.exec(readRepositoryFile(MACOS_PROJECT))?.[FIRST_CAPTURE];
}

describe('the api source', () => {
  test('the repository has api source files to check', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  test('only the development email sender and the day email log name console, so no other log carries a task, a secret or a digest', () => {
    expect(filesMatching(CONSOLE_IDENTIFIER)).toEqual([CONSOLE_DAY_EMAIL_LOG, CONSOLE_EMAIL_SENDER]);
  });

  test('the wrangler configuration is production: the email provider, the cloudflare sender and the https origin on todz.app, the public Turnstile site key as a var, and no admin address or Turnstile secret, which are secrets', () => {
    expect(wranglerConfiguration().vars).toEqual({
      SIGN_IN_PROVIDER: 'email',
      EMAIL_SENDER: 'cloudflare',
      PUBLIC_ORIGIN: PRODUCTION_ORIGIN,
      SITE_ORIGIN,
      TURNSTILE_SITE_KEY,
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

  test('the wrangler configuration serves api.todz.app, todz.app and www.todz.app as custom domains and no other host', () => {
    const configuration = wranglerConfiguration();
    expect(configuration.routes).toEqual([PRODUCTION_HOST, SITE_HOST, WWW_HOST].map((pattern) => ({ pattern, custom_domain: true })));
    expect(configuration.workers_dev).toBe(false);
    expect(configuration.preview_urls).toBe(false);
  });

  test('the wrangler configuration triggers the waitlist digest once a day at 11:00 UTC, the day email every quarter hour and nothing else', () => {
    expect(wranglerConfiguration().triggers).toEqual({ crons: [DIGEST_CRON, DAY_EMAIL_CRON] });
  });

  test('every cron the worker dispatches is one the wrangler configuration triggers, and every trigger is dispatched', () => {
    const enumBody = SCHEDULED_CRON_ENUM_PATTERN.exec(readRepositoryFile(SCHEDULED_MODULE))?.[FIRST_CAPTURE];
    if (enumBody === undefined) throw new Error('scheduled.ts declares no ScheduledCron');
    const dispatchedCrons = [...enumBody.matchAll(QUOTED_VALUE_PATTERN)].map((match) => match[FIRST_CAPTURE]);
    expect([...dispatchedCrons].sort()).toEqual([...wranglerConfiguration().triggers.crons].sort());
  });

  test('the wrangler configuration turns Workers Logs on with invocation logs off, so the envelope addresses of a mail are never kept', () => {
    expect(wranglerConfiguration().observability).toEqual(PRODUCTION_OBSERVABILITY);
  });

  test('the digest cron the worker runs is the one the wrangler configuration triggers', () => {
    const [digestCron] = wranglerConfiguration().triggers.crons;
    expect(DIGEST_CRON_PATTERN.exec(readRepositoryFile(SCHEDULED_MODULE))?.[FIRST_CAPTURE]).toBe(digestCron);
  });

  test('the wrangler configuration limits sign-in, the waitlist and the admin per client, per address and globally with the shared limits', () => {
    expect(wranglerConfiguration().ratelimits).toEqual([
      {
        name: 'SIGN_IN_LIMITER',
        namespace_id: RATE_LIMIT_NAMESPACE_ID,
        simple: { limit: sharedLimit('SIGN_IN_RATE_LIMIT_MAX'), period: RATE_LIMIT_PERIOD_SECONDS },
      },
      {
        name: 'SIGN_IN_ADDRESS_LIMITER',
        namespace_id: ADDRESS_RATE_LIMIT_NAMESPACE_ID,
        simple: { limit: sharedLimit('SIGN_IN_ADDRESS_RATE_LIMIT_MAX'), period: RATE_LIMIT_PERIOD_SECONDS },
      },
      {
        name: 'SIGN_IN_GLOBAL_LIMITER',
        namespace_id: GLOBAL_RATE_LIMIT_NAMESPACE_ID,
        simple: { limit: sharedLimit('SIGN_IN_GLOBAL_RATE_LIMIT_MAX'), period: RATE_LIMIT_PERIOD_SECONDS },
      },
      {
        name: 'WAITLIST_LIMITER',
        namespace_id: WAITLIST_RATE_LIMIT_NAMESPACE_ID,
        simple: { limit: sharedLimit('WAITLIST_RATE_LIMIT_MAX'), period: RATE_LIMIT_PERIOD_SECONDS },
      },
      {
        name: 'WAITLIST_ADDRESS_LIMITER',
        namespace_id: WAITLIST_ADDRESS_RATE_LIMIT_NAMESPACE_ID,
        simple: { limit: sharedLimit('WAITLIST_ADDRESS_RATE_LIMIT_MAX'), period: RATE_LIMIT_PERIOD_SECONDS },
      },
      {
        name: 'WAITLIST_GLOBAL_LIMITER',
        namespace_id: WAITLIST_GLOBAL_RATE_LIMIT_NAMESPACE_ID,
        simple: { limit: sharedLimit('WAITLIST_GLOBAL_RATE_LIMIT_MAX'), period: RATE_LIMIT_PERIOD_SECONDS },
      },
      {
        name: 'ADMIN_LIMITER',
        namespace_id: ADMIN_RATE_LIMIT_NAMESPACE_ID,
        simple: { limit: sharedLimit('ADMIN_RATE_LIMIT_MAX'), period: RATE_LIMIT_PERIOD_SECONDS },
      },
      {
        name: 'ADMIN_ADDRESS_LIMITER',
        namespace_id: ADMIN_ADDRESS_RATE_LIMIT_NAMESPACE_ID,
        simple: { limit: sharedLimit('ADMIN_ADDRESS_RATE_LIMIT_MAX'), period: RATE_LIMIT_PERIOD_SECONDS },
      },
      {
        name: 'ADMIN_GLOBAL_LIMITER',
        namespace_id: ADMIN_GLOBAL_RATE_LIMIT_NAMESPACE_ID,
        simple: { limit: sharedLimit('ADMIN_GLOBAL_RATE_LIMIT_MAX'), period: RATE_LIMIT_PERIOD_SECONDS },
      },
    ]);
  });

  test('every rate-limit binding of the wrangler configuration is an optional RateLimit of the Worker environment', () => {
    const environment = readRepositoryFile(ENV_MODULE);
    const names = wranglerConfiguration().ratelimits.map(({ name }) => name);
    expect(names.filter((name) => !environment.includes(`${name}?: RateLimit;`))).toEqual([]);
  });

  test('the wrangler configuration never holds the Turnstile secret, which is a Worker secret', () => {
    expect(readRepositoryFile(WRANGLER_CONFIGURATION)).not.toContain(TURNSTILE_SECRET_NAME);
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
      [
        ...variables,
        ...TURNSTILE_TEST_KEY_VARIABLES,
        LOCAL_ORIGIN_VARIABLE,
        LOCAL_SITE_ORIGIN_VARIABLE,
        LOCAL_ADMIN_EMAIL_VARIABLE,
        LOCAL_UPSTREAM_FLAG,
      ].forEach((fragment) => expect(command).toContain(fragment));
    },
  );

  test('the dev:site script runs a second instance on port 8788 with the same overrides, upstream included, so request urls carry the site host', () => {
    const command = apiScript(DEV_SITE_SCRIPT);
    const siteFragments = [
      LOCAL_SITE_PORT_FLAG,
      LOCAL_SITE_UPSTREAM_FLAG,
      LOCAL_SITE_ORIGIN_VARIABLE,
      LOCAL_ORIGIN_VARIABLE,
      LOCAL_ADMIN_EMAIL_VARIABLE,
    ];
    siteFragments.forEach((fragment) => expect(command).toContain(fragment));
    expect(command).not.toContain(LOCAL_UPSTREAM_FLAG);
    expect(command.indexOf(MIGRATIONS_COMMAND)).toBeLessThan(command.indexOf(DEV_COMMAND));
  });

  test('every static file answers with nosniff, strict transport security and no referrer, and the icon with a policy that allows no script', () => {
    expect(readRepositoryFile(ASSET_HEADERS_FILE)).toMatch(ASSET_HEADERS_PATTERN);
  });

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
