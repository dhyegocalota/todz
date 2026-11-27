import { PREFERENCE_MAX_AGE_SECONDS, PreferenceCookie, Theme } from '../page-preferences';
import { SitePath } from './site-paths';

export const SWITCH_SCRIPT = `{
  const root = document.documentElement;
  const scheme = document.querySelector('meta[name="color-scheme"]');
  const securePart = location.protocol === 'https:' ? '; Secure' : '';
  document.querySelectorAll('.theme-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      const button = event.submitter;
      if (!button || button.name !== '${SitePath.ThemeField}') return;
      event.preventDefault();
      const theme = button.value;
      const isSystem = theme === '${Theme.System}';
      if (isSystem) root.removeAttribute('data-theme');
      else root.dataset.theme = theme;
      if (scheme) scheme.content = isSystem ? 'light dark' : theme;
      document.cookie = '${PreferenceCookie.Theme}=' + (isSystem ? '' : theme) + '; Path=/; SameSite=Lax' + securePart + '; Max-Age=' + (isSystem ? 0 : ${PREFERENCE_MAX_AGE_SECONDS});
      document.querySelectorAll('.theme-option').forEach((option) => option.setAttribute('aria-pressed', String(option === button)));
    });
  });
}`;
