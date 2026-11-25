import { escapedHtml } from '../escaped-html';
import { LANDING_COPY } from './landing-copy';
import { LANDING_SHOTS, LandingShot } from './landing-shots';
import { MENU_BAR_GLYPH, SiteGlyph, glyphHtml } from './site-glyphs';
import { siteContentSecurityPolicy, sitePageResponse } from './site-headers';
import { CONTENT_ID, siteDocumentHtml } from './site-shell';
import { SITE_STYLE, cropClassOf } from './site-style';

export enum LandingNotice {
  None = 'none',
  OpensSoon = 'opens-soon',
}

enum JoinForm {
  Hero = 'join',
  Final = 'final',
}

const JOIN_PATH = '/join';
const JOIN_FORM_CLASS = 'join-form';
const JOIN_BUTTON_CLASS = 'join-button';
const JOIN_NOTICE_CLASS = 'join-notice';
const ARIA_DISABLED = 'aria-disabled';
const DARK_SCHEME_MEDIA = '(prefers-color-scheme: dark)';
const CLASS_SEPARATOR = ' ';
const WORD_SEPARATOR = ' ';

const PAGE_SCRIPT = `{
  document.querySelectorAll('.${JOIN_FORM_CLASS}').forEach((form) => {
    const button = form.querySelector('.${JOIN_BUTTON_CLASS}');
    const label = button.textContent;
    form.addEventListener('submit', (event) => {
      if (button.getAttribute('${ARIA_DISABLED}') === 'true') return event.preventDefault();
      button.setAttribute('${ARIA_DISABLED}', 'true');
      button.textContent = button.dataset.submitting;
    });
    addEventListener('pageshow', () => {
      button.removeAttribute('${ARIA_DISABLED}');
      button.textContent = label;
    });
  });
  addEventListener('load', () => requestAnimationFrame(() => {
    const answered = document.getElementById(location.hash.slice(1));
    const notice = answered === null ? null : answered.querySelector('.${JOIN_NOTICE_CLASS}');
    if (notice !== null) notice.focus({ preventScroll: true });
  }));
}`;

const CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({ style: SITE_STYLE, script: PAGE_SCRIPT });

function shotImage({ shot, alt, isEager }: { shot: LandingShot; alt: string; isEager: boolean }): string {
  const { path, width, height } = LANDING_SHOTS[shot];
  const loading = isEager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<img src="${path}" width="${width}" height="${height}" alt="${escapedHtml(alt)}" ${loading}>`;
}

function windowPicture(): string {
  const { path, width, height } = LANDING_SHOTS[LandingShot.WindowDark];
  return `<picture><source media="${DARK_SCHEME_MEDIA}" srcset="${path}" width="${width}" height="${height}">${shotImage({ shot: LandingShot.Window, alt: LANDING_COPY.alt.window, isEager: true })}</picture>`;
}

function joinStatusHtml({ form, notice }: { form: JoinForm; notice: LandingNotice }): string {
  if (notice === LandingNotice.None) return `<p class="join-note">${escapedHtml(LANDING_COPY.join.note)}</p>`;
  return `<p id="${form}-notice" class="${JOIN_NOTICE_CLASS}" role="status" tabindex="-1"><span class="notice-dot" aria-hidden="true"></span>${escapedHtml(LANDING_COPY.join.opensSoon)}</p>`;
}

function joinFormHtml({ form, notice, classNames }: { form: JoinForm; notice: LandingNotice; classNames: string[] }): string {
  const inputId = `${form}-email`;
  return `<form id="${form}" class="${[JOIN_FORM_CLASS, ...classNames].join(CLASS_SEPARATOR)}" method="post" action="${JOIN_PATH}#${form}">
<div class="join-capsule">
<label class="visually-hidden" for="${inputId}">${escapedHtml(LANDING_COPY.join.emailLabel)}</label>
<input id="${inputId}" class="join-input" name="email" type="email" autocomplete="email" inputmode="email" placeholder="${escapedHtml(LANDING_COPY.join.emailPlaceholder)}" required>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(LANDING_COPY.join.submitting)}">${escapedHtml(LANDING_COPY.join.submit)}</button>
</div>
${joinStatusHtml({ form, notice })}
</form>`;
}

function heroHtml(notice: LandingNotice): string {
  return `<section class="hero page-width" aria-labelledby="hero-title">
