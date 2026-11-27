import { Language } from '@todz/types';
import { describe, expect, test } from 'vitest';
import { SIGN_IN_EMAIL as SIGN_IN_EMAILS } from '../../src/emails/generated/email-templates';

const SIGN_IN_EMAIL = SIGN_IN_EMAILS[Language.English];

const MINIMUM_CONTRAST = 4.5;
const BRAND_COLOR = '#4764F5';
const WHITE = '#FFFFFF';
const HEX_COLOR = '#[0-9A-Fa-f]{6}';
const BUTTON_PATTERN = /<a [^>]*class="email-button"[^>]*style="([^"]*)"/;
const LINK_PATTERN = /<a [^>]*class="email-link"[^>]*style="([^"]*)"/;
const BUTTON_BACKGROUND_PATTERN = new RegExp(`(?:^|;)background-color:(${HEX_COLOR})`);
const BUTTON_GRADIENT_PATTERN = /linear-gradient\(([^)]*)\)/;
const LINK_COLOR_PATTERN = new RegExp(`(?:^|;)color:(${HEX_COLOR})`);
const DARK_LINK_PATTERN = new RegExp(`\\.email-link \\{ color: (${HEX_COLOR}) !important; \\}`);
const DARK_CARD_PATTERN = new RegExp(`\\.email-card \\{ background-color: (${HEX_COLOR}) !important;`);
const COLOR_GROUP = 1;
const CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const LINEAR_THRESHOLD = 0.03928;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA_EXPONENT = 2.4;
const CHANNELS = [
  { offset: 1, weight: 0.2126 },
  { offset: 3, weight: 0.7152 },
  { offset: 5, weight: 0.0722 },
];
const LUMINANCE_OFFSET = 0.05;

function captured({ pattern, text }: { pattern: RegExp; text: string }): string {
  const value = pattern.exec(text)?.[COLOR_GROUP];
  if (value === undefined) throw new Error(`the sign-in mail has no ${pattern}`);
  return value;
}

function channelOf({ color, offset }: { color: string; offset: number }): number {
  const value = Number.parseInt(color.slice(offset, offset + 2), HEX_RADIX) / CHANNEL_MAX;
  if (value <= LINEAR_THRESHOLD) return value / LINEAR_DIVISOR;
  return ((value + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA_EXPONENT;
}

function luminanceOf(color: string): number {
  return CHANNELS.reduce((sum, { offset, weight }) => sum + weight * channelOf({ color, offset }), 0);
}

function contrastOf({ foreground, background }: { foreground: string; background: string }): number {
  const lighter = Math.max(luminanceOf(foreground), luminanceOf(background));
  const darker = Math.min(luminanceOf(foreground), luminanceOf(background));
  return (lighter + LUMINANCE_OFFSET) / (darker + LUMINANCE_OFFSET);
}

function buttonStyle(): string {
  return captured({ pattern: BUTTON_PATTERN, text: SIGN_IN_EMAIL.html });
}

function gradientStops(): string[] {
  const gradient = captured({ pattern: BUTTON_GRADIENT_PATTERN, text: buttonStyle() });
  return [...gradient.matchAll(new RegExp(HEX_COLOR, 'g'))].map(([stop]) => stop);
}

describe('the sign-in mail contrast', () => {
  test('white on the button background is at least 4.5', () => {
    const background = captured({ pattern: BUTTON_BACKGROUND_PATTERN, text: buttonStyle() });
    expect(contrastOf({ foreground: WHITE, background })).toBeGreaterThanOrEqual(MINIMUM_CONTRAST);
  });

  test('white on every stop of the button gradient is at least 4.5', () => {
    const stops = gradientStops();
    expect(stops).toHaveLength(2);
    stops.forEach((background) => expect(contrastOf({ foreground: WHITE, background })).toBeGreaterThanOrEqual(MINIMUM_CONTRAST));
  });

  test('the light link colour on the white card is at least 4.5', () => {
    const foreground = captured({ pattern: LINK_COLOR_PATTERN, text: captured({ pattern: LINK_PATTERN, text: SIGN_IN_EMAIL.html }) });
    expect(contrastOf({ foreground, background: WHITE })).toBeGreaterThanOrEqual(MINIMUM_CONTRAST);
  });

  test('the dark link colour on the dark card is at least 4.5', () => {
    const foreground = captured({ pattern: DARK_LINK_PATTERN, text: SIGN_IN_EMAIL.html });
    const background = captured({ pattern: DARK_CARD_PATTERN, text: SIGN_IN_EMAIL.html });
    expect(contrastOf({ foreground, background })).toBeGreaterThanOrEqual(MINIMUM_CONTRAST);
  });

  test('the button background, the first gradient stop and the link colour are the brand colour', () => {
    const [firstStop] = gradientStops();
    expect(captured({ pattern: BUTTON_BACKGROUND_PATTERN, text: buttonStyle() })).toBe(BRAND_COLOR);
    expect(firstStop).toBe(BRAND_COLOR);
    expect(captured({ pattern: LINK_COLOR_PATTERN, text: captured({ pattern: LINK_PATTERN, text: SIGN_IN_EMAIL.html }) })).toBe(
      BRAND_COLOR,
    );
  });
});
