export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
export const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
export const TURNSTILE_RESPONSE_FIELD = 'cf-turnstile-response';
export const JAVASCRIPT_CONTENT_TYPE = 'text/javascript';
export const FAILED_MARKER_ATTRIBUTE = 'data-widget-failed';
export const RESET_COUNT_ATTRIBUTE = 'data-turnstile-resets';
const FAILED_MARKER = 'widgetFailed';
const RESET_COUNT_PROPERTY = 'turnstileResets';
const SLOW_TOKEN_DELAY_MS = 1_000;
const TURNSTILE_SOLVE = `const solveWidget = (widget) => {
  const token = document.createElement('input');
  token.type = 'hidden';
  token.name = '${TURNSTILE_RESPONSE_FIELD}';
  token.value = '${TURNSTILE_DUMMY_TOKEN}';
  widget.append(token);
  const frame = document.createElement('div');
  frame.className = 'stub-turnstile-frame';
  frame.style.width = '100%';
  frame.style.minWidth = '300px';
  frame.style.height = '65px';
  widget.append(frame);
  const solved = window[widget.dataset.callback];
  if (typeof solved === 'function') solved(token.value);
};
const solve = () => document.querySelectorAll('.cf-turnstile').forEach(solveWidget);`;

const TURNSTILE_RESET = `document.documentElement.dataset.${RESET_COUNT_PROPERTY} = '0';
window.turnstile = {
  reset: (widget) => {
    document.documentElement.dataset.${RESET_COUNT_PROPERTY} = String(Number(document.documentElement.dataset.${RESET_COUNT_PROPERTY}) + 1);
    widget.querySelectorAll('input[name="${TURNSTILE_RESPONSE_FIELD}"], .stub-turnstile-frame').forEach((token) => token.remove());
    setTimeout(() => navigator.onLine && solveWidget(widget), 0);
  },
};`;

const TURNSTILE_ERROR = `const fail = () => document.querySelectorAll('.cf-turnstile').forEach((widget) => {
  const failed = window[widget.dataset.errorCallback];
  if (typeof failed === 'function') failed();
});`;

export const TURNSTILE_STUB = `{
${TURNSTILE_SOLVE}
${TURNSTILE_RESET}
solve();
}`;

export const SLOW_TURNSTILE_STUB = `{
${TURNSTILE_SOLVE}
${TURNSTILE_RESET}
setTimeout(solve, ${SLOW_TOKEN_DELAY_MS});
}`;

export const NEVER_SOLVING_TURNSTILE_STUB = `{
${TURNSTILE_SOLVE}
${TURNSTILE_RESET}
window.solveNow = solve;
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
