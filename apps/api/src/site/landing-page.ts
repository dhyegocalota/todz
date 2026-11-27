import { AUTHOR, Language } from '@todz/types';
import { escapedHtml } from '../escaped-html';
import { HttpHeader } from '../http-header';
import { LANDING_COPY_BY_LANGUAGE } from './landing-copy';
import { WINDOW_SOURCE_MEDIA } from './site-constants';
import { MARKDOWN_MEDIA_TYPE } from './landing-markdown';
import { LANDING_SHOTS, LandingShot } from './landing-shots';
import { MENU_BAR_GLYPH, SIGNATURE_SWASH, SiteGlyph, glyphHtml } from './site-glyphs';
import { siteContentSecurityPolicy, sitePageResponse } from './site-headers';
import { NEGOTIATION_VARY } from './language-routes';
import { LANDING_STRUCTURED_DATA_BY_LANGUAGE } from './site-json-ld';
import { type PagePreferences, Theme } from '../page-preferences';
import { CONTENT_ID, LANDING_PATH, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE, cropClassOf } from './site-style';
import { STAR_COUNT_SCRIPT } from './star-count-script';
import { starPillHtml } from './star-pill';
import { DAY_CARD_ID, DOCS_INSTALL_PAGE, DOCS_SELF_HOST_PAGE, DOWNLOAD_PATH, DiscoveryPath, WAYS_ID, docsUrlOf } from './site-urls';
import { WEBMCP_SCRIPT } from './webmcp-script';

const SRCSET_LIST_SEPARATOR = ', ';
const WORD_SEPARATOR = ' ';
const THEME_SOURCE_ATTRIBUTE = 'data-theme-source';
const LINK_ARROW = '→';

const MARKDOWN_ALTERNATE_LINK = `<${DiscoveryPath.LandingMarkdown}>; rel="alternate"; type="${MARKDOWN_MEDIA_TYPE}"`;

const PAGE_SCRIPTS = [STAR_COUNT_SCRIPT, WEBMCP_SCRIPT];

const CONTENT_SECURITY_POLICY_BY_LANGUAGE = Object.fromEntries(
  await Promise.all(
    Object.values(Language).map(async (language) => [
      language,
      await siteContentSecurityPolicy({
        style: SITE_STYLE,
        scripts: [LANDING_STRUCTURED_DATA_BY_LANGUAGE[language], ...PAGE_SCRIPTS],
        widgetOrigin: null,
        connectsToSelf: true,
        declaresManifest: true,
      }),
    ]),
  ),
) as Record<Language, string>;

function webpSourceAttributes(shot: LandingShot): string {
  const { webp } = LANDING_SHOTS[shot];
  const srcset = webp.map(({ path, width }) => `${path}${WORD_SEPARATOR}${width}w`).join(SRCSET_LIST_SEPARATOR);
  return `srcset="${srcset}" sizes="${Math.min(...webp.map(({ width }) => width))}px"`;
}

function shotImage({ shot, alt }: { shot: LandingShot; alt: string }): string {
  const { path, width, height } = LANDING_SHOTS[shot];
  return `<img src="${path}" ${webpSourceAttributes(shot)} width="${width}" height="${height}" alt="${escapedHtml(alt)}" loading="lazy" decoding="async">`;
}

function darkSourceHtml(theme: Theme): string {
  const { width, height } = LANDING_SHOTS[LandingShot.WindowDark];
  const mediaValue = WINDOW_SOURCE_MEDIA[theme];
  const media = mediaValue === '' ? '' : ` media="${mediaValue}"`;
  return `<source ${THEME_SOURCE_ATTRIBUTE}${media} ${webpSourceAttributes(LandingShot.WindowDark)} width="${width}" height="${height}">`;
}

function windowPicture({ language, theme }: { language: Language; theme: Theme }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  return `<picture>${darkSourceHtml(theme)}${shotImage({ shot: LandingShot.Window, alt: copy.alt.window })}</picture>`;
}