<div class="hero-copy">
<p class="eyebrow-pill glass rise"><span class="eyebrow-dot" aria-hidden="true"></span>${escapedHtml(LANDING_COPY.hero.eyebrow)}</p>
<h1 id="hero-title" class="hero-title rise delay-1">${escapedHtml(LANDING_COPY.hero.title)}</h1>
<p class="hero-lead rise delay-2">${escapedHtml(LANDING_COPY.hero.lead)}</p>
${joinFormHtml({ form: JoinForm.Hero, notice, classNames: ['rise', 'delay-3'] })}
</div>
<figure class="desk-stage arrive delay-3">
<figcaption class="visually-hidden">${escapedHtml(LANDING_COPY.stage.label)}</figcaption>
<div class="menu-strip" aria-hidden="true"><span class="menu-strip-item">${MENU_BAR_GLYPH}<span>${escapedHtml(LANDING_COPY.stage.menuCount)}</span></span></div>
<div class="shot shot-window arrive delay-4">${windowPicture()}</div>
<div class="shot shot-popover settle delay-5">${shotImage({ shot: LandingShot.Popover, alt: LANDING_COPY.alt.popover, isEager: false })}</div>
<div class="shot shot-widget settle delay-6"><div class="${cropClassOf(LandingShot.WidgetMedium)}">${shotImage({ shot: LandingShot.WidgetMedium, alt: LANDING_COPY.alt.widgetMedium, isEager: false })}</div></div>
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
${benefitHtml({ well: `<div class="benefit-well benefit-well-agents"><div class="benefit-shot-agents ${cropClassOf(LandingShot.AgentTasks)}">${shotImage({ shot: LandingShot.AgentTasks, alt: LANDING_COPY.alt.agentTasks, isEager: false })}</div></div>`, ...agents })}
${benefitHtml({ well: `<div class="benefit-well"><div class="benefit-shot-ring ${cropClassOf(LandingShot.WidgetRing)}">${shotImage({ shot: LandingShot.WidgetRing, alt: LANDING_COPY.alt.widgetRing, isEager: false })}</div></div>`, ...glance })}
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

function finalCallHtml(notice: LandingNotice): string {
  return `<section class="final-call page-width reveal" aria-labelledby="final-title">
${glyphHtml({ glyph: SiteGlyph.Icon, className: 'final-icon' })}
<h2 id="final-title" class="section-title">${escapedHtml(LANDING_COPY.final.title)}</h2>
<p class="final-body">${escapedHtml(LANDING_COPY.final.body)}</p>
${joinFormHtml({ form: JoinForm.Final, notice, classNames: [] })}
</section>`;
}

function landingHtml(notice: LandingNotice): string {
  return siteDocumentHtml({
    title: LANDING_COPY.meta.title,
    description: LANDING_COPY.meta.description,
    main: `<main id="${CONTENT_ID}">
${heroHtml(notice)}
${benefitsHtml()}
${howItWorksHtml()}
${finalCallHtml(notice)}
</main>`,
    script: PAGE_SCRIPT,
  });
}

const LANDING_HTML: Record<LandingNotice, string> = {
  [LandingNotice.None]: landingHtml(LandingNotice.None),
  [LandingNotice.OpensSoon]: landingHtml(LandingNotice.OpensSoon),
};

export async function serveLandingPage({ notice }: { notice: LandingNotice }): Promise<Response> {
  return sitePageResponse({ html: LANDING_HTML[notice], contentSecurityPolicy: CONTENT_SECURITY_POLICY });
}
