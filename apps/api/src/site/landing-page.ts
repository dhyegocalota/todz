import { MILLISECONDS_PER_SECOND, WAITLIST_FILL_HOLD_MS, WAITLIST_JOIN_TIMEOUT_MS } from '@todz/types';
import type { Env } from '../env';
import { escapedHtml } from '../escaped-html';
import { MediaType } from '../request-body';
import { TurnstileAction } from '../turnstile';
import { TURNSTILE_ORIGIN, TURNSTILE_RESPONSE_FIELD, TURNSTILE_SCRIPT_TAG, siteKeyOf, usableSiteKeyOf } from '../turnstile-page';
import {
  ARIA_DISABLED,
  EMAIL_FIELD_NAME,
  HONEYPOT_FIELD_NAME,
  JOIN_BUTTON_CLASS,
  JOIN_FORM_CLASS,
  JOIN_OUTCOME_ATTRIBUTE,
  JOIN_STATE_ATTRIBUTE,
  JoinFormState,
  JoinOutcome,
  STAMP_FIELD_NAME,
  UNREACHABLE_ANSWER,
  WAITING_ANSWER,
  WAITLIST_ANSWERED_EVENT,
} from './join-form-markup';
import { LANDING_COPY } from './landing-copy';
import { LANDING_SHOTS, LandingShot } from './landing-shots';
import { scriptJson } from './site-constants';
import { MENU_BAR_GLYPH, SiteGlyph, glyphHtml } from './site-glyphs';
import { siteContentSecurityPolicy, sitePageResponse } from './site-headers';
import { LANDING_STRUCTURED_DATA } from './site-json-ld';
import { CONTENT_ID, JOIN_PATH, LANDING_PATH, SitePageKind, siteDocumentHtml } from './site-shell';
import { SITE_STYLE, cropClassOf } from './site-style';
import { WEBMCP_SCRIPT } from './webmcp-script';
import { renderStampOf } from './waitlist-stamp';

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
const WIDGET_APPEARANCE = 'always';
const WIDGET_SIZE = 'flexible';
const JOIN_CHECK_CLASS = 'join-check';
const JOIN_EXTRA_CLASS = 'join-extra';
const WIDGET_THEME = 'auto';
const WIDGET_CLASS = 'cf-turnstile';
const TOKEN_CALLBACK = 'waitlistTokenReady';
const FAILURE_CALLBACK = 'waitlistChallengeFailed';
const EXPIRED_CALLBACK = 'waitlistTokenExpired';

type LandingPage = { available: ({ siteKey, stamp }: { siteKey: string; stamp: string }) => string; unavailable: string };

export type LandingChallengeKeys = { siteKey: string; stampSecret: string };

type LandingChallenge = { widget: string; scriptTag: string; fieldsOf: (form: JoinForm) => string };

const NO_CHALLENGE: LandingChallenge = { widget: '', scriptTag: '', fieldsOf: () => '' };

const NOTICE_TEXT: Record<Exclude<LandingNotice, LandingNotice.None>, string> = {
  [LandingNotice.OpensSoon]: LANDING_COPY.join.opensSoon,
  [LandingNotice.Joined]: LANDING_COPY.join.joined,
  [LandingNotice.TryAgain]: LANDING_COPY.join.tryAgain,
};

const PAGE_SCRIPT_COPY = {
  lines: {
    [JoinOutcome.Joined]: LANDING_COPY.join.joined,
    [JoinOutcome.Invalid]: LANDING_COPY.join.invalid,
    [JoinOutcome.CheckFailed]: LANDING_COPY.join.checkFailed,
    [JoinOutcome.TryAgain]: LANDING_COPY.join.tryAgain,
    [JoinOutcome.OpensSoon]: LANDING_COPY.join.opensSoon,
  } satisfies Record<JoinOutcome, string>,
  waitingForCheck: LANDING_COPY.join.waitingForCheck,
  unreachable: LANDING_COPY.join.unreachable,
  checkError: LANDING_COPY.join.checkError,
};

