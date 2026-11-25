import { escapedHtml } from '../escaped-html';
import { TurnstileAction } from '../turnstile';
import { TURNSTILE_ORIGIN, TURNSTILE_RESPONSE_FIELD, TURNSTILE_SCRIPT_TAG, usableSiteKeyOf } from '../turnstile-page';
import { ARIA_DISABLED, EMAIL_FIELD_NAME, JOIN_BUTTON_CLASS, JOIN_FORM_CLASS } from './join-form-markup';
import { LANDING_COPY } from './landing-copy';
import { LANDING_SHOTS, LandingShot } from './landing-shots';
import { MENU_BAR_GLYPH, SiteGlyph, glyphHtml } from './site-glyphs';
import { siteContentSecurityPolicy, sitePageResponse } from './site-headers';
import { LANDING_STRUCTURED_DATA } from './site-json-ld';
import { CONTENT_ID, JOIN_PATH, LANDING_PATH, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE, cropClassOf } from './site-style';
import { WEBMCP_SCRIPT } from './webmcp-script';

export enum LandingNotice {
  None = 'none',
  OpensSoon = 'opens-soon',
  Joined = 'joined',
  TryAgain = 'try-again',
}

enum JoinForm {
  Hero = 'join',
  Final = 'final',
}

const JOIN_NOTICE_CLASS = 'join-notice';
const DARK_SCHEME_MEDIA = '(prefers-color-scheme: dark)';
const SRCSET_LIST_SEPARATOR = ', ';
const CLASS_SEPARATOR = ' ';
const WORD_SEPARATOR = ' ';
const WIDGET_APPEARANCE = 'interaction-only';
const WIDGET_THEME = 'auto';
const WIDGET_CLASS = 'cf-turnstile';
const TOKEN_CALLBACK = 'waitlistTokenReady';
const FAILURE_CALLBACK = 'waitlistChallengeFailed';

type LandingPage = { available: (siteKey: string) => string; unavailable: string };

type LandingChallenge = { widget: string; scriptTag: string };

const NO_CHALLENGE: LandingChallenge = { widget: '', scriptTag: '' };

const NOTICE_TEXT: Record<Exclude<LandingNotice, LandingNotice.None>, string> = {
  [LandingNotice.OpensSoon]: LANDING_COPY.join.opensSoon,
  [LandingNotice.Joined]: LANDING_COPY.join.joined,
  [LandingNotice.TryAgain]: LANDING_COPY.join.tryAgain,
};

const PAGE_SCRIPT = `{
  const waitingForToken = new Map();
  const hasToken = (form) => {
    const token = form.querySelector('[name="${TURNSTILE_RESPONSE_FIELD}"]');
    return token !== null && token.value !== '';
  };
  let hasFailedWidget = false;
  window.${TOKEN_CALLBACK} = () => {
    hasFailedWidget = false;
    waitingForToken.forEach((_restore, form) => {
      if (!hasToken(form)) return;
      waitingForToken.delete(form);
      form.submit();
    });
  };
  window.${FAILURE_CALLBACK} = () => {
    hasFailedWidget = true;
    waitingForToken.forEach((restore, form) => {
      waitingForToken.delete(form);
      restore();
    });
  };
  const retryChallenge = ({ form, restore }) => {
    hasFailedWidget = false;
    restore();
    if (window.turnstile) window.turnstile.reset(form.querySelector('.${WIDGET_CLASS}'));
  };
  document.querySelectorAll('.${JOIN_FORM_CLASS}').forEach((form) => {
    const button = form.querySelector('.${JOIN_BUTTON_CLASS}');
    const label = button.textContent;
    const hasWidget = form.querySelector('.${WIDGET_CLASS}') !== null;
    const restore = () => {
      button.removeAttribute('${ARIA_DISABLED}');
      button.textContent = label;
    };
    form.addEventListener('submit', (event) => {
      if (button.getAttribute('${ARIA_DISABLED}') === 'true') return event.preventDefault();
      button.setAttribute('${ARIA_DISABLED}', 'true');
      button.textContent = button.dataset.submitting;
      if (!hasWidget || hasToken(form)) return;
      event.preventDefault();
      if (hasFailedWidget) return retryChallenge({ form, restore });
      waitingForToken.set(form, restore);
    });
    addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      waitingForToken.delete(form);
      restore();
    });
  });
  addEventListener('load', () => requestAnimationFrame(() => {
    const answered = document.getElementById(location.hash.slice(1));
    const notice = answered === null ? null : answered.querySelector('.${JOIN_NOTICE_CLASS}');
    if (notice !== null) notice.focus({ preventScroll: true });
  }));
}`;

