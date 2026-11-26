import { escapedHtml } from '../escaped-html';
import { LANDING_COPY } from './landing-copy';
import { LANDING_SHOTS, LandingShot } from './landing-shots';
import { MENU_BAR_GLYPH, SiteGlyph, glyphHtml } from './site-glyphs';
import { siteContentSecurityPolicy, sitePageResponse } from './site-headers';
import { LANDING_STRUCTURED_DATA } from './site-json-ld';
import { CONTENT_ID, LANDING_PATH, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE, cropClassOf } from './site-style';
import { DOCS_INSTALL_URL, DOWNLOAD_PATH } from './site-urls';
import { WEBMCP_SCRIPT } from './webmcp-script';

const DARK_SCHEME_MEDIA = '(prefers-color-scheme: dark)';
const SRCSET_LIST_SEPARATOR = ', ';
const WORD_SEPARATOR = ' ';

const PAGE_SCRIPTS = [WEBMCP_SCRIPT];

const CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [LANDING_STRUCTURED_DATA, ...PAGE_SCRIPTS],
  widgetOrigin: null,
  connectsToSelf: true,
  declaresManifest: true,
});

function webpSourceAttributes(shot: LandingShot): string {
  const { webp } = LANDING_SHOTS[shot];
  const srcset = webp.map(({ path, width }) => `${path}${WORD_SEPARATOR}${width}w`).join(SRCSET_LIST_SEPARATOR);
  return `srcset="${srcset}" sizes="${Math.min(...webp.map(({ width }) => width))}px"`;
}

function shotImage({ shot, alt }: { shot: LandingShot; alt: string }): string {
  const { path, width, height } = LANDING_SHOTS[shot];
  return `<img src="${path}" ${webpSourceAttributes(shot)} width="${width}" height="${height}" alt="${escapedHtml(alt)}" loading="lazy" decoding="async">`;
}

function windowPicture(): string {
  const { width, height } = LANDING_SHOTS[LandingShot.WindowDark];
  return `<picture><source media="${DARK_SCHEME_MEDIA}" ${webpSourceAttributes(LandingShot.WindowDark)} width="${width}" height="${height}">${shotImage({ shot: LandingShot.Window, alt: LANDING_COPY.alt.window })}</picture>`;
}

function downloadHtml(): string {
  const { button, note, noteLink } = LANDING_COPY.download;
  return `<div class="download rise delay-3">
<a class="download-button" href="${DOWNLOAD_PATH}" download>${escapedHtml(button)}</a>
<p class="download-note">${escapedHtml(note)} <a class="download-note-link" href="${DOCS_INSTALL_URL}">${escapedHtml(noteLink)}</a></p>
</div>
`;
}

function heroHtml(): string {
  return `<section class="hero page-width" aria-labelledby="hero-title">
<div class="hero-copy">
<p class="eyebrow-pill glass rise"><span class="eyebrow-dot" aria-hidden="true"></span>${escapedHtml(LANDING_COPY.hero.eyebrow)}</p>
<h1 id="hero-title" class="hero-title rise delay-1">${escapedHtml(LANDING_COPY.hero.title)}</h1>
<p class="hero-lead rise delay-2">${escapedHtml(LANDING_COPY.hero.lead)}</p>
${downloadHtml()}</div>
<figure class="desk-stage arrive delay-3">
<figcaption class="visually-hidden">${escapedHtml(LANDING_COPY.stage.label)}</figcaption>
<div class="menu-strip" aria-hidden="true"><span class="menu-strip-item">${MENU_BAR_GLYPH}<span>${escapedHtml(LANDING_COPY.stage.menuCount)}</span></span></div>
<div class="shot shot-window arrive delay-4">${windowPicture()}</div>
<div class="shot shot-popover settle delay-5">${shotImage({ shot: LandingShot.Popover, alt: LANDING_COPY.alt.popover })}</div>
<div class="shot shot-widget settle delay-6"><div class="${cropClassOf(LandingShot.WidgetMedium)}">${shotImage({ shot: LandingShot.WidgetMedium, alt: LANDING_COPY.alt.widgetMedium })}</div></div>
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

function benefitsHtml(): string {
  const { agents, glance, offline } = LANDING_COPY.benefits;
  return `<section class="benefits page-width" aria-labelledby="benefits-title">
<h2 id="benefits-title" class="visually-hidden">${escapedHtml(LANDING_COPY.benefits.heading)}</h2>
<ul class="benefit-list">
${benefitHtml({ well: `<div class="benefit-well benefit-well-agents"><div class="benefit-shot-agents ${cropClassOf(LandingShot.AgentTasks)}">${shotImage({ shot: LandingShot.AgentTasks, alt: LANDING_COPY.alt.agentTasks })}</div></div>`, ...agents })}
${benefitHtml({ well: `<div class="benefit-well"><div class="benefit-shot-ring ${cropClassOf(LandingShot.WidgetRing)}">${shotImage({ shot: LandingShot.WidgetRing, alt: LANDING_COPY.alt.widgetRing })}</div></div>`, ...glance })}
${benefitHtml({ well: `<div class="benefit-well">${glyphHtml({ glyph: SiteGlyph.Offline, className: 'offline-glyph' })}</div>`, ...offline })}
</ul>
</section>`;
}

function unbrokenWordsHtml(text: string): string {
  return text
    .split(WORD_SEPARATOR)
    .map((word) => `<span class="terminal-word">${escapedHtml(word)}</span>`)
    .join(WORD_SEPARATOR);
}

function howItWorksHtml(): string {
  const { howItWorks, terminal } = LANDING_COPY;
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

function finalCallHtml(): string {
  return `<section class="final-call page-width reveal" aria-labelledby="final-title">
${glyphHtml({ glyph: SiteGlyph.Icon, className: 'final-icon' })}
<h2 id="final-title" class="section-title">${escapedHtml(LANDING_COPY.final.title)}</h2>
<p class="final-body">${escapedHtml(LANDING_COPY.final.body)}</p>
<a class="download-button final-download" href="${DOWNLOAD_PATH}" download>${escapedHtml(LANDING_COPY.download.button)}</a>
</section>`;
}

const LANDING_HTML = siteDocumentHtml({
  kind: SitePageKind.Public,
  path: LANDING_PATH,
  structuredData: LANDING_STRUCTURED_DATA,
  title: LANDING_COPY.meta.title,
  description: LANDING_COPY.meta.description,
  main: `<main id="${CONTENT_ID}">
${heroHtml()}
${benefitsHtml()}
${howItWorksHtml()}
${finalCallHtml()}
</main>`,
  scripts: PAGE_SCRIPTS,
});

export function serveLandingPage(_options: { stars: number | null }): Response {
  return sitePageResponse({ html: LANDING_HTML, contentSecurityPolicy: CONTENT_SECURITY_POLICY });
}
