import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { deployArguments } from '../../scripts/server/deploy-arguments';
import { publicOriginInWranglerText, readyLine } from '../../scripts/server/ready-line';

const WRANGLER_CONFIGURATION = join(import.meta.dirname, '..', '..', 'wrangler.jsonc');
const PACKAGE_MANIFEST = join(import.meta.dirname, '..', '..', 'package.json');
const PRODUCTION_ORIGIN = 'https://api.todz.app';
const SELF_HOSTED_ORIGIN = 'https://api.example.com';
const SERVER_VERSION = '2026.11.25+3f9c2ab';
const MINIMUM_APP_VERSION = '0.2.0';
const READY_LINE = `todz server ready: ${SELF_HOSTED_ORIGIN} · server ${SERVER_VERSION} · accepts app ${MINIMUM_APP_VERSION} or later  →  paste it in todz › Settings › Server`;
const DEPLOY_ARGUMENTS = ['deploy', '--define', `TODZ_SERVER_VERSION:"${SERVER_VERSION}"`];
const EXTRA_ARGUMENTS = ['--assets', '/stage', '--message', '3f9c2ab'];
const DEPLOY_SCRIPT = 'tsx scripts/server/cli.ts';
const WITH_TRAILING_COMMAS = '{\n  "vars": {\n    "PUBLIC_ORIGIN": "https://api.example.com",\n  },\n}\n';
const WITHOUT_PUBLIC_ORIGIN = '{\n  "vars": {\n    "SITE_ORIGIN": "https://example.com",\n  },\n}\n';
const WITH_LINE_COMMENTS =
  '{\n  // the Worker\'s own origin\n  "vars": {\n    "PUBLIC_ORIGIN": "https://api.example.com", // what /health answers\n  },\n}\n';
const MISSING_MESSAGE = 'PUBLIC_ORIGIN is missing from the Wrangler configuration';

describe('the ready line', () => {
  test('names the public origin, both versions and where to paste it', () => {
    expect(readyLine({ publicOrigin: SELF_HOSTED_ORIGIN, serverVersion: SERVER_VERSION, minimumAppVersion: MINIMUM_APP_VERSION })).toBe(
      READY_LINE,
    );
  });
});

describe('the deploy arguments', () => {
  test('hand the stamp to wrangler as a define, quoted as a string', () => {
    expect(deployArguments({ serverVersion: SERVER_VERSION, extraArguments: [] })).toEqual(DEPLOY_ARGUMENTS);
  });

  test('carry the arguments the caller adds, after the stamp, so a staged deploy is stamped too', () => {
    expect(deployArguments({ serverVersion: SERVER_VERSION, extraArguments: EXTRA_ARGUMENTS })).toEqual([
      ...DEPLOY_ARGUMENTS,
      ...EXTRA_ARGUMENTS,
    ]);
  });

  test('are what the server:deploy script runs: the stamping script, not a bare wrangler deploy', () => {
    const manifest = JSON.parse(readFileSync(PACKAGE_MANIFEST, 'utf8')) as { scripts: Record<string, string> };
    expect(manifest.scripts['server:deploy']).toBe(DEPLOY_SCRIPT);
  });
});

describe('the public origin of a Wrangler configuration', () => {
  test('is read from a JSONC text with trailing commas', () => {
    expect(publicOriginInWranglerText(WITH_TRAILING_COMMAS)).toBe(SELF_HOSTED_ORIGIN);
  });

  test('is read from a JSONC text with line comments, keeping the slashes inside its strings', () => {
    expect(publicOriginInWranglerText(WITH_LINE_COMMENTS)).toBe(SELF_HOSTED_ORIGIN);
  });

  test('is the production origin in the configuration as it stands', () => {
    expect(publicOriginInWranglerText(readFileSync(WRANGLER_CONFIGURATION, 'utf8'))).toBe(PRODUCTION_ORIGIN);
  });

  test('is required: a text without it throws', () => {
    expect(() => publicOriginInWranglerText(WITHOUT_PUBLIC_ORIGIN)).toThrow(MISSING_MESSAGE);
  });
});
