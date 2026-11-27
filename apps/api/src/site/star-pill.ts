import { type Language, REPOSITORY } from '@todz/types';
import { escapedHtml } from '../escaped-html';
import { LANDING_COPY_BY_LANGUAGE } from './landing-copy';
import { formatStars } from './repository-stars';
import { GITHUB_MARK } from './site-glyphs';

const STAR_GLYPH = '★';

function starCountHtml(stars: number | null): string {
  if (stars === null) return '';
  return `<span class="star-glyph" aria-hidden="true">${STAR_GLYPH}</span><span class="star-count" data-stars="${stars}"><span class="star-count-final">${formatStars(stars)}</span><span class="star-count-live" aria-hidden="true"></span></span>`;
}

export function starPillHtml({ stars, language }: { stars: number | null; language: Language }): string {
  return `<a class="star-pill glass" href="${REPOSITORY.url}" rel="noopener">${GITHUB_MARK}<span class="star-label">${escapedHtml(LANDING_COPY_BY_LANGUAGE[language].openSource.starLabel)}</span>${starCountHtml(stars)}</a>`;
}
