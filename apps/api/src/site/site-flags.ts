import { Language } from '@todz/types';

const FLAG_VIEWBOX = '0 0 20 14';
const FLAG_WIDTH = 20;
const FLAG_HEIGHT = 14;
const UNITED_STATES_STRIPE_OFFSETS = [0, 4, 8, 12];
const STRIPE_HEIGHT = 2;
const CANTON_WIDTH = 9;
const CANTON_HEIGHT = 8;
const BRAZIL_DIAMOND = '10,1.5 18.5,7 10,12.5 1.5,7';
const BRAZIL_DISC_RADIUS = 3.2;
const SPAIN_BAND_OFFSET = 3.5;
const SPAIN_BAND_HEIGHT = 7;
const GERMANY_STRIPE_HEIGHT = FLAG_HEIGHT / 3;
const FRANCE_STRIPE_WIDTH = FLAG_WIDTH / 3;
const JAPAN_DISC_RADIUS = 4.2;
const KOREA_DISC_RADIUS = 3.5;
const KOREA_UPPER_HALF = 'M6.5 7a3.5 3.5 0 0 1 7 0z';
const KOREA_LOWER_HALF = 'M6.5 7a3.5 3.5 0 0 0 7 0z';
const KOREA_TRIGRAM_OFFSETS = [
  { x: 1.6, y: 1.4 },
  { x: 15.4, y: 1.4 },
  { x: 1.6, y: 11.2 },
  { x: 15.4, y: 11.2 },
];
const KOREA_TRIGRAM_WIDTH = 3;
const KOREA_TRIGRAM_HEIGHT = 1.4;
const CHINA_STAR = '4.00,1.20 4.65,3.11 6.66,3.13 5.05,4.34 5.65,6.27 4.00,5.10 2.35,6.27 2.95,4.34 1.34,3.13 3.35,3.11';
const ARABIC_MOON_CENTER = { x: 9, y: 7 };
const ARABIC_MOON_RADIUS = 4.2;
const ARABIC_BITE_CENTER_X = 10.6;
const ARABIC_BITE_RADIUS = 3.5;
const INDIA_STRIPE_HEIGHT = FLAG_HEIGHT / 3;
const INDIA_WHEEL_RADIUS = 1.8;
const INDIA_WHEEL_STROKE = 0.45;

function frameOf({ name, shapes }: { name: string; shapes: string }): string {
  return `<svg class="flag" data-flag="${name}" viewBox="${FLAG_VIEWBOX}" width="${FLAG_WIDTH}" height="${FLAG_HEIGHT}" aria-hidden="true" focusable="false">${shapes}</svg>`;
}

function rectOf({ x = 0, y = 0, width, height, fill }: { x?: number; y?: number; width: number; height: number; fill: string }): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
}

function backgroundOf(fill: string): string {
  return rectOf({ width: FLAG_WIDTH, height: FLAG_HEIGHT, fill });
}

const FLAG_OF_LANGUAGE: Record<Language, string> = {
  [Language.English]: frameOf({
    name: 'us',
    shapes: [
      backgroundOf('#ffffff'),
      ...UNITED_STATES_STRIPE_OFFSETS.map((y) => rectOf({ y, width: FLAG_WIDTH, height: STRIPE_HEIGHT, fill: '#b22234' })),
      rectOf({ width: CANTON_WIDTH, height: CANTON_HEIGHT, fill: '#3c3b6e' }),
    ].join(''),
  }),
  [Language.PortugueseBrazil]: frameOf({
    name: 'br',
    shapes: `${backgroundOf('#009b3a')}<polygon points="${BRAZIL_DIAMOND}" fill="#fedf00"/><circle cx="10" cy="7" r="${BRAZIL_DISC_RADIUS}" fill="#002776"/>`,
  }),
  [Language.Spanish]: frameOf({
    name: 'es',
    shapes: `${backgroundOf('#aa151b')}${rectOf({ y: SPAIN_BAND_OFFSET, width: FLAG_WIDTH, height: SPAIN_BAND_HEIGHT, fill: '#f1bf00' })}`,
  }),
  [Language.German]: frameOf({
    name: 'de',
    shapes: ['#000000', '#dd0000', '#ffce00']
      .map((fill, index) => rectOf({ y: GERMANY_STRIPE_HEIGHT * index, width: FLAG_WIDTH, height: GERMANY_STRIPE_HEIGHT, fill }))
      .join(''),
  }),
  [Language.French]: frameOf({
    name: 'fr',
    shapes: ['#0055a4', '#ffffff', '#ef4135']
      .map((fill, index) => rectOf({ x: FRANCE_STRIPE_WIDTH * index, width: FRANCE_STRIPE_WIDTH, height: FLAG_HEIGHT, fill }))
      .join(''),
  }),
  [Language.Japanese]: frameOf({
    name: 'jp',
    shapes: `${backgroundOf('#ffffff')}<circle cx="10" cy="7" r="${JAPAN_DISC_RADIUS}" fill="#bc002d"/>`,
  }),
  [Language.Korean]: frameOf({
    name: 'kr',
    shapes: [
      backgroundOf('#ffffff'),
      `<circle cx="10" cy="7" r="${KOREA_DISC_RADIUS}" fill="#0047a0"/>`,
      `<path d="${KOREA_UPPER_HALF}" fill="#cd2e3a"/>`,
      `<path d="${KOREA_LOWER_HALF}" fill="#0047a0"/>`,
      ...KOREA_TRIGRAM_OFFSETS.map(({ x, y }) =>
        rectOf({ x, y, width: KOREA_TRIGRAM_WIDTH, height: KOREA_TRIGRAM_HEIGHT, fill: '#000000' }),
      ),
    ].join(''),
  }),
  [Language.Chinese]: frameOf({
    name: 'cn',
    shapes: `${backgroundOf('#de2910')}<polygon points="${CHINA_STAR}" fill="#ffde00"/>`,
  }),
  [Language.Arabic]: frameOf({
    name: 'arab',
    shapes: `${backgroundOf('#007a3d')}<circle cx="${ARABIC_MOON_CENTER.x}" cy="${ARABIC_MOON_CENTER.y}" r="${ARABIC_MOON_RADIUS}" fill="#ffffff"/><circle cx="${ARABIC_BITE_CENTER_X}" cy="${ARABIC_MOON_CENTER.y}" r="${ARABIC_BITE_RADIUS}" fill="#007a3d"/>`,
  }),
  [Language.Hindi]: frameOf({
    name: 'in',
    shapes: [
      ...['#ff9933', '#ffffff', '#138808'].map((fill, index) =>
        rectOf({ y: INDIA_STRIPE_HEIGHT * index, width: FLAG_WIDTH, height: INDIA_STRIPE_HEIGHT, fill }),
      ),
      `<circle cx="10" cy="7" r="${INDIA_WHEEL_RADIUS}" fill="none" stroke="#000080" stroke-width="${INDIA_WHEEL_STROKE}"/>`,
    ].join(''),
  }),
};

export function flagHtml(language: Language): string {
  return FLAG_OF_LANGUAGE[language];
}