// NB ADR 0067: a join never navigates; it holds until the fill time, posts JSON, shows the outcome in the status line and resets the widget.
export const PAGE_SCRIPT = `{
  const copy = ${scriptJson(PAGE_SCRIPT_COPY)};
  const state = ${scriptJson(JoinFormState)};
  const forms = [...document.querySelectorAll('.${JOIN_FORM_CLASS}')];
  const tokenOf = (form) => {
    const token = form.querySelector('[name="${TURNSTILE_RESPONSE_FIELD}"]');
    return token === null ? '' : token.value;
  };
  const widgetOf = (form) => form.querySelector('.${WIDGET_CLASS}');
  const buttonOf = (form) => form.querySelector('.${JOIN_BUTTON_CLASS}');
  const labelOf = new Map(forms.map((form) => [form, buttonOf(form).textContent]));
  const progressOf = new Map(forms.map((form) => [form, {
    hasWidget: widgetOf(form) !== null,
    hasToken: widgetOf(form) === null || tokenOf(form) !== '',
    isBlocked: false,
    isSending: false,
    hasSolved: widgetOf(form) !== null && tokenOf(form) !== '',
  }]));
  const stateOf = ({ hasToken, isBlocked, isSending }) => {
    if (isSending) return state.Sending;
    if (hasToken && !isBlocked) return state.Ready;
    return state.Waiting;
  };
  const render = (form) => {
    const progress = progressOf.get(form);
    const current = stateOf(progress);
    form.dataset.${JOIN_STATE_ATTRIBUTE} = current;
    buttonOf(form).textContent = progress.isSending ? buttonOf(form).dataset.submitting : labelOf.get(form);
    if (current === state.Ready) return buttonOf(form).removeAttribute('${ARIA_DISABLED}');
    buttonOf(form).setAttribute('${ARIA_DISABLED}', 'true');
  };
  const showLine = ({ form, text }) => {
    const status = form.querySelector('[role="status"]');
    const dot = document.createElement('span');
    dot.className = 'notice-dot';
    dot.setAttribute('aria-hidden', 'true');
    status.className = '${JOIN_NOTICE_CLASS}';
    status.replaceChildren(dot, text);
  };
  const answerOf = async (body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ${WAITLIST_JOIN_TIMEOUT_MS});
    try {
      const response = await fetch('${JOIN_PATH}', { method: 'POST', headers: { Accept: '${MediaType.Json}' }, body, signal: controller.signal });
      const { outcome } = await response.json();
      if (!Object.hasOwn(copy.lines, outcome)) return { outcome: '${UNREACHABLE_ANSWER}', retryAfterSeconds: 0 };
      return { outcome, retryAfterSeconds: Number(response.headers.get('Retry-After')) };
    } catch (error) {
      return { outcome: '${UNREACHABLE_ANSWER}', retryAfterSeconds: 0 };
    } finally {
      clearTimeout(timer);
    }
  };
  const finish = ({ form, outcome, retryAfterSeconds }) => {
    const progress = progressOf.get(form);
    progress.isSending = false;
    progress.hasToken = !progress.hasWidget;
    form.dataset.${JOIN_OUTCOME_ATTRIBUTE} = outcome;
    showLine({ form, text: outcome === '${UNREACHABLE_ANSWER}' ? copy.unreachable : copy.lines[outcome] });
    if (outcome === '${JoinOutcome.Joined}') form.querySelector('[name="${EMAIL_FIELD_NAME}"]').value = '';
    if (retryAfterSeconds > 0) {
      progress.isBlocked = true;
      setTimeout(() => {
        progress.isBlocked = false;
        render(form);
      }, retryAfterSeconds * ${MILLISECONDS_PER_SECOND});
    }
    if (progress.hasWidget && window.turnstile) window.turnstile.reset(widgetOf(form));
    render(form);
    form.dispatchEvent(new CustomEvent('${WAITLIST_ANSWERED_EVENT}', { detail: { outcome } }));
  };
  const sendFrom = async (form) => {
    progressOf.get(form).isSending = true;
    render(form);
    const remainingHoldMs = ${WAITLIST_FILL_HOLD_MS} - performance.now();
    if (remainingHoldMs > 0) await new Promise((resolve) => setTimeout(resolve, remainingHoldMs));
    finish({ form, ...(await answerOf(new URLSearchParams(new FormData(form)))) });
  };
  const syncTokens = () => forms.forEach((form) => {
    const progress = progressOf.get(form);
    progress.hasToken = !progress.hasWidget || tokenOf(form) !== '';
    progress.hasSolved = progress.hasSolved || (progress.hasWidget && progress.hasToken);
    render(form);
  });
  window.${TOKEN_CALLBACK} = syncTokens;
  window.${EXPIRED_CALLBACK} = syncTokens;
  window.${FAILURE_CALLBACK} = () => {
    syncTokens();
    forms.forEach((form) => {
      const progress = progressOf.get(form);
      if (progress.hasWidget && !progress.hasSolved) showLine({ form, text: copy.checkError });
    });
  };
  forms.forEach((form) => {
    render(form);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const progress = progressOf.get(form);
      if (form.dataset.${JOIN_STATE_ATTRIBUTE} === state.Ready) return sendFrom(form);
      if (progress.isSending || progress.isBlocked) return;
      showLine({ form, text: copy.waitingForCheck });
      form.dispatchEvent(new CustomEvent('${WAITLIST_ANSWERED_EVENT}', { detail: { outcome: '${WAITING_ANSWER}' } }));
    });
  });
  addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    forms.forEach((form) => {
      progressOf.get(form).isSending = false;
      render(form);
    });
  });
  addEventListener('load', () => {
    if (window.turnstile === undefined) forms.filter((form) => progressOf.get(form).hasWidget).forEach((form) => showLine({ form, text: copy.checkError }));
    requestAnimationFrame(() => {
      const answered = document.getElementById(location.hash.slice(1));
      const notice = answered === null ? null : answered.querySelector('.${JOIN_NOTICE_CLASS}');
      if (notice !== null) notice.focus({ preventScroll: true });
    });
  });
}`;

