import { LANDING_COPY, LANDING_COPY_BY_LANGUAGE, type LandingCopy } from './landing-copy';
import type { Language } from '@todz/types';

export function landingDayLinesOf(copy: LandingCopy): string[] {
  const { day } = copy.benefits;
  return [
    ...[day.email, day.glance, day.agent, day.close].map(({ time, title, body }) => `${time} ${title}: ${body}`),
    ...[day.extras.ribbon, day.extras.temperature, day.extras.siri].map(({ label, detail }) => `${label}: ${detail}`),
  ];
}

export function landingLockLineOf(copy: LandingCopy): string {
  return `${copy.benefits.lock.title}: ${copy.benefits.lock.body}`;
}

export function landingFeatureListOf({ language }: { language: Language }): string[] {
  const copy = LANDING_COPY_BY_LANGUAGE[language];
  return [...landingDayLinesOf(copy), landingLockLineOf(copy)];
}

export const LANDING_DAY_LINES = landingDayLinesOf(LANDING_COPY);

export const LANDING_LOCK_LINE = landingLockLineOf(LANDING_COPY);
