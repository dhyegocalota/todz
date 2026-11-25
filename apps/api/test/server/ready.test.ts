import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { publicOriginInWranglerText, readyLine } from '../../scripts/server/ready-line';

const WRANGLER_CONFIGURATION = join(import.meta.dirname, '..', '..', 'wrangler.jsonc');
const PRODUCTION_ORIGIN = 'https://api.todz.app';
const SELF_HOSTED_ORIGIN = 'https://api.example.com';
const READY_LINE = `todz server ready: ${SELF_HOSTED_ORIGIN}  →  paste it in todz › Settings › Server`;
const WITH_TRAILING_COMMAS = '{\n  "vars": {\n    "PUBLIC_ORIGIN": "https://api.example.com",\n  },\n}\n';
const WITHOUT_PUBLIC_ORIGIN = '{\n  "vars": {\n    "SITE_ORIGIN": "https://example.com",\n  },\n}\n';
const WITH_LINE_COMMENTS =
  '{\n  // the Worker\'s own origin\n  "vars": {\n    "PUBLIC_ORIGIN": "https://api.example.com", // what /health answers\n  },\n}\n';
const MISSING_MESSAGE = 'PUBLIC_ORIGIN is missing from the Wrangler configuration';

describe('the ready line', () => {
  test('names the public origin and where to paste it', () => {
    expect(readyLine({ publicOrigin: SELF_HOSTED_ORIGIN })).toBe(READY_LINE);
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
