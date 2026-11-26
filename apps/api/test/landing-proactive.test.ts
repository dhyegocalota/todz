import { formatShortId } from '@todz/core';
import { describe, expect, test } from 'vitest';
import { DAY_EMAIL_COPY } from '../scripts/emails/day-email-copy';
import { escapedHtml } from '../src/escaped-html';
import { EmailSlot } from '../src/emails/email-slot';
import { MCP_COPY } from '../src/mcp-copy';
import { LANDING_COPY, LANDING_DAY_LINES } from '../src/site/landing-copy';
import { LANDING_MARKDOWN_FILE } from '../src/site/landing-markdown';
import { serveLandingPage } from '../src/site/landing-page';
import { DISCOVERY_FILES } from '../src/site/site-discovery';
import { DiscoveryPath } from '../src/site/site-urls';
import { SITE_STYLE } from '../src/site/site-style';
import mainWindowCopySource from '../../macos/Copy/MainWindowCopy.swift?raw';
import menuBarCopySource from '../../macos/Copy/MenuBarCopy.swift?raw';
import shortcutsSource from '../../macos/Todz/Shortcuts/TodzShortcuts.swift?raw';
import { swiftCopyValue } from '../../../tools/repository-shape/src/swift-copy';

const { day } = LANDING_COPY.benefits;
const EXAMPLE_DUE_COUNT = 3;
const EXAMPLE_TASK_NUMBER = 12;
const STOP_TIMES = ['07:00', '09:00', '10:30', '18:00'];
const DAY_CARD_OPENING = '<li class="benefit-card benefit-card-day glass reveal">';
const PLAIN_CARD_OPENING = '<li class="benefit-card glass reveal">';
const TIME_PATTERN = /<time class="day-time" datetime="([^"]+)">/g;
const FIRST_CAPTURE = 1;
const INLINE_HANDLER_PATTERN = /\son[a-z]+=/i;
const STYLE_ATTRIBUTE_PATTERN = /\sstyle=/i;
const STRUCTURED_DATA_PATTERN = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
const MOTION_MEDIA = '@media (prefers-reduced-motion: no-preference){';
const REDUCED_MOTION_MEDIA = '@media (prefers-reduced-motion: reduce){';
const FORCED_COLORS_MEDIA = '@media (forced-colors: active){';
const DAY_ANIMATION_PATTERN = /\.day-[^{}]*\{[^}]*animation/;
const SWIFT_APPLICATION_NAME = '\\(.applicationName)';
const APPLICATION_NAME = 'todz';
const SIRI_PHRASE_PATTERN = /“(.+)\?”/;
const PROACTIVE_LINE_COUNT = 7;
const RIBBON_JOINER = ' · next: ';
const FOCUS_OVERSTATEMENT = 'quiets them all';
const PROACTIVE_FACTS = [
  /Morning glance/,
  /18:00 Close the day/,
  /07:00 Your day, by email/,
  /Your agents know/,
  /Menu bar ribbon/,
  /Day temperature/,
  /Siri/,
];

async function landingHtml(): Promise<string> {
  return serveLandingPage({ stars: null }).text();
}

function dayCardOf(html: string): string {
  const start = html.indexOf(DAY_CARD_OPENING);
  return html.slice(start, html.indexOf(PLAIN_CARD_OPENING, start));
}

function discoveryBodyOf(path: DiscoveryPath): string {
  const file = DISCOVERY_FILES.find((candidate) => candidate.path === path);
  if (file === undefined) throw new Error(`${path} is not a discovery file`);
  return file.body;
}

function blockOf({ style, media, nextMedia }: { style: string; media: string; nextMedia: string }): string {
  return style.slice(style.indexOf(media), style.indexOf(nextMedia));
}

