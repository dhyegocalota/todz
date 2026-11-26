import { LANDING_SHOTS, type LandingShot, type ShotFile } from './landing-shots';

const NARROW_BREAKPOINT = '40rem';
const WIDE_BREAKPOINT = '64rem';

function cropRules([shot, { width, crop }]: [string, ShotFile]): string[] {
  if (crop === null) return [];
  return [
    `.crop-${shot}{--source-width:${width};--crop-x:${crop.x};--crop-y:${crop.y};--crop-width:${crop.width};--crop-height:${crop.height}}`,
  ];
}

const CROP_RULES = Object.entries(LANDING_SHOTS).flatMap(cropRules).join('\n');

export function cropClassOf(shot: LandingShot): string {
  return `crop crop-${shot}`;
}

const ADMIN_STYLE = `.admin-card{display:flex;flex-direction:column;align-items:center;width:min(100% - 2 * var(--space-side), var(--measure-form));margin:var(--space-7) auto 0;padding:var(--space-4);border-radius:var(--radius-card);text-align:center}
.admin-card [hidden]{display:none}
.admin-card [data-answer]:focus{outline:none}
.admin-title{margin-top:var(--space-5);font-size:var(--text-title);line-height:1.3;letter-spacing:-0.01em;font-weight:650}
.admin-body{margin-top:var(--space-2);color:var(--color-text-muted)}
.admin-form{margin-top:var(--space-5)}
.admin-card .join-capsule{display:grid;gap:var(--space-2);height:auto;padding:0;background:none;-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none}
.admin-card .join-capsule:hover{box-shadow:none}
.admin-card .join-capsule:has(.join-input:focus-visible){outline:none}
.admin-card .join-input{flex:none;height:var(--size-capsule);background:var(--glass-sheen), var(--glass-fill);-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);box-shadow:var(--glass-edge), var(--shadow-card)}
.admin-card .join-input:focus-visible{outline:3px solid var(--color-focus);outline-offset:2px}
.admin-card .join-button{height:var(--size-capsule)}
.admin-link{display:inline-flex;align-items:center;min-height:var(--size-tap);margin-top:var(--space-3);font-size:var(--text-small)}
.link-status{display:flex;flex-direction:column;align-items:center}
.link-status[data-state=working] .admin-title::before{content:'';display:inline-block;width:8px;height:8px;margin-right:var(--space-2);border-radius:50%;background:var(--color-mint);box-shadow:0 0 0 3px rgb(140 247 208 / 0.28)}
.admin-panel{width:min(100% - 2 * var(--space-side), var(--measure-hero));margin:var(--space-7) auto 0}
.panel-head{display:flex;flex-direction:column;align-items:flex-start;gap:var(--space-3)}
.panel-title{font-size:var(--text-section);line-height:1.1;letter-spacing:-0.025em;font-weight:700}
.panel-actions{display:flex;align-items:center;gap:var(--space-2)}
.admin-action{display:inline-flex;align-items:center;min-height:var(--size-tap);padding-inline:var(--space-5);border:0;border-radius:var(--radius-pill);font:inherit;font-weight:600;color:var(--color-text);text-decoration:none;background:var(--glass-sheen), var(--glass-fill);-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);box-shadow:var(--glass-edge), var(--shadow-card);transition:background-color var(--duration-quick) var(--ease-out), transform var(--duration-quick) var(--ease-out)}
.admin-action:hover{background:var(--color-hairline)}
.admin-action:active{transform:scale(0.98)}
.nav-button{border:0;background:none;font:inherit;font-size:0.9375rem;font-weight:500;cursor:pointer}
.stat-list{display:grid;gap:var(--space-2);margin:var(--space-5) 0 0}
.stat-tile{display:flex;align-items:center;justify-content:space-between;min-height:56px;padding:var(--space-3) var(--space-4);border-radius:var(--radius-card);box-shadow:var(--glass-edge), var(--shadow-card)}
.stat-tile dt{font-size:var(--text-small);color:var(--color-text-muted)}
.stat-tile dd{margin:0;font-size:var(--text-section);line-height:1.1;font-weight:700;font-variant-numeric:tabular-nums}
.table-card,.empty-card{margin-top:var(--space-6);padding:var(--space-4);border-radius:var(--radius-card);box-shadow:var(--glass-edge), var(--shadow-card)}
.admin-table caption,.admin-table thead{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.admin-table,.admin-table tbody{display:block}
.admin-table tr{display:grid;grid-template-columns:1fr auto;align-items:center;gap:var(--space-1) var(--space-3);padding-block:var(--space-3);border-top:1px solid var(--color-hairline)}
.admin-table tr:first-child{border-top:0}
.admin-table th,.admin-table td{display:block;padding:0;text-align:left}
.admin-table th[scope=row]{grid-column:1 / -1;font-weight:400;overflow-wrap:anywhere}
.admin-table td{font-size:var(--text-small);font-variant-numeric:tabular-nums;color:var(--color-text-muted)}
.admin-table thead th{font-size:var(--text-small);font-weight:600;color:var(--color-text-muted)}
.badge{display:inline-flex;align-items:center;gap:var(--space-2);padding:2px var(--space-3);border-radius:var(--radius-pill);font-size:var(--text-small);font-weight:600;color:var(--color-text-muted)}
.badge-dot{width:8px;height:8px;border-radius:50%;background:var(--color-mint)}
.badge-failed{color:var(--color-text);background:var(--color-chip);border:1px dashed var(--color-text-muted)}
.badge-failed .badge-dot{background:none;box-shadow:inset 0 0 0 2px var(--color-text)}
.table-note{margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--color-hairline);font-size:var(--text-small);color:var(--color-text-muted)}
.empty-card{padding-block:var(--space-7);text-align:center}
.empty-title{font-size:var(--text-title);line-height:1.3;font-weight:650}
.empty-body{margin-top:var(--space-2);color:var(--color-text-muted)}
@media (min-width: ${NARROW_BREAKPOINT}){
.admin-card{margin-top:var(--space-9);padding:var(--space-6)}
.admin-panel{margin-top:var(--space-9)}
.panel-head{flex-direction:row;align-items:center;justify-content:space-between}
.stat-list{grid-template-columns:repeat(3, 1fr);gap:var(--space-4)}
.stat-tile{flex-direction:column;align-items:flex-start;justify-content:center;gap:var(--space-1);padding:var(--space-5)}
.stat-tile dt{order:-1}
.table-card{padding:var(--space-5)}
.admin-table{display:table;width:100%;border-collapse:collapse}
.admin-table thead{display:table-header-group;position:static;width:auto;height:auto;margin:0;overflow:visible;clip-path:none;white-space:normal}
.admin-table tbody{display:table-row-group}
.admin-table tr{display:table-row;padding:0}
.admin-table th,.admin-table td{display:table-cell;padding:var(--space-3) var(--space-5) var(--space-3) 0;vertical-align:middle;border-top:1px solid var(--color-hairline)}
.admin-table thead th{border-top:0}
.admin-table th[scope=row]{width:100%}
.admin-table td{font-size:var(--text-body);color:inherit;white-space:nowrap}
.admin-table th:last-child,.admin-table td:last-child{padding-right:0}}
@media (prefers-reduced-motion: no-preference){
.link-status[data-state=working] .admin-title::before{animation:pulse var(--duration-arrive) ease-in-out infinite alternate}
@keyframes pulse{to{opacity:0.4}}}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
.admin-card .join-input,.admin-action{background:var(--color-surface)}}
@media (prefers-reduced-transparency: reduce){
.admin-card .join-input,.admin-action{background:var(--color-surface);-webkit-backdrop-filter:none;backdrop-filter:none}}
@media (forced-colors: active){
.stat-tile,.table-card,.empty-card,.admin-card .join-input,.admin-action{background:Canvas;box-shadow:none;border:1px solid CanvasText}
.badge-failed{border:1px dashed CanvasText}
.badge-dot,.link-status[data-state=working] .admin-title::before{background:CanvasText;box-shadow:none}
.badge-failed .badge-dot{background:none;box-shadow:inset 0 0 0 2px CanvasText}}`;