function downloadHtml({ stars, language }: { stars: number | null; language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { heroButton, note, noteLink } = copy.download;
  return `<div class="download hero-actions rise delay-3">
<div class="hero-buttons">
<a class="download-button" href="${DOWNLOAD_PATH}" download>${escapedHtml(heroButton)}</a>
${starPillHtml({ stars, language })}
</div>
<p class="download-note">${escapedHtml(note)} <a class="download-note-link" href="${docsUrlOf({ language, page: DOCS_INSTALL_PAGE })}">${escapedHtml(noteLink)}</a></p>
</div>
`;
}

function pointHtml(point: string): string {
  return `<li class="way-point">${escapedHtml(point)}</li>`;
}

function selfHostTerminalHtml({ language }: { language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { label, command, ready, next } = copy.ways.selfHost.terminal;
  return `<figure class="terminal way-terminal">
<figcaption class="visually-hidden">${escapedHtml(label)}</figcaption>
<div class="terminal-bar" aria-hidden="true"><span class="terminal-dot"></span><span class="terminal-dot"></span><span class="terminal-dot"></span></div>
<pre class="terminal-body"><code><span class="terminal-line"><span class="terminal-prompt">${escapedHtml(copy.terminal.shellPrompt)}</span> <span class="terminal-command">${unbrokenWordsHtml(command)}</span></span><span class="terminal-line terminal-result">${escapedHtml(ready)}</span><span class="terminal-line terminal-result">${escapedHtml(next)}</span></code></pre>
</figure>`;
}

function waysHtml({ stars, language }: { stars: number | null; language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { cloud, selfHost, note } = copy.ways;
  return `<ul class="way-list">
<li class="way-card way-card-cloud glass"><div class="way-head">${glyphHtml({ glyph: SiteGlyph.Icon, className: 'way-icon' })}<h3 class="way-title">${escapedHtml(cloud.title)}</h3><span class="way-badge way-badge-free">${escapedHtml(cloud.badge)}</span></div><ul class="way-points">${cloud.points.map(pointHtml).join('')}</ul><p class="download-note">${escapedHtml(cloud.limit)}</p><a class="download-button way-cta" href="${DOWNLOAD_PATH}" download>${escapedHtml(cloud.cta)}</a><p class="download-note">${escapedHtml(copy.download.note)} <a class="download-note-link" href="${docsUrlOf({ language, page: DOCS_INSTALL_PAGE })}">${escapedHtml(copy.download.noteLink)}</a></p></li>
<li class="way-card glass"><div class="way-head"><h3 class="way-title">${escapedHtml(selfHost.title)}</h3><span class="way-badge">${escapedHtml(selfHost.badge)}</span></div><p class="way-body">${escapedHtml(selfHost.body)}</p>${selfHostTerminalHtml({ language })}<div class="way-actions"><a class="way-link" href="${docsUrlOf({ language, page: DOCS_SELF_HOST_PAGE })}">${escapedHtml(selfHost.cta)}<span class="way-link-arrow" aria-hidden="true">${LINK_ARROW}</span></a>${starPillHtml({ stars, language })}</div></li>
</ul>
<p class="ways-note">${escapedHtml(note)}</p>
`;
}

function signatureHtml({ language }: { language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { line, name } = copy.signature;
  return `<p class="signature glass"><span class="signature-line">${escapedHtml(line)}</span><span class="signature-sign">— <a class="signature-link" href="${AUTHOR.url}" rel="noopener">${escapedHtml(name)}</a>${SIGNATURE_SWASH}</span></p>
`;
}

function freeLineHtml({ language }: { language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { line, linkText } = copy.free;
  const link = `<a class="hero-free-link" href="#${WAYS_ID}">${escapedHtml(linkText)}</a>`;
  return `<p class="hero-free rise delay-2">${escapedHtml(line).replace(escapedHtml(linkText), link)}</p>`;
}

function heroHtml({ stars, language, theme }: { stars: number | null; language: Language; theme: Theme }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  return `<section class="hero page-width" aria-labelledby="hero-title">
<div class="hero-copy">
<p class="eyebrow-pill glass rise"><span class="eyebrow-dot" aria-hidden="true"></span>${escapedHtml(copy.hero.eyebrow)}</p>
<h1 id="hero-title" class="hero-title rise delay-1">${escapedHtml(copy.hero.title)}</h1>
<p class="hero-lead rise delay-2">${escapedHtml(copy.hero.lead)}</p>
${freeLineHtml({ language })}
${downloadHtml({ stars, language })}</div>
<figure class="desk-stage arrive delay-3">
<figcaption class="visually-hidden">${escapedHtml(copy.stage.label)}</figcaption>
<div class="menu-strip" aria-hidden="true"><span class="menu-strip-item">${MENU_BAR_GLYPH}<span>${escapedHtml(copy.stage.menuCount)}</span></span></div>
<div class="shot shot-window arrive delay-4">${windowPicture({ language, theme })}</div>
<div class="shot shot-popover settle delay-5">${shotImage({ shot: LandingShot.Popover, alt: copy.alt.popover })}</div>
<div class="shot shot-widget settle delay-6"><div class="${cropClassOf(LandingShot.WidgetMedium)}">${shotImage({ shot: LandingShot.WidgetMedium, alt: copy.alt.widgetMedium })}</div></div>
</figure>
</section>`;
}

function benefitHtml({ well, title, body }: { well: string; title: string; body: string }): string {
  return `<li class="benefit-card glass reveal">
${well}
<h3 class="benefit-title">${escapedHtml(title)}</h3>
<p class="benefit-body">${escapedHtml(body)}</p>
</li>`;
}

function dayStopHtml({ time, mock, title, body }: { time: string; mock: string; title: string; body: string }): string {
  return `<li class="day-stop"><span class="day-dot" aria-hidden="true"></span><div class="day-vignette glass"><time class="day-time" datetime="${escapedHtml(time)}">${escapedHtml(time)}</time><div class="day-mock" aria-hidden="true">${mock}</div><p class="day-stop-title">${escapedHtml(title)}</p><p class="day-stop-body">${escapedHtml(body)}</p></div></li>`;
}

function dayEmailMockHtml({ language }: { language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  return `<span class="day-mail">${glyphHtml({ glyph: SiteGlyph.Icon, className: 'day-mail-icon' })}<span class="day-mail-subject">${escapedHtml(copy.benefits.day.email.subject)}</span></span>`;
}

function dayGlanceMockHtml({ language }: { language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { heading, count, rows } = copy.benefits.day.glance;
  const rowsHtml = rows.map((row) => `<span class="day-row">${escapedHtml(row)}</span>`).join('');
  return `<span class="day-mock-head"><span>${escapedHtml(heading)}</span><span>${escapedHtml(count)}</span></span>${rowsHtml}`;
}

function dayAgentMockHtml({ language }: { language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { ask, toolCall, toolResult } = copy.benefits.day.agent;
  return `<div class="terminal day-terminal"><pre class="terminal-body"><code><span class="terminal-line"><span class="terminal-prompt">${escapedHtml(copy.terminal.askPrompt)}</span> <span class="terminal-ask">${escapedHtml(ask)}</span></span><span class="terminal-line terminal-call">${escapedHtml(toolCall)}</span><span class="terminal-line terminal-result">${escapedHtml(toolResult)}</span></code></pre></div>`;
}

function dayCloseMockHtml({ language }: { language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { count, task, actions } = copy.benefits.day.close;
  const actionsHtml = actions.map((action) => `<span class="day-action">${escapedHtml(action)}</span>`).join('');
  return `<span class="day-mock-head"><span>${escapedHtml(count)}</span></span><span class="day-row">${escapedHtml(task)}</span><span class="day-actions">${actionsHtml}</span>`;
}

function dayExtrasHtml({ language }: { language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { label, ribbon, temperature, siri } = copy.benefits.day.extras;
  const extras = [
    { label: ribbon.label, detail: `<span class="menu-strip-item">${MENU_BAR_GLYPH}<span>${escapedHtml(ribbon.detail)}</span></span>` },
    { label: temperature.label, detail: `<span>${escapedHtml(temperature.detail)}</span>` },
    { label: siri.label, detail: `<span>${escapedHtml(siri.detail)}</span>` },
  ];
  const itemsHtml = extras
    .map((extra) => `<li class="day-extra"><span class="day-extra-label">${escapedHtml(extra.label)}</span> ${extra.detail}</li>`)
    .join('');
  return `<ul class="day-extras" aria-label="${escapedHtml(label)}">${itemsHtml}</ul>`;
}

function dayCardHtml({ language }: { language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { eyebrow, title, railLabel, email, glance, agent, close, note } = copy.benefits.day;
  const stops = [
    { ...email, mock: dayEmailMockHtml({ language }) },
    { ...glance, mock: dayGlanceMockHtml({ language }) },
    { ...agent, mock: dayAgentMockHtml({ language }) },
    { ...close, mock: dayCloseMockHtml({ language }) },
  ];
  return `<li id="${DAY_CARD_ID}" class="benefit-card benefit-card-day glass reveal">
<div class="day-head">
<div>
<p class="section-eyebrow">${escapedHtml(eyebrow)}</p>
<h3 class="section-title day-title">${escapedHtml(title)}</h3>
</div>
<p class="day-note">${escapedHtml(note)}</p>
</div>
<div class="benefit-well day-well">
<ol class="day-rail" aria-label="${escapedHtml(railLabel)}">${stops.map(dayStopHtml).join('')}</ol>
</div>
${dayExtrasHtml({ language })}
</li>`;
}

function benefitsHtml({ language }: { language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { agents, offline, lock } = copy.benefits;
  return `<section class="benefits page-width" aria-labelledby="benefits-title">
<h2 id="benefits-title" class="visually-hidden">${escapedHtml(copy.benefits.heading)}</h2>
<ul class="benefit-list">
${dayCardHtml({ language })}
${benefitHtml({ well: `<div class="benefit-well benefit-well-agents"><div class="benefit-shot-agents ${cropClassOf(LandingShot.AgentTasks)}">${shotImage({ shot: LandingShot.AgentTasks, alt: copy.alt.agentTasks })}</div></div>`, ...agents })}
${benefitHtml({ well: `<div class="benefit-well">${glyphHtml({ glyph: SiteGlyph.Offline, className: 'offline-glyph' })}</div>`, ...offline })}
${benefitHtml({ well: `<div class="benefit-well benefit-well-agents"><div class="benefit-shot-agents ${cropClassOf(LandingShot.WorkspaceLock)}">${shotImage({ shot: LandingShot.WorkspaceLock, alt: copy.alt.workspaceLock })}</div>${glyphHtml({ glyph: SiteGlyph.Lock, className: 'lock-glyph' })}</div>`, ...lock })}
</ul>
</section>`;
}

function unbrokenWordsHtml(text: string): string {
  return text
    .split(WORD_SEPARATOR)
    .map((word) => `<span class="terminal-word">${escapedHtml(word)}</span>`)
    .join(WORD_SEPARATOR);
}

function howItWorksHtml({ language }: { language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  const { howItWorks, terminal } = copy;
  const steps = [howItWorks.step1, howItWorks.step2, howItWorks.step3].map((step) => `<li>${escapedHtml(step)}</li>`).join('\n');
  return `<section class="how-it-works page-width" aria-labelledby="how-title">
<div class="how-copy">
<p class="section-eyebrow">${escapedHtml(howItWorks.eyebrow)}</p>
<h2 id="how-title" class="section-title">${escapedHtml(howItWorks.title)}</h2>
<ol class="step-list">
${steps}
</ol>
</div>
<figure class="terminal reveal">
<figcaption class="visually-hidden">${escapedHtml(terminal.label)}</figcaption>
<div class="terminal-bar" aria-hidden="true"><span class="terminal-dot"></span><span class="terminal-dot"></span><span class="terminal-dot"></span></div>
<pre class="terminal-body"><code><span class="terminal-line"><span class="terminal-prompt">${escapedHtml(terminal.shellPrompt)}</span> <span class="terminal-command">${unbrokenWordsHtml(terminal.command)}</span></span><span class="terminal-line"><span class="terminal-prompt">${escapedHtml(terminal.askPrompt)}</span> <span class="terminal-ask">${escapedHtml(terminal.ask)}</span></span><span class="terminal-line terminal-call">${escapedHtml(terminal.toolCall)}</span><span class="terminal-line terminal-result">${escapedHtml(terminal.toolResult)}</span></code></pre>
</figure>
</section>`;
}

function finalCallHtml({ stars, language }: { stars: number | null; language: Language }): string {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  return `<section id="${WAYS_ID}" class="final-call page-width reveal" aria-labelledby="final-title">
<h2 id="final-title" class="section-title">${escapedHtml(copy.final.title)}</h2>
${waysHtml({ stars, language })}${signatureHtml({ language })}</section>`;
}

function landingHtml({ stars, preferences }: { stars: number | null; preferences: PagePreferences }): string {
  const { language, theme } = preferences;
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  return siteDocumentHtml({
    hasControls: true,
    kind: SitePageKind.Public,
    path: LANDING_PATH,
    structuredData: LANDING_STRUCTURED_DATA_BY_LANGUAGE[language],
    preferences,
    stars,
    title: copy.meta.title,
    description: copy.meta.description,
    main: `<main id="${CONTENT_ID}">
${heroHtml({ stars, language, theme })}
${benefitsHtml({ language })}
${howItWorksHtml({ language })}
${finalCallHtml({ stars, language })}
</main>`,
    scripts: PAGE_SCRIPTS,
  });
}

export function serveLandingPage({ stars, preferences }: { stars: number | null; preferences: PagePreferences }): Response {
  const response = sitePageResponse({
    html: landingHtml({ stars, preferences }),
    contentSecurityPolicy: CONTENT_SECURITY_POLICY_BY_LANGUAGE[preferences.language],
  });
  response.headers.set(HttpHeader.Link, MARKDOWN_ALTERNATE_LINK);
  response.headers.set(HttpHeader.Vary, `${HttpHeader.Accept}, ${NEGOTIATION_VARY}`);
  return response;
}