describe('the proactive day copy', () => {
  test('U1. says todz does not wait to be opened, and the glance card is gone', () => {
    expect(day.title).toBe("todz doesn't wait to be opened.");
    expect(LANDING_COPY.benefits).not.toHaveProperty('glance');
  });

  test('U4. the note says each one but Siri is a switch and Respect Focus keeps the Mac quiet, never that it quiets them all', () => {
    expect(day.note).toBe('Each one but Siri is a switch in Settings. Respect Focus keeps your Mac quiet during a Focus.');
    expect(day.note).not.toContain(FOCUS_OVERSTATEMENT);
  });

  test('U5. the agent stop shows the exact line the next tool answers', () => {
    const line = MCP_COPY.agentNudge.line({
      summary: MCP_COPY.agentNudge.due(EXAMPLE_DUE_COUNT),
      taskId: formatShortId(EXAMPLE_TASK_NUMBER),
    });
    expect(day.agent.toolResult).toBe(line);
  });

  test('U6. the mail stop shows the subject the day email sends', () => {
    expect(day.email.subject).toBe(DAY_EMAIL_COPY.subject.replace(EmailSlot.Count, String(EXAMPLE_DUE_COUNT)));
  });

  test('U7. the labels, the ribbon format and the Siri phrase equal the Swift sources', () => {
    expect(day.close.actions).toEqual([
      swiftCopyValue({ text: menuBarCopySource, name: 'done' }),
      swiftCopyValue({ text: mainWindowCopySource, name: 'tomorrow' }),
      swiftCopyValue({ text: menuBarCopySource, name: 'noDate' }),
    ]);
    expect(menuBarCopySource).toContain(`\\(Self.left(count: left))${RIBBON_JOINER}\\(next)`);
    expect(day.extras.ribbon.detail).toContain(RIBBON_JOINER);
    const siriPhrase = SIRI_PHRASE_PATTERN.exec(day.extras.siri.detail)?.[FIRST_CAPTURE];
    if (siriPhrase === undefined) throw new Error('the Siri chip quotes a phrase');
    expect(shortcutsSource).toContain(`"${siriPhrase.replace(APPLICATION_NAME, SWIFT_APPLICATION_NAME)}"`);
  });

  test('keeps the glance count and the close count on the same example', () => {
    expect(day.glance.count).toBe(`${EXAMPLE_DUE_COUNT} left`);
    expect(day.close.count).toBe(`${EXAMPLE_DUE_COUNT} left`);
  });
});

describe('the proactive day card', () => {
  test('is the first benefit card, with the agents and offline cards after it', async () => {
    const html = await landingHtml();
    const cardOpenings = html.match(/<li class="benefit-card[^"]*">/g);
    expect(cardOpenings).toEqual([DAY_CARD_OPENING, PLAIN_CARD_OPENING, PLAIN_CARD_OPENING]);
    expect(html.indexOf(escapedHtml(day.title))).toBeLessThan(html.indexOf(escapedHtml(LANDING_COPY.benefits.agents.title)));
    expect(html).not.toContain(escapedHtml('Your menu bar and widgets'));
  });

  test('U2. renders the four stop times in order, as an ordered list with a label', async () => {
    const card = dayCardOf(await landingHtml());
    const times = Array.from(card.matchAll(TIME_PATTERN), (match) => match[FIRST_CAPTURE]);
    expect(times).toEqual(STOP_TIMES);
    expect(card).toContain(`<ol class="day-rail" aria-label="${escapedHtml(day.railLabel)}">`);
  });

  test('renders each stop caption and keeps every mock out of the accessibility tree', async () => {
    const card = dayCardOf(await landingHtml());
    [day.email, day.glance, day.agent, day.close].forEach(({ title, body }) => {
      expect(card).toContain(escapedHtml(title));
      expect(card).toContain(escapedHtml(body));
    });
    expect(card.match(/<div class="day-mock" aria-hidden="true">/g)).toHaveLength(STOP_TIMES.length);
  });

  test('U3. renders the ribbon, temperature and Siri chips with their labels and details', async () => {
    const card = dayCardOf(await landingHtml());
    expect(card).toContain(`aria-label="${escapedHtml(day.extras.label)}"`);
    [day.extras.ribbon, day.extras.temperature, day.extras.siri].forEach(({ label, detail }) => {
      expect(card).toContain(escapedHtml(label));
      expect(card).toContain(escapedHtml(detail));
    });
    expect(card.match(/<li class="day-extra">/g)).toHaveLength(3);
  });

  test('U4. shows the note under the title', async () => {
    const card = dayCardOf(await landingHtml());
    expect(card).toContain(`<p class="day-note">${escapedHtml(day.note)}</p>`);
    expect(card).not.toContain(FOCUS_OVERSTATEMENT);
  });

  test('titles the card with an h3 under the hidden section heading', async () => {
    const card = dayCardOf(await landingHtml());
    expect(card).toContain(`<h3 class="section-title day-title">${escapedHtml(day.title)}</h3>`);
  });

  test('U8. carries no style attribute and no inline handler, on the card or on the page', async () => {
    const html = await landingHtml();
    const card = dayCardOf(html);
    expect(card.length).toBeGreaterThan(0);
    expect(card).not.toMatch(STYLE_ATTRIBUTE_PATTERN);
    expect(card).not.toMatch(INLINE_HANDLER_PATTERN);
    expect(html).not.toMatch(STYLE_ATTRIBUTE_PATTERN);
  });
});

