export enum SiteGlyph {
  Icon = 'todz-icon',
  Offline = 'todz-offline',
}

export const SITE_GLYPH_SPRITE = `<svg class="glyph-sprite" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="brand-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4C6BFF"/><stop offset="1" stop-color="#1B2A9E"/></linearGradient>
<radialGradient id="brand-glow" cx="0.3" cy="0.2" r="0.8"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<filter id="brand-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#0A1150" flood-opacity="0.45"/></filter>
</defs>
<symbol id="${SiteGlyph.Icon}" viewBox="80 80 864 864">
<rect x="80" y="80" width="864" height="864" rx="196" fill="url(#brand-fill)"/>
<rect x="80" y="80" width="864" height="864" rx="196" fill="url(#brand-glow)"/>
<g filter="url(#brand-shadow)">
<path d="M300 532 L448 680 L724 404" fill="none" stroke="#FFFFFF" stroke-width="96" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M790 214 C800 268 818 286 872 296 C818 306 800 324 790 378 C780 324 762 306 708 296 C762 286 780 268 790 214 Z" fill="#8CF7D0"/>
</g>
</symbol>
<symbol id="${SiteGlyph.Offline}" viewBox="0 0 64 64">
<path d="M18 52h29c7.7 0 14-6 14-13.4 0-6.8-5.2-12.4-11.9-13.3C47.6 16.8 40.6 11 32 11c-9.2 0-16.7 6.6-18 15.2C7.8 27.4 3 32.7 3 39c0 7.2 6.7 13 15 13z" fill="url(#brand-fill)"/>
<path d="M21 34.5 L28.5 42 L43 27.5" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M53 4 C53.5 7 54.6 8.1 57.6 8.6 C54.6 9.1 53.5 10.2 53 13.2 C52.5 10.2 51.4 9.1 48.4 8.6 C51.4 8.1 52.5 7 53 4 Z" fill="#8CF7D0"/>
</symbol>
</svg>`;

export const MENU_BAR_GLYPH = `<svg class="menu-glyph" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
<path d="M8 19 L14 25 L25 13" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M28 4 C28.4 6.6 29.4 7.6 32 8 C29.4 8.4 28.4 9.4 28 12 C27.6 9.4 26.6 8.4 24 8 C26.6 7.6 27.6 6.6 28 4 Z" fill="currentColor"/>
</svg>`;

export const GITHUB_MARK = `<svg class="github-mark" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
<path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
</svg>`;

export function glyphHtml({ glyph, className }: { glyph: SiteGlyph; className: string }): string {
  return `<svg class="${className}" aria-hidden="true" focusable="false"><use href="#${glyph}"/></svg>`;
}
