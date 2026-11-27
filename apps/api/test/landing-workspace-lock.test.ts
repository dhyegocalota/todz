import { describe, expect, test } from 'vitest';
import { escapedHtml } from '../src/escaped-html';
import { LANDING_COPY, LANDING_LOCK_LINE } from '../src/site/landing-copy';
import { LANDING_MARKDOWN_FILE } from '../src/site/landing-markdown';
import { serveLandingPage } from '../src/site/landing-page';
import { LANDING_SHOTS, LandingShot } from '../src/site/landing-shots';
import { DISCOVERY_FILES } from '../src/site/site-discovery';
import { DiscoveryPath } from '../src/site/site-urls';
import { SITE_STYLE } from '../src/site/site-style';

const { lock } = LANDING_COPY.benefits;
const FIRST_CAPTURE = 1;
const STRUCTURED_DATA_PATTERN = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
const COUNT_PATTERN = /\d|\b(two|three|four|five|several|many|multiple|few|both|secret|private|hidden)\b/gi;
const LOCK_SENTENCES = [lock.title, lock.body];
const LOCK_FACTS = [/Touch ID/, /without a trace/, /Sleep/, /lock/, /quit/];
const CARD_PATTERN = /<li class="benefit-card glass reveal">[\s\S]*?<\/li>/g;
const CARD_TITLE_MAX_WORDS = 5;
const CARD_BODY_MAX_WORDS = 20;
const BENEFIT_CARDS = [LANDING_COPY.benefits.agents, LANDING_COPY.benefits.offline, lock];

function wordCountOf(text: string): number {
  return text.split(/\s+/).length;
}

async function lockCardOf(): Promise<string> {
  const html = await serveLandingPage({ stars: null }).text();
  const card = html.match(CARD_PATTERN)?.find((candidate) => candidate.includes(escapedHtml(lock.title)));
  if (card === undefined) throw new Error('the landing has a workspace lock card');
  return card;
}

function headingOf(title: string): string {
  return `<h3 class="benefit-title">${escapedHtml(title)}</h3>`;
}

function discoveryBodyOf(path: DiscoveryPath): string {
  const file = DISCOVERY_FILES.find((candidate) => candidate.path === path);
  if (file === undefined) throw new Error(`${path} is not a discovery file`);
  return file.body;
}

describe('the workspace lock copy', () => {
  test.each(LOCK_FACTS)('states %s', (fact) => {
    expect(LOCK_SENTENCES.join(' ')).toMatch(fact);
  });

  test('names no number of workspaces and never hints at secrets', () => {
    const hints = Array.from(LOCK_SENTENCES.join(' ').matchAll(COUNT_PATTERN), (match) => match[0]);
    expect(hints).toEqual([]);
  });
});

describe('the benefit cards', () => {
  test.each(BENEFIT_CARDS)('$title keeps the shared title and body length', ({ title, body }) => {
    expect(wordCountOf(title)).toBeLessThanOrEqual(CARD_TITLE_MAX_WORDS);
    expect(wordCountOf(body)).toBeLessThanOrEqual(CARD_BODY_MAX_WORDS);
  });
});

describe('the workspace lock card', () => {
  test('is the third plain benefit card, after the agents and offline cards, with the headline and body', async () => {
    const html = await serveLandingPage({ stars: null }).text();
    const card = await lockCardOf();
    expect(card).toContain(`<h3 class="benefit-title">${escapedHtml(lock.title)}</h3>`);
    expect(card).toContain(`<p class="benefit-body">${escapedHtml(lock.body)}</p>`);
    expect(html.indexOf(headingOf(LANDING_COPY.benefits.offline.title))).toBeLessThan(html.indexOf(headingOf(lock.title)));
  });

  test('has a well with the shot and the lock glyph, and the shot is a named, cropped landing shot', async () => {
    const card = await lockCardOf();
    expect(card).toContain(`class="benefit-shot-agents crop crop-${LandingShot.WorkspaceLock}"`);
    expect(card).toContain(`alt="${escapedHtml(LANDING_COPY.alt.workspaceLock)}"`);
    expect(card).toContain('<svg class="lock-glyph"');
    expect(LANDING_SHOTS[LandingShot.WorkspaceLock].crop).not.toBeNull();
    expect(SITE_STYLE).toContain(`.crop-${LandingShot.WorkspaceLock}{`);
  });

  test('has no inline handler and no inline style, so the strict policy holds', async () => {
    const card = await lockCardOf();
    expect(card).not.toMatch(/\son[a-z]+=/i);
    expect(card).not.toMatch(/\sstyle=/i);
  });
});

describe('the workspace lock beside the other features', () => {
  test('is in the markdown alternate under its own heading', () => {
    expect(LANDING_MARKDOWN_FILE.body).toContain(`### ${lock.title}\n\n${lock.body}`);
  });

  test('is in the structured data feature list', async () => {
    const html = await serveLandingPage({ stars: null }).text();
    const structuredData = STRUCTURED_DATA_PATTERN.exec(html)?.[FIRST_CAPTURE];
    if (structuredData === undefined) throw new Error('the landing carries structured data');
    const graph: { '@graph': { featureList?: string[] }[] } = JSON.parse(structuredData);
    const featureList = graph['@graph']
      .map((node) => node.featureList)
      .filter((list): list is string[] => list !== undefined)
      .flat();
    expect(featureList).toContain(LANDING_LOCK_LINE);
  });

  test.each([DiscoveryPath.Llms, DiscoveryPath.LlmsFull])('is a line of %s', (path) => {
    expect(discoveryBodyOf(path).split('\n')).toContain(LANDING_LOCK_LINE);
  });
});