const PAGE_SCRIPTS = [PAGE_SCRIPT, WEBMCP_SCRIPT];

const CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [LANDING_STRUCTURED_DATA, ...PAGE_SCRIPTS],
  widgetOrigin: null,
  connectsToSelf: true,
  declaresManifest: true,
});
const CHALLENGE_CONTENT_SECURITY_POLICY = await siteContentSecurityPolicy({
  style: SITE_STYLE,
  scripts: [LANDING_STRUCTURED_DATA, ...PAGE_SCRIPTS],
  widgetOrigin: TURNSTILE_ORIGIN,
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

function joinStatusHtml({ form, notice }: { form: JoinForm; notice: LandingNotice }): string {
  if (notice === LandingNotice.None)
    return `<p id="${form}-notice" class="join-note" role="status">${escapedHtml(LANDING_COPY.join.note)}</p>`;
  return `<p id="${form}-notice" class="${JOIN_NOTICE_CLASS}" role="status" tabindex="-1"><span class="notice-dot" aria-hidden="true"></span>${escapedHtml(NOTICE_TEXT[notice])}</p>`;
}

function honeypotAndStampHtml({ form, stamp }: { form: JoinForm; stamp: string }): string {
  const honeypotId = `${form}-${HONEYPOT_FIELD_NAME}`;
  return `<div class="${JOIN_EXTRA_CLASS}" aria-hidden="true">
<label for="${honeypotId}">${escapedHtml(LANDING_COPY.join.honeypotLabel)}</label>
<input id="${honeypotId}" name="${HONEYPOT_FIELD_NAME}" type="text" tabindex="-1" autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other">
</div>
<input type="hidden" name="${STAMP_FIELD_NAME}" value="${stamp}">
`;
}

// NB ADR 0046: the site key sits in a data attribute, so the page script stays one fixed source with one hash.
function challengeOf({ siteKey, stamp }: { siteKey: string; stamp: string }): LandingChallenge {
  return {
    widget: `<div class="${JOIN_CHECK_CLASS}"><div class="${WIDGET_CLASS}" data-sitekey="${siteKey}" data-action="${TurnstileAction.Waitlist}" data-appearance="${WIDGET_APPEARANCE}" data-size="${WIDGET_SIZE}" data-theme="${WIDGET_THEME}" data-callback="${TOKEN_CALLBACK}" data-error-callback="${FAILURE_CALLBACK}" data-expired-callback="${EXPIRED_CALLBACK}" data-timeout-callback="${FAILURE_CALLBACK}"></div></div>\n`,
    scriptTag: `${TURNSTILE_SCRIPT_TAG}\n`,
    fieldsOf: (form) => honeypotAndStampHtml({ form, stamp }),
  };
}

function joinFormHtml({
  form,
  notice,
  challenge,
  classNames,
}: {
  form: JoinForm;
  notice: LandingNotice;
  challenge: LandingChallenge;
  classNames: string[];
}): string {
  const inputId = `${form}-email`;
  return `<form id="${form}" class="${[JOIN_FORM_CLASS, ...classNames].join(CLASS_SEPARATOR)}" method="post" action="${JOIN_PATH}#${form}">
<div class="join-capsule">
<label class="visually-hidden" for="${inputId}">${escapedHtml(LANDING_COPY.join.emailLabel)}</label>
<input id="${inputId}" class="join-input" name="${EMAIL_FIELD_NAME}" type="email" autocomplete="email" inputmode="email" placeholder="${escapedHtml(LANDING_COPY.join.emailPlaceholder)}" required>
<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(LANDING_COPY.join.submitting)}">${escapedHtml(LANDING_COPY.join.submit)}</button>
</div>
${challenge.widget}${challenge.fieldsOf(form)}${joinStatusHtml({ form, notice })}
</form>`;
}

function heroHtml({ notice, challenge }: { notice: LandingNotice; challenge: LandingChallenge }): string {
  return `<section class="hero page-width" aria-labelledby="hero-title">
<div class="hero-copy">
<p class="eyebrow-pill glass rise"><span class="eyebrow-dot" aria-hidden="true"></span>${escapedHtml(LANDING_COPY.hero.eyebrow)}</p>
<h1 id="hero-title" class="hero-title rise delay-1">${escapedHtml(LANDING_COPY.hero.title)}</h1>
<p class="hero-lead rise delay-2">${escapedHtml(LANDING_COPY.hero.lead)}</p>
${joinFormHtml({ form: JoinForm.Hero, notice, challenge, classNames: ['rise', 'delay-3'] })}
</div>
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

function finalCallHtml({ notice, challenge }: { notice: LandingNotice; challenge: LandingChallenge }): string {
  return `<section class="final-call page-width reveal" aria-labelledby="final-title">
${glyphHtml({ glyph: SiteGlyph.Icon, className: 'final-icon' })}
<h2 id="final-title" class="section-title">${escapedHtml(LANDING_COPY.final.title)}</h2>
<p class="final-body">${escapedHtml(LANDING_COPY.final.body)}</p>
${joinFormHtml({ form: JoinForm.Final, notice, challenge, classNames: [] })}
</section>`;
}

function landingHtml({ notice, challenge }: { notice: LandingNotice; challenge: LandingChallenge }): string {
  const { scriptTag } = challenge;
  return siteDocumentHtml({
    kind: SitePageKind.Public,
    path: LANDING_PATH,
    structuredData: LANDING_STRUCTURED_DATA,
    title: LANDING_COPY.meta.title,
    description: LANDING_COPY.meta.description,
    main: `<main id="${CONTENT_ID}">
${heroHtml({ notice, challenge })}
${benefitsHtml()}
${howItWorksHtml()}
${finalCallHtml({ notice, challenge })}
${scriptTag}</main>`,
    scripts: PAGE_SCRIPTS,
  });
}

function landingPageOf(notice: LandingNotice): LandingPage {
  return {
    available: ({ siteKey, stamp }) => landingHtml({ notice, challenge: challengeOf({ siteKey, stamp }) }),
    unavailable: landingHtml({ notice, challenge: NO_CHALLENGE }),
  };
}

const LANDING_PAGES: Record<LandingNotice, LandingPage> = {
  [LandingNotice.None]: landingPageOf(LandingNotice.None),
  [LandingNotice.OpensSoon]: landingPageOf(LandingNotice.OpensSoon),
  [LandingNotice.Joined]: landingPageOf(LandingNotice.Joined),
  [LandingNotice.TryAgain]: landingPageOf(LandingNotice.TryAgain),
};

export function landingChallengeKeysOf(env: Env): LandingChallengeKeys | null {
  const siteKey = siteKeyOf(env);
  const stampSecret = env.TURNSTILE_SECRET_KEY;
  if (siteKey === null || stampSecret === undefined) return null;
  return { siteKey, stampSecret };
}

export async function serveLandingPage({
  notice,
  challenge,
}: {
  notice: LandingNotice;
  challenge: LandingChallengeKeys | null;
}): Promise<Response> {
  const page = LANDING_PAGES[notice];
  const usableSiteKey = challenge === null ? null : usableSiteKeyOf(challenge.siteKey);
  if (challenge === null || usableSiteKey === null) {
    return sitePageResponse({ html: page.unavailable, contentSecurityPolicy: CONTENT_SECURITY_POLICY });
  }
  const stamp = await renderStampOf({ secret: challenge.stampSecret, renderedAt: Date.now() });
  return sitePageResponse({
    html: page.available({ siteKey: usableSiteKey, stamp }),
    contentSecurityPolicy: CHALLENGE_CONTENT_SECURITY_POLICY,
  });
}
