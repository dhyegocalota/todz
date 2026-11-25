export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
export const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
export const TURNSTILE_RESPONSE_FIELD = 'cf-turnstile-response';
export const JAVASCRIPT_CONTENT_TYPE = 'text/javascript';
export const FAILED_MARKER_ATTRIBUTE = 'data-widget-failed';
const FAILED_MARKER = 'widgetFailed';
const SLOW_TOKEN_DELAY_MS = 1_000;
const TURNSTILE_SOLVE = `const solve = () => document.querySelectorAll('.cf-turnstile').forEach((widget) => {
  const token = document.createElement('input');
  token.type = 'hidden';
  token.name = '${TURNSTILE_RESPONSE_FIELD}';
  token.value = '${TURNSTILE_DUMMY_TOKEN}';
  widget.append(token);
  const solved = window[widget.dataset.callback];
  if (typeof solved === 'function') solved(token.value);
});`;

const TURNSTILE_ERROR = `const fail = () => document.querySelectorAll('.cf-turnstile').forEach((widget) => {
  const failed = window[widget.dataset.errorCallback];
  if (typeof failed === 'function') failed();
});`;

export const TURNSTILE_STUB = `{
${TURNSTILE_SOLVE}
solve();
}`;

export const SLOW_TURNSTILE_STUB = `{
${TURNSTILE_SOLVE}
setTimeout(solve, ${SLOW_TOKEN_DELAY_MS});
}`;

export const ERRORING_TURNSTILE_STUB = `{
${TURNSTILE_ERROR}
document.addEventListener('submit', fail);
}`;

export const FAILED_BEFORE_PRESS_TURNSTILE_STUB = `{
${TURNSTILE_ERROR}
const failOnce = () => {
  fail();
  document.documentElement.dataset.${FAILED_MARKER} = 'true';
};
if (document.readyState === 'complete') failOnce();
else addEventListener('load', failOnce);
}`;
