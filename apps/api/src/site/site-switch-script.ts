import { PREFERENCE_MAX_AGE_SECONDS, PreferenceCookie, Theme } from '../page-preferences';
import { SYSTEM_COLOR_SCHEME } from '../standalone-page';
import { THEME_COLOR_METAS, WINDOW_SOURCE_MEDIA } from './site-constants';
import { SitePath } from './site-paths';

export const THEME_SOURCE_SELECTOR = '[data-theme-source]';

export const SWITCH_SCRIPT = `{
  const root = document.documentElement;
  const scheme = document.querySelector('meta[name="color-scheme"]');
  const windowSource = document.querySelector('${THEME_SOURCE_SELECTOR}');
  const themeColors = ${JSON.stringify(THEME_COLOR_METAS)};
  const sourceMedia = ${JSON.stringify(WINDOW_SOURCE_MEDIA)};
  const securePart = location.protocol === 'https:' ? '; Secure' : '';
  const applyTheme = (theme) => {
    const isSystem = theme === '${Theme.System}';
    if (isSystem) root.removeAttribute('data-theme');
    if (!isSystem) root.dataset.theme = theme;
    if (scheme) scheme.content = isSystem ? '${SYSTEM_COLOR_SCHEME}' : theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
    themeColors[theme].forEach(({ content, media }) => {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = content;
      if (media !== '') meta.media = media;
      document.head.append(meta);
    });
    if (windowSource) windowSource.media = sourceMedia[theme];
    document.cookie = '${PreferenceCookie.Theme}=' + (isSystem ? '' : theme) + '; Path=/; SameSite=Lax' + securePart + '; Max-Age=' + (isSystem ? 0 : ${PREFERENCE_MAX_AGE_SECONDS});
  };
  document.querySelectorAll('.language-menu').forEach((menu) => {
    const trigger = menu.querySelector('.language-summary');
    const syncExpanded = () => trigger.setAttribute('aria-expanded', String(menu.open));
    const close = (shouldFocus) => {
      menu.removeAttribute('open');
      syncExpanded();
      if (shouldFocus) trigger.focus();
    };
    menu.addEventListener('toggle', syncExpanded);
    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target)) close(false);
    });
    menu.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !menu.open) return;
      event.preventDefault();
      close(true);
    });
    menu.querySelector('.language-form').addEventListener('submit', () => close(false));
  });
  document.querySelectorAll('.language-form').forEach((form) => {
    form.addEventListener('submit', () => {
      form.elements['${SitePath.ReturnField}'].value = location.pathname + location.search + location.hash;
    });
  });
  document.querySelectorAll('.theme-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      const button = event.submitter;
      if (!button || button.name !== '${SitePath.ThemeField}') return;
      event.preventDefault();
      applyTheme(button.value);
      document.querySelectorAll('.theme-option').forEach((option) => option.setAttribute('aria-pressed', String(option === button)));
    });
  });
}`;