const PAGE_SCRIPTS = [PAGE_SCRIPT, WEBMCP_SCRIPT];

const CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [LANDING_STRUCTURED_DATA, ...PAGE_SCRIPTS],
  widgetOrigin: null,
  connectsToSelf: true,
});
const CHALLENGE_CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [LANDING_STRUCTURED_DATA, ...PAGE_SCRIPTS],
  widgetOrigin: TURNSTILE_ORIGIN,
  connectsToSelf: true,
});

function webpSourceAttributes(shot: LandingShot): string {
  const { webp } = LANDING_SHOTS[shot];
  const srcset = webp.map(({ path, width }) => `${path}${WORD_SEPARATOR}${width}w`).join(SRCSET_LIST_SEPARATOR);
  return `srcset="${srcset}" sizes="${Math.min(...webp.map(({ width }) => width))}px"`;
}

function shotImage({ shot, alt, isEager }: { shot: LandingShot; alt: string; isEager: boolean }): string {
  const { path, width, height } = LANDING_SHOTS[shot];
  const loading = isEager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<img src="${path}" ${webpSourceAttributes(shot)} width="${width}" height="${height}" alt="${escapedHtml(alt)}" ${loading}>`;
}

function windowPicture(): string {
  const { width, height } = LANDING_SHOTS[LandingShot.WindowDark];
  return `<picture><source media="${DARK_SCHEME_MEDIA}" ${webpSourceAttributes(LandingShot.WindowDark)} width="${width}" height="${height}">${shotImage({ shot: LandingShot.Window, alt: LANDING_COPY.alt.window, isEager: true })}</picture>`;
}

function joinStatusHtml({ form, notice }: { form: JoinForm; notice: LandingNotice }): string {
  if (notice === LandingNotice.None) return `<p class="join-note">${escapedHtml(LANDING_COPY.join.note)}</p>`;
  return `<p id="${form}-notice" class="${JOIN_NOTICE_CLASS}" role="status" tabindex="-1"><span class="notice-dot" aria-hidden="true"></span>${escapedHtml(NOTICE_TEXT[notice])}</p>`;
}

// NB ADR 0046: the site key sits in a data attribute, so the page script stays one fixed source with one hash.
function challengeOf(siteKey: string): LandingChallenge {
  return {
    widget: `<div class="${WIDGET_CLASS}" data-sitekey="${siteKey}" data-action="${TurnstileAction.Waitlist}" data-appearance="${WIDGET_APPEARANCE}" data-theme="${WIDGET_THEME}" data-callback="${TOKEN_CALLBACK}" data-error-callback="${FAILURE_CALLBACK}" data-expired-callback="${FAILURE_CALLBACK}" data-timeout-callback="${FAILURE_CALLBACK}"></div>\n`,
    scriptTag: `${TURNSTILE_SCRIPT_TAG}\n`,
  };
}

function joinFormHtml({
  form,
  notice,
  widget,
  classNames,
}: {
  form: JoinForm;
  notice: LandingNotice;
  widget: string;
  classNames: string[];
}): string {
  const inputId = `${form}-email`;
  return `<form id="${form}" class="${[JOIN_FORM_CLASS, ...classNames].join(CLASS_SEPARATOR)}" method="post" action="${JOIN_PATH}#${form}">
<div class="join-capsule">
<label class="visually-hidden" for="${inputId}">${escapedHtml(LANDING_COPY.join.emailLabel)}</label>
<input id="${inputId}" class="join-input" name="${EMAIL_FIELD_NAME}" type="email" autocomplete="email" inputmode="email" placeholder="${escapedHtml(LANDING_COPY.join.emailPlaceholder)}" required>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(LANDING_COPY.join.submitting)}">${escapedHtml(LANDING_COPY.join.submit)}</button>
</div>
${widget}${joinStatusHtml({ form, notice })}
</form>`;
}

function heroHtml({ notice, widget }: { notice: LandingNotice; widget: string }): string {
  return `<section class="hero page-width" aria-labelledby="hero-title">
