import { EMAIL_CODE_LENGTH, EMAIL_CODE_RESEND_SECONDS, MILLISECONDS_PER_SECOND } from '@todz/types';
import { EMAIL_CODE_SECONDS_SLOT, type EmailCodeCopy } from '../email-code-copy';
import { escapedHtml } from '../escaped-html';
import { JOIN_BUTTON_CLASS, JOIN_FORM_CLASS } from './join-form-classes';

const CODE_FORM_ATTRIBUTE = 'data-code-form';
const RESEND_SECONDS_ATTRIBUTE = 'data-resend-seconds';
const RESEND_LABEL_ATTRIBUTE = 'data-resend-label';
const RESEND_WAIT_ATTRIBUTE = 'data-resend-wait';
const ENTRY_CLASS = 'code-entry';
const BOX_CLASS = 'code-box';
const FIELD_CLASS = 'code-field';
const TIME_ZONE_FIELD = 'time_zone';
const NON_DIGITS_PATTERN = '/[^0-9]/g';
const ARIA_DISABLED = 'aria-disabled';

export const EMAIL_CODE_FIELD = 'email_code';

export enum CodeState {
  Wrong = 'wrong',
  Locked = 'locked',
}

export type HiddenField = { name: string; value: string };

export const EMAIL_CODE_SCRIPT = `{
  const form = document.querySelector('[${CODE_FORM_ATTRIBUTE}]');
  if (form !== null) {
    const entry = form.querySelector('.${ENTRY_CLASS}');
    const field = form.querySelector('.${FIELD_CLASS}');
    const boxes = [...form.querySelectorAll('.${BOX_CLASS}')];
    const length = boxes.length;
    const timeZone = form.querySelector('[name="${TIME_ZONE_FIELD}"]');
    if (timeZone !== null) timeZone.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    field.dataset.enhanced = 'true';
    const digitsOf = (text) => text.replace(${NON_DIGITS_PATTERN}, '').slice(0, length);
    const render = () => {
      const active = document.activeElement === entry ? Math.min(entry.value.length, length - 1) : -1;
      boxes.forEach((box, index) => {
        box.textContent = entry.value.charAt(index);
        box.dataset.active = String(index === active);
      });
    };
    const submitWhenFull = () => {
      if (entry.value.length === length) form.requestSubmit();
    };
    entry.addEventListener('input', () => {
      entry.value = digitsOf(entry.value);
      render();
      submitWhenFull();
    });
    entry.addEventListener('focus', render);
    entry.addEventListener('blur', render);
    document.addEventListener('paste', (event) => {
      const pasted = digitsOf(event.clipboardData.getData('text'));
      if (pasted === '') return;
      event.preventDefault();
      entry.value = pasted;
      entry.focus();
      render();
      submitWhenFull();
    });
    render();
  }
  const resend = document.querySelector('[${RESEND_SECONDS_ATTRIBUTE}]');
  if (resend !== null) {
    let remaining = Number(resend.getAttribute('${RESEND_SECONDS_ATTRIBUTE}'));
    const show = () => {
      const isWaiting = remaining > 0;
      resend.setAttribute('${ARIA_DISABLED}', String(isWaiting));
      resend.textContent = isWaiting
        ? resend.getAttribute('${RESEND_WAIT_ATTRIBUTE}').replace('${EMAIL_CODE_SECONDS_SLOT}', String(remaining))
        : resend.getAttribute('${RESEND_LABEL_ATTRIBUTE}');
    };
    const timer = setInterval(() => {
      remaining -= 1;
      show();
      if (remaining <= 0) clearInterval(timer);
    }, ${MILLISECONDS_PER_SECOND});
    show();
  }
}`;

function hiddenFieldsHtml(fields: HiddenField[]): string {
  return fields.map(({ name, value }) => `<input type="hidden" name="${escapedHtml(name)}" value="${escapedHtml(value)}">`).join('\n');
}

function boxesHtml(): string {
  return Array.from({ length: EMAIL_CODE_LENGTH }, () => `<span class="${BOX_CLASS}"></span>`).join('');
}

function noticeHtml(text: string | null): string {
  if (text === null) return '';
  return `<p class="join-notice" role="alert"><span class="notice-dot" aria-hidden="true"></span>${escapedHtml(text)}</p>\n`;
}

export function codeFormHtml({
  copy,
  action,
  fields,
  inputId,
  state,
}: {
  copy: EmailCodeCopy;
  action: string;
  fields: HiddenField[];
  inputId: string;
  state: CodeState | null;
}): string {
  const stateAttribute = state === null ? '' : ` data-state="${state}"`;
  const noticeByState: Record<CodeState, string> = { [CodeState.Wrong]: copy.wrong, [CodeState.Locked]: copy.locked };
  const notice = state === null ? null : noticeByState[state];
  return `<form class="${JOIN_FORM_CLASS} admin-form code-form" method="post" action="${action}" ${CODE_FORM_ATTRIBUTE}>
${hiddenFieldsHtml([...fields, { name: TIME_ZONE_FIELD, value: '' }])}
<p class="admin-body">${escapedHtml(copy.lead)}</p>
<div class="${FIELD_CLASS}"${stateAttribute}>
<label class="visually-hidden" for="${inputId}">${escapedHtml(copy.label)}</label>
<input id="${inputId}" class="${ENTRY_CLASS}" name="${EMAIL_CODE_FIELD}" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{${EMAIL_CODE_LENGTH}}" minlength="${EMAIL_CODE_LENGTH}" maxlength="${EMAIL_CODE_LENGTH}" required autofocus>
<span class="code-boxes" aria-hidden="true">${boxesHtml()}</span>
</div>
${noticeHtml(notice)}<button class="${JOIN_BUTTON_CLASS}" type="submit" data-submitting="${escapedHtml(copy.submitting)}">${escapedHtml(copy.submit)}</button>
</form>`;
}

export function resendFormHtml({
  copy,
  action,
  fields,
  widget,
}: {
  copy: EmailCodeCopy;
  action: string;
  fields: HiddenField[];
  widget: string;
}): string {
  return `<form class="${JOIN_FORM_CLASS} admin-form code-resend-form" method="post" action="${action}">
${hiddenFieldsHtml(fields)}
${widget}<button class="${JOIN_BUTTON_CLASS} code-resend" type="submit" data-submitting="${escapedHtml(copy.resending)}" ${RESEND_SECONDS_ATTRIBUTE}="${EMAIL_CODE_RESEND_SECONDS}" ${RESEND_LABEL_ATTRIBUTE}="${escapedHtml(copy.resend)}" ${RESEND_WAIT_ATTRIBUTE}="${escapedHtml(copy.resendWait)}">${escapedHtml(copy.resend)}</button>
</form>`;
}
