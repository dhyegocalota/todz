import { EMAIL_CODE_LENGTH } from '@todz/types';
import { JOIN_BUTTON_CLASS } from './join-form-classes';

export const SHAKE_ANIMATION_NAME = 'code-shake';

export const EMAIL_CODE_STYLE = `.code-form{width:100%}
.code-field{position:relative;margin-top:var(--space-4)}
.code-entry{display:block;width:100%;height:var(--size-capsule);padding:0 var(--space-4);border:0;border-radius:var(--radius-control);font:inherit;font-family:var(--font-mono);font-size:var(--text-title);letter-spacing:0.5em;text-align:center;color:var(--color-text);background:var(--glass-sheen), var(--glass-fill);-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);box-shadow:var(--glass-edge), var(--shadow-card)}
.code-entry:focus{outline:none}
.code-entry:focus-visible{outline:3px solid var(--color-focus);outline-offset:2px}
.code-boxes{display:none}
.code-field[data-enhanced] .code-boxes{display:grid;grid-template-columns:repeat(${EMAIL_CODE_LENGTH}, minmax(0, 1fr));gap:var(--space-2);pointer-events:none}
.code-field[data-enhanced] .code-entry{position:absolute;inset:0;z-index:1;opacity:0;cursor:text}
.code-box{display:grid;place-items:center;min-height:var(--size-capsule);border-radius:var(--radius-control);font-family:var(--font-mono);font-size:var(--text-title);font-weight:650;color:var(--color-text);background:var(--glass-sheen), var(--glass-fill);-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);box-shadow:var(--glass-edge), var(--shadow-card)}
.code-box[data-active=true]{outline:3px solid var(--color-focus);outline-offset:2px}
.code-field[data-state] .code-box,.code-field[data-state] .code-entry{box-shadow:inset 0 0 0 2px var(--color-error)}
.code-resend-form{margin-top:var(--space-3)}
.code-resend{width:100%;height:var(--size-tap);color:var(--color-text);background:var(--glass-sheen), var(--glass-fill);box-shadow:var(--glass-edge)}
.code-resend[aria-disabled=true]{color:var(--color-text-muted)}
.code-form .${JOIN_BUTTON_CLASS}{width:100%;margin-top:var(--space-4)}
@media (prefers-reduced-motion: no-preference){
.code-field[data-state=wrong]{animation:${SHAKE_ANIMATION_NAME} 420ms var(--ease-out)}
@keyframes ${SHAKE_ANIMATION_NAME}{20%{transform:translateX(-8px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(3px)}}}
@media (forced-colors: active){
.code-box,.code-entry,.code-resend{background:Canvas;box-shadow:none;border:1px solid CanvasText}
.code-field[data-state] .code-box,.code-field[data-state] .code-entry{border:2px solid Mark}}`;