<div class="hero-copy">
<p class="eyebrow-pill glass rise"><span class="eyebrow-dot" aria-hidden="true"></span>${escapedHtml(LANDING_COPY.hero.eyebrow)}</p>
<h1 id="hero-title" class="hero-title rise delay-1">${escapedHtml(LANDING_COPY.hero.title)}</h1>
<p class="hero-lead rise delay-2">${escapedHtml(LANDING_COPY.hero.lead)}</p>
${joinFormHtml({ form: JoinForm.Hero, notice, widget, classNames: ['rise', 'delay-3'] })}
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

function finalCallHtml({ notice, widget }: { notice: LandingNotice; widget: string }): string {
  return `<section class="final-call page-width reveal" aria-labelledby="final-title">
${glyphHtml({ glyph: SiteGlyph.Icon, className: 'final-icon' })}
<h2 id="final-title" class="section-title">${escapedHtml(LANDING_COPY.final.title)}</h2>
<p class="final-body">${escapedHtml(LANDING_COPY.final.body)}</p>
${joinFormHtml({ form: JoinForm.Final, notice, widget, classNames: [] })}
</section>`;
}

function landingHtml({ notice, challenge }: { notice: LandingNotice; challenge: LandingChallenge }): string {
  const { widget, scriptTag } = challenge;
  return siteDocumentHtml({
    kind: SitePageKind.Public,
    path: LANDING_PATH,
    structuredData: LANDING_STRUCTURED_DATA,
    title: LANDING_COPY.meta.title,
    description: LANDING_COPY.meta.description,
    main: `<main id="${CONTENT_ID}">
${heroHtml({ notice, widget })}
${benefitsHtml()}
${howItWorksHtml()}
${finalCallHtml({ notice, widget })}
${scriptTag}</main>`,
    scripts: PAGE_SCRIPTS,
  });
}

function landingPageOf(notice: LandingNotice): LandingPage {
  return {
    available: (siteKey) => landingHtml({ notice, challenge: challengeOf(siteKey) }),
    unavailable: landingHtml({ notice, challenge: NO_CHALLENGE }),
  };
}

const LANDING_PAGES: Record<LandingNotice, LandingPage> = {
  [LandingNotice.None]: landingPageOf(LandingNotice.None),
  [LandingNotice.OpensSoon]: landingPageOf(LandingNotice.OpensSoon),
  [LandingNotice.Joined]: landingPageOf(LandingNotice.Joined),
  [LandingNotice.TryAgain]: landingPageOf(LandingNotice.TryAgain),
};

export async function serveLandingPage({ notice, siteKey }: { notice: LandingNotice; siteKey: string | null }): Promise<Response> {
  const page = LANDING_PAGES[notice];
  const usableSiteKey = usableSiteKeyOf(siteKey);
  if (usableSiteKey === null) return sitePageResponse({ html: page.unavailable, contentSecurityPolicy: CONTENT_SECURITY_POLICY });
  return sitePageResponse({ html: page.available(usableSiteKey), contentSecurityPolicy: CHALLENGE_CONTENT_SECURITY_POLICY });
}