export const SITE_STYLE = `:root{color-scheme:light dark;
--color-page:#F2F4FA;--color-surface:#FFFFFF;--color-text:#161A33;--color-text-muted:#5B6285;--color-hairline:rgb(22 26 51 / 0.08);
--color-accent:#2F5BFF;--color-link:#2F5BFF;--color-focus:#2F5BFF;--color-mint:#8CF7D0;--color-on-action:#FFFFFF;
--color-terminal:#0E1020;--color-terminal-text:#E6E9F7;--color-terminal-muted:#9AA3C7;--color-terminal-prompt:#8CF7D0;
--color-chip:rgb(47 91 255 / 0.08);
--gradient-action:linear-gradient(135deg, #2F5BFF, #1B2A9E);
--gradient-wallpaper:radial-gradient(75rem 44rem at 10% 115%, #6AA6FF, transparent 60%), radial-gradient(56rem 38rem at 95% -10%, #FFB6D9, transparent 55%), linear-gradient(160deg, #C9D8FF, #F4E3F1);
--gradient-aurora:radial-gradient(60rem 30rem at 50% -8rem, rgb(47 91 255 / 0.14), transparent 70%);
--glass-fill:rgb(255 255 255 / 0.62);--glass-sheen:linear-gradient(180deg, rgb(255 255 255 / 0.5), rgb(255 255 255 / 0.08));
--glass-blur:blur(34px) saturate(180%);--glass-edge:inset 0 0 0 1px rgb(255 255 255 / 0.6), inset 0 1px 0 rgb(255 255 255 / 0.9);
--glass-header-fill:rgb(242 244 250 / 0.72);--glass-header-blur:blur(20px) saturate(180%);
--shadow-glass:0 22px 60px rgb(30 40 90 / 0.24);--shadow-card:0 12px 32px rgb(30 40 90 / 0.10);
--shadow-shot:0 30px 80px rgb(30 40 90 / 0.30), 0 0 0 0.5px rgb(0 0 0 / 0.15);
--shadow-action:inset 0 1px 0 rgb(255 255 255 / 0.25), 0 8px 24px -8px rgb(47 91 255 / 0.55);
--radius-control:12px;--radius-card:24px;--radius-stage:28px;--radius-shot:12px;--radius-widget:22px;--radius-pill:999px;
--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:24px;--space-6:32px;--space-7:48px;--space-8:64px;--space-9:96px;
--space-section:var(--space-8);--space-side:var(--space-4);
--font-sans:system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-rounded:ui-rounded, 'SF Pro Rounded', var(--font-sans);
--font-mono:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
--text-hero:clamp(2.5rem, 1.6rem + 3.6vw, 4.5rem);--text-section:clamp(1.75rem, 1.3rem + 1.6vw, 2.5rem);--text-title:1.25rem;
--text-lead:clamp(1.0625rem, 0.95rem + 0.45vw, 1.3125rem);--text-body:1rem;--text-small:0.875rem;--text-code:0.875rem;--text-eyebrow:0.8125rem;
--measure-page:72rem;--measure-hero:46rem;--measure-form:28rem;
--size-tap:44px;--size-capsule:52px;--size-header:52px;
--duration-quick:120ms;--duration-base:220ms;--duration-arrive:640ms;--delay-step:90ms;
--distance-rise:16px;--distance-stage:32px;
--ease-out:cubic-bezier(0.2, 0.8, 0.2, 1);--ease-spring:cubic-bezier(0.34, 1.56, 0.64, 1)}
@media (prefers-color-scheme: dark){:root{
--color-page:#070812;--color-surface:#171A2E;--color-text:#F2F4FF;--color-text-muted:#A9B0D6;--color-hairline:rgb(242 244 255 / 0.08);
--color-accent:#7C95FF;--color-link:#8CF7D0;--color-focus:#8CF7D0;--color-chip:rgb(47 91 255 / 0.16);
--gradient-wallpaper:radial-gradient(70rem 40rem at 10% 115%, rgb(47 91 255 / 0.55), transparent 60%), radial-gradient(50rem 34rem at 95% -10%, rgb(140 247 208 / 0.16), transparent 55%), linear-gradient(160deg, #141A46, #0E1020);
--gradient-aurora:radial-gradient(60rem 30rem at 50% -8rem, rgb(47 91 255 / 0.28), transparent 70%);
--glass-fill:rgb(23 26 46 / 0.55);--glass-sheen:linear-gradient(180deg, rgb(255 255 255 / 0.07), rgb(255 255 255 / 0));
--glass-edge:inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.12);
--glass-header-fill:rgb(7 8 18 / 0.6);
--shadow-glass:0 30px 80px rgb(0 0 0 / 0.55);--shadow-card:0 16px 40px rgb(0 0 0 / 0.35);
--shadow-shot:0 30px 80px rgb(0 0 0 / 0.6), 0 0 0 0.5px rgb(255 255 255 / 0.1)}}
@media (min-width: ${NARROW_BREAKPOINT}){:root{--space-section:var(--space-9);--space-side:var(--space-5);--size-capsule:56px;--size-header:56px;--text-code:0.9375rem}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;font-family:var(--font-sans);font-size:var(--text-body);line-height:1.55;color:var(--color-text);background:var(--gradient-aurora) no-repeat, var(--color-page);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
main{flex:1}
h1,h2,h3,p,ol,ul,figure{margin:0}
img{display:block;max-width:100%;height:auto}
a{color:var(--color-link);text-underline-offset:0.12em}
:focus-visible{outline:3px solid var(--color-focus);outline-offset:2px}
.visually-hidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.glyph-sprite{position:absolute;width:0;height:0;overflow:hidden}
.page-width{width:min(100% - 2 * var(--space-side), var(--measure-page));margin-inline:auto}
.glass{background:var(--glass-sheen), var(--glass-fill);-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);box-shadow:var(--glass-edge), var(--shadow-glass)}
.skip-link{position:absolute;left:var(--space-4);top:var(--space-2);z-index:20;padding:var(--space-2) var(--space-4);border-radius:var(--radius-pill);background:var(--color-surface);color:var(--color-text);font-weight:600;transform:translateY(-200%)}
.skip-link:focus-visible{transform:none}
.site-header{position:sticky;top:0;z-index:10;background:var(--glass-header-fill);-webkit-backdrop-filter:var(--glass-header-blur);backdrop-filter:var(--glass-header-blur);border-bottom:1px solid var(--color-hairline)}
.site-header-inner{display:flex;align-items:center;justify-content:space-between;height:var(--size-header)}
.brand{display:inline-flex;align-items:center;gap:var(--space-2);min-height:var(--size-tap);color:var(--color-text);text-decoration:none;border-radius:var(--radius-control)}
.brand-icon{width:28px;height:28px;border-radius:7px}
.wordmark{font-family:var(--font-rounded);font-weight:700;font-size:1.25rem;letter-spacing:-0.02em}
.site-nav{display:flex;align-items:center;gap:var(--space-2)}
.nav-link{display:inline-flex;align-items:center;min-height:var(--size-tap);padding-inline:var(--space-3);border-radius:var(--radius-pill);color:var(--color-text-muted);font-size:0.9375rem;font-weight:500;text-decoration:none;transition:color var(--duration-quick) var(--ease-out), background-color var(--duration-quick) var(--ease-out)}
.nav-link:hover{color:var(--color-text);background:var(--color-hairline)}
.label-long{display:none}
.hero{padding-top:var(--space-7);text-align:center}
.hero-copy{display:flex;flex-direction:column;align-items:center;max-width:var(--measure-hero);margin-inline:auto}
.eyebrow-pill{display:inline-flex;align-items:center;gap:var(--space-2);padding:6px var(--space-3);border-radius:var(--radius-pill);font-size:var(--text-eyebrow);line-height:1;letter-spacing:0.02em;font-weight:600;color:var(--color-text-muted)}
.eyebrow-dot{width:6px;height:6px;border-radius:50%;background:var(--color-accent);box-shadow:0 0 0 3px rgb(47 91 255 / 0.18)}
.hero-title{margin-top:var(--space-5);max-width:18ch;font-size:var(--text-hero);line-height:1.04;letter-spacing:-0.035em;font-weight:700;text-wrap:balance}
.hero-lead{margin-top:var(--space-5);max-width:34em;font-size:var(--text-lead);line-height:1.5;color:var(--color-text-muted);text-wrap:balance}
.join-form{width:100%;max-width:var(--measure-form);margin-inline:auto;scroll-margin-top:calc(var(--size-header) + var(--space-7))}
.download{width:100%;max-width:var(--measure-form);margin:var(--space-6) auto 0;text-align:center}
.download-button{display:inline-flex;align-items:center;justify-content:center;width:100%;height:var(--size-capsule);padding:0 var(--space-6);border-radius:var(--radius-pill);font-weight:600;color:var(--color-on-action);background:var(--gradient-action);box-shadow:var(--shadow-action);text-decoration:none;white-space:nowrap;transition:filter var(--duration-quick) var(--ease-out), transform var(--duration-quick) var(--ease-out)}
.download-button:hover{filter:brightness(1.06)}
.download-button:active{transform:scale(0.98)}
.download-button:focus-visible{outline:3px solid var(--color-focus);outline-offset:2px}
.download-note{margin-top:var(--space-3);font-size:var(--text-small);color:var(--color-text-muted)}
.download-note-link{color:var(--color-text);text-decoration:underline;text-underline-offset:0.2em}
.join-capsule{display:grid;gap:var(--space-2);border-radius:var(--radius-pill)}
.join-input{width:100%;height:var(--size-capsule);padding:0 var(--space-5);border:0;border-radius:var(--radius-pill);font:inherit;color:var(--color-text);background:var(--glass-sheen), var(--glass-fill);-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);box-shadow:var(--glass-edge), var(--shadow-card);transition:background-color var(--duration-base) var(--ease-out)}
.join-input::placeholder{color:var(--color-text-muted);opacity:1}
.join-input:focus{outline:none}
.join-input:focus-visible{outline:3px solid var(--color-focus);outline-offset:2px}
.join-input:user-invalid{outline:2px dashed var(--color-text-muted);outline-offset:2px}
.join-button{height:var(--size-capsule);padding:0 var(--space-5);border:0;border-radius:var(--radius-pill);font:inherit;font-weight:600;color:var(--color-on-action);background:var(--gradient-action);box-shadow:var(--shadow-action);cursor:pointer;white-space:nowrap;transition:filter var(--duration-quick) var(--ease-out), transform var(--duration-quick) var(--ease-out)}
.join-button:hover{filter:brightness(1.06)}
.join-button:active{transform:scale(0.98)}
.join-button[aria-disabled=true]{cursor:not-allowed;filter:saturate(0.7)}
.join-form[data-join-state=sending] .join-button{cursor:progress}
.cf-turnstile{display:flex;justify-content:center}
.join-check{min-height:65px;margin-top:var(--space-3);border-radius:var(--radius-pill)}
.join-extra{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.join-note,.join-notice{margin-top:var(--space-3);font-size:var(--text-small);color:var(--color-text-muted);text-align:center}
.join-notice{display:flex;align-items:center;justify-content:center;gap:var(--space-2);color:var(--color-text);font-weight:500}
.join-notice:focus{outline:none}
.join-notice-neutral .notice-dot{background:var(--color-text-muted);box-shadow:none}
.notice-dot{width:8px;height:8px;border-radius:50%;background:var(--color-mint);box-shadow:0 0 0 3px rgb(140 247 208 / 0.28)}
.desk-stage{position:relative;margin-top:var(--space-7);aspect-ratio:343 / 400;border-radius:var(--radius-stage);background:var(--gradient-wallpaper);box-shadow:var(--glass-edge), var(--shadow-glass);overflow:hidden;isolation:isolate}
.menu-strip{position:absolute;inset:0 0 auto;height:28px;display:flex;align-items:center;justify-content:flex-end;padding-inline:var(--space-4);background:var(--glass-sheen), var(--glass-fill);-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);box-shadow:inset 0 -1px 0 var(--color-hairline);color:var(--color-text)}
.menu-strip-item{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:6px;background:var(--color-hairline);font-size:0.8125rem;font-weight:600;font-variant-numeric:tabular-nums}
.menu-glyph{width:16px;height:16px}
.shot{position:absolute;border-radius:var(--radius-shot);overflow:hidden;box-shadow:var(--shadow-shot)}
.shot img,.shot picture{display:block;width:100%}
.shot-window{display:none;left:3%;top:10%;width:66%}
.shot-popover{left:50%;top:40px;width:min(280px, 82%);translate:-50% 0;border-radius:var(--radius-control)}
.shot-widget{left:6%;bottom:24px;width:min(240px, 70%);border-radius:var(--radius-widget)}
.crop{position:relative;aspect-ratio:var(--crop-width) / var(--crop-height);overflow:hidden}
.crop img{position:absolute;max-width:none;width:calc(var(--source-width) / var(--crop-width) * 100%);left:calc(var(--crop-x) / var(--crop-width) * -100%);top:calc(var(--crop-y) / var(--crop-height) * -100%)}
${CROP_RULES}
.benefits{margin-top:var(--space-section)}
.benefit-list{display:grid;gap:var(--space-4);padding:0;list-style:none}
.benefit-card{display:flex;flex-direction:column;padding:var(--space-4);border-radius:var(--radius-card);box-shadow:var(--glass-edge), var(--shadow-card)}
.benefit-well{position:relative;height:140px;border-radius:calc(var(--radius-card) - var(--space-2));background:var(--gradient-wallpaper);overflow:hidden;display:flex;align-items:center;justify-content:center}
.benefit-well-agents{align-items:flex-start;justify-content:flex-start;padding:var(--space-5) 0 0 var(--space-5)}
.benefit-shot-agents{width:160%;flex:none;border-radius:var(--radius-shot);box-shadow:var(--shadow-shot)}
.benefit-shot-ring{width:116px;border-radius:var(--radius-widget);box-shadow:var(--shadow-shot)}
.offline-glyph{width:64px;height:64px;filter:drop-shadow(0 12px 24px rgb(27 42 158 / 0.35))}
.benefit-title{margin-top:var(--space-5);font-size:var(--text-title);line-height:1.3;letter-spacing:-0.01em;font-weight:650}
.benefit-body{margin-top:var(--space-2);color:var(--color-text-muted)}
.how-it-works{margin-top:var(--space-section);display:grid;gap:var(--space-6);align-items:center}
.section-eyebrow{font-size:var(--text-eyebrow);letter-spacing:0.02em;font-weight:600;color:var(--color-accent)}
.section-title{font-size:var(--text-section);line-height:1.1;letter-spacing:-0.025em;font-weight:700;text-wrap:balance}
.how-copy .section-title{margin-top:var(--space-3)}
.step-list{margin-top:var(--space-5);padding:0;list-style:none;counter-reset:step;display:grid;gap:var(--space-4)}
.step-list li{counter-increment:step;display:grid;grid-template-columns:24px 1fr;gap:var(--space-3);align-items:start;color:var(--color-text-muted)}
.step-list li::before{content:counter(step);display:grid;place-items:center;width:24px;height:24px;margin-top:1px;border-radius:50%;background:var(--color-chip);color:var(--color-accent);font-size:var(--text-small);font-weight:700;font-variant-numeric:tabular-nums}
.terminal{border-radius:20px;background:var(--color-terminal);box-shadow:inset 0 0 0 1px rgb(255 255 255 / 0.06), var(--shadow-glass);overflow:hidden}
.terminal-bar{display:flex;gap:var(--space-2);padding:var(--space-4) var(--space-5) 0}
.terminal-dot{width:12px;height:12px;border-radius:50%;background:rgb(255 255 255 / 0.16)}
.terminal-body{margin:0;padding:var(--space-4) var(--space-5) var(--space-5);font-family:var(--font-mono);font-variant-ligatures:none;font-size:var(--text-code);line-height:1.6;color:var(--color-terminal-text);white-space:pre-wrap;overflow-wrap:break-word}
.terminal-line{display:block;padding-left:2ch;text-indent:-2ch}
.terminal-line + .terminal-line{margin-top:var(--space-3)}
.terminal-prompt{color:var(--color-terminal-prompt);font-weight:700}
.terminal-command{color:var(--color-terminal-muted)}
.terminal-word{white-space:nowrap}
.terminal-ask{color:#FFFFFF}
.terminal-call::before{content:'⏺ ';color:var(--color-terminal-prompt)}
.terminal-result{padding-left:5ch;color:var(--color-terminal-muted)}
.terminal-result::before{content:'⎿  '}
.final-call{margin-top:var(--space-section);padding:var(--space-8) var(--space-4);display:flex;flex-direction:column;align-items:center;text-align:center;border-radius:var(--radius-stage);background:var(--gradient-wallpaper);box-shadow:var(--glass-edge), var(--shadow-glass)}
.final-icon{width:64px;height:64px;border-radius:15px;box-shadow:0 18px 40px rgb(27 42 158 / 0.35)}
.final-call .section-title{margin-top:var(--space-5)}
.final-body{margin-top:var(--space-3);font-size:var(--text-lead);color:var(--color-text-muted)}
.final-download{width:auto;margin-top:var(--space-6)}
.site-footer{margin-top:var(--space-section);border-top:1px solid var(--color-hairline)}
.site-footer-inner{display:flex;flex-direction:column;align-items:center;gap:var(--space-2);padding-block:var(--space-5);font-size:var(--text-small);color:var(--color-text-muted)}
.footer-link{display:inline-flex;align-items:center;min-height:var(--size-tap);color:var(--color-text-muted);text-decoration:none}
.footer-link:hover{color:var(--color-text)}
.footer-credit-link{color:var(--color-text);text-decoration:underline;text-underline-offset:0.2em}
@media (min-width: ${NARROW_BREAKPOINT}){
.label-long{display:inline}
.label-short{display:none}
.hero{padding-top:var(--space-9)}
.final-call{padding-inline:var(--space-5)}
.join-capsule{display:flex;align-items:center;gap:0;height:var(--size-capsule);padding:4px;background:var(--glass-sheen), var(--glass-fill);-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);box-shadow:var(--glass-edge), var(--shadow-card);transition:box-shadow var(--duration-base) var(--ease-out)}
.join-capsule:hover{box-shadow:inset 0 0 0 1px rgb(255 255 255 / 0.8), inset 0 1px 0 rgb(255 255 255 / 0.9), var(--shadow-card)}
.join-capsule:has(.join-input:focus-visible){outline:3px solid var(--color-focus);outline-offset:2px}
.join-input{flex:1;min-width:0;height:100%;background:none;-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none}
.join-input:focus-visible{outline:none}
.join-button{height:100%}
.download-button{width:auto}
.desk-stage{aspect-ratio:1152 / 600}
.shot-window{display:block}
.shot-popover{left:auto;right:5%;top:12%;width:27%;translate:none}
.shot-widget{left:auto;right:3%;bottom:6%;width:28%}
.benefit-card{padding:var(--space-5)}
.benefit-well{height:160px}
.site-footer-inner{flex-direction:row;justify-content:space-between;min-height:72px;padding-block:0}
.footer-copyright{margin-right:auto;margin-left:var(--space-4)}
.footer-credit{margin-right:var(--space-4)}}
@media (min-width: ${WIDE_BREAKPOINT}){
.benefit-list{grid-template-columns:repeat(3, 1fr);gap:var(--space-5)}
.how-it-works{grid-template-columns:5fr 7fr;gap:var(--space-7)}}
@media (prefers-reduced-motion: no-preference){
.rise{animation:rise var(--duration-arrive) var(--ease-out) both}
.arrive{animation:arrive calc(var(--duration-arrive) * 1.4) var(--ease-out) both}
.settle{animation:settle calc(var(--duration-arrive) * 1.2) var(--ease-spring) both}
.delay-1{animation-delay:var(--delay-step)}
.delay-2{animation-delay:calc(var(--delay-step) * 2)}
.delay-3{animation-delay:calc(var(--delay-step) * 3)}
.delay-4{animation-delay:calc(var(--delay-step) * 4)}
.delay-5{animation-delay:calc(var(--delay-step) * 5)}
.delay-6{animation-delay:calc(var(--delay-step) * 6)}
.join-notice{animation:fade var(--duration-base) var(--ease-out) both}
@keyframes rise{from{opacity:0;transform:translateY(var(--distance-rise))}}
@keyframes arrive{from{opacity:0;transform:translateY(var(--distance-stage))}}
@keyframes settle{from{opacity:0;transform:translateY(var(--distance-stage)) scale(0.96)}}
@keyframes fade{from{opacity:0}}
@supports (animation-timeline: view()){
.reveal{animation:rise linear both;animation-timeline:view();animation-range:entry 0% entry 60%}}}
@media (prefers-reduced-motion: reduce){
html{scroll-behavior:auto}
*,*::before,*::after{transition-duration:var(--duration-quick) !important;transition-property:color, background-color, opacity !important}}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
.glass,.join-input,.join-capsule,.menu-strip{background:var(--color-surface)}
.site-header{background:var(--color-page)}}
@media (prefers-reduced-transparency: reduce){
.glass,.join-input,.join-capsule,.menu-strip{background:var(--color-surface);-webkit-backdrop-filter:none;backdrop-filter:none}
.site-header{background:var(--color-page);-webkit-backdrop-filter:none;backdrop-filter:none}}
@media (forced-colors: active){
.glass,.join-input,.join-capsule,.desk-stage,.final-call,.terminal,.benefit-well{background:Canvas;box-shadow:none;border:1px solid CanvasText}
.join-button,.download-button{background:ButtonFace;color:ButtonText;border:1px solid ButtonText;box-shadow:none}
.eyebrow-dot,.notice-dot{background:CanvasText;box-shadow:none}}
${ADMIN_STYLE}`;