describe('the proactive day style', () => {
  test('declares every day animation inside the no-preference block, so the resting state is complete', () => {
    const outsideMotion = SITE_STYLE.replace(blockOf({ style: SITE_STYLE, media: MOTION_MEDIA, nextMedia: REDUCED_MOTION_MEDIA }), '');
    expect(outsideMotion).not.toMatch(DAY_ANIMATION_PATTERN);
    const motion = blockOf({ style: SITE_STYLE, media: MOTION_MEDIA, nextMedia: REDUCED_MOTION_MEDIA });
    expect(motion).toContain('@supports (animation-timeline: view())');
    expect(motion).toContain('view-timeline-name:--day');
  });

  test('draws the track, dots and pills in system colours under forced colours', () => {
    const forcedColors = SITE_STYLE.slice(SITE_STYLE.indexOf(FORCED_COLORS_MEDIA));
    expect(forcedColors).toContain('.day-dot');
    expect(forcedColors).toContain('.day-action');
  });
});

describe('the proactive day in the markdown alternate', () => {
  test('U9. has a heading for the card with the four stop lines, and no glance card', () => {
    const { body } = LANDING_MARKDOWN_FILE;
    expect(body).toContain(`### ${day.title}`);
    const stopLines = [day.email, day.glance, day.agent, day.close].map(({ time, title, body: text }) => `- ${time} ${title}: ${text}`);
    const indexes = stopLines.map((line) => body.indexOf(line));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((first, second) => first - second));
    expect(body).toContain(day.note);
    expect(body).not.toContain('Your menu bar and widgets');
  });
});

describe('the proactive day in the structured data', () => {
  test('U10. lists the morning glance, the 18:00 close, the 07:00 mail, the agent mention, the ribbon, the temperature and Siri', async () => {
    const html = await landingHtml();
    const structuredData = STRUCTURED_DATA_PATTERN.exec(html)?.[FIRST_CAPTURE];
    if (structuredData === undefined) throw new Error('the landing carries structured data');
    const graph: { '@graph': { featureList?: string[] }[] } = JSON.parse(structuredData);
    const featureLists = graph['@graph'].map((node) => node.featureList).filter((list): list is string[] => list !== undefined);
    const featureList = featureLists.flat();
    expect(featureList).toEqual(LANDING_DAY_LINES);
    PROACTIVE_FACTS.forEach((fact) => expect(featureList.some((feature) => fact.test(feature))).toBe(true));
  });
});

describe('the proactive day in llms.txt', () => {
  test('U11. has one line per proactive feature, in the wording of the card', () => {
    [DiscoveryPath.Llms, DiscoveryPath.LlmsFull].forEach((path) => {
      const lines = discoveryBodyOf(path).split('\n');
      expect(LANDING_DAY_LINES).toHaveLength(PROACTIVE_LINE_COUNT);
      LANDING_DAY_LINES.forEach((line) => expect(lines).toContain(line));
    });
  });
});
