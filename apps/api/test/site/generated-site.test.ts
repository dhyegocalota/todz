import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { GENERATED_SITE_PATH, generatedSiteSource } from '../../scripts/site/generated-site';

const HREF_PATTERN = /href=\\?"([^"\\]*)\\?"/g;
const KEPT_LINK_PATTERN = /^(?:https:\/\/|#)/;

describe('the generated self-host page', () => {
  test('matches what pnpm site:generate renders from docs/self-host.md today', async () => {
    expect(readFileSync(GENERATED_SITE_PATH, 'utf8')).toBe(await generatedSiteSource());
  });

  test('links no repository-relative path, while the repository is private', () => {
    const hrefs = [...readFileSync(GENERATED_SITE_PATH, 'utf8').matchAll(HREF_PATTERN)].flatMap((match) => match.slice(1, 2));
    expect(hrefs.filter((href) => !KEPT_LINK_PATTERN.test(href))).toEqual([]);
  });
});
