import { REPOSITORY } from '@todz/types';
import { DISCOVERY_COPY } from './discovery-copy';
import type { DiscoveryFile } from './discovery-response';
import { LANDING_COPY, LANDING_DAY_LINES } from './landing-copy';
import { fenced, linesOf } from './markdown-lines';
import { DOCS_INSTALL_URL, DOWNLOAD_URL } from './site-urls';

export const MARKDOWN_MEDIA_TYPE = 'text/markdown';
export const MARKDOWN_CONTENT_TYPE = `${MARKDOWN_MEDIA_TYPE}; charset=utf-8`;

const { meta, hero, download, openSource, benefits, howItWorks, terminal, final } = LANDING_COPY;

const LANDING_MARKDOWN = linesOf([
  `# ${meta.title}`,
  '',
  `> ${meta.description}`,
  '',
  `${hero.eyebrow}. ${hero.lead}`,
  '',
  `[${download.button}](${DOWNLOAD_URL})`,
  '',
  `${download.note} [${download.noteLink}](${DOCS_INSTALL_URL})`,
  '',
  DISCOVERY_COPY.pricing,
  '',
  `[${openSource.starLabel}](${REPOSITORY.url}) · ${REPOSITORY.licenseName}`,
  '',
  `## ${benefits.heading}`,
  '',
  `### ${benefits.day.title}`,
  '',
  ...LANDING_DAY_LINES.map((line) => `- ${line}`),
  '',
  benefits.day.note,
  '',
  ...[benefits.agents, benefits.offline, benefits.lock].flatMap(({ title, body }) => [`### ${title}`, '', body, '']),
  `## ${howItWorks.title}`,
  '',
  ...[howItWorks.step1, howItWorks.step2, howItWorks.step3].map((step, index) => `${index + 1}. ${step}`),
  '',
  ...fenced({ language: 'bash', text: terminal.command }),
  `## ${final.title}`,
  '',
  `[${download.button}](${DOWNLOAD_URL})`,
]);

export const LANDING_MARKDOWN_FILE: Omit<DiscoveryFile, 'path' | 'headers'> = {
  contentType: MARKDOWN_CONTENT_TYPE,
  body: LANDING_MARKDOWN,
};
