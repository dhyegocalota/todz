import { describe, expect, test } from 'vitest';
import {
  ABSENT_INDEX,
  COMPANY,
  FORMATTER_LOCALE,
  HEALTH_SERVICE_NAME,
  HOURS_PER_DAY,
  LAST_INDEX,
  LIST_LIMIT_DEFAULT,
  LIST_LIMIT_MAX,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_HOUR,
  MILLISECONDS_PER_MINUTE,
  MILLISECONDS_PER_SECOND,
  PROJECT_KEY_PREFIX,
} from './index';

const MILLISECONDS_IN_A_DAY = 86_400_000;
const MILLISECONDS_IN_AN_HOUR = 3_600_000;
const MILLISECONDS_IN_A_MINUTE = 60_000;
const DEFAULT_LIST_SIZE = 20;

describe('index constants', () => {
  test('an absent index and the last index are both -1 (pin)', () => {
    expect(ABSENT_INDEX).toBe(-1);
    expect(LAST_INDEX).toBe(-1);
  });
});

describe('formatting constants', () => {
  test('dates and zones are formatted in en-US (pin)', () => {
    expect(FORMATTER_LOCALE).toBe('en-US');
  });
});

describe('time constants', () => {
  test('a minute is sixty seconds in milliseconds', () => {
    expect(MILLISECONDS_PER_MINUTE).toBe(MILLISECONDS_IN_A_MINUTE);
  });

  test('an hour is sixty minutes in milliseconds', () => {
    expect(MILLISECONDS_PER_HOUR).toBe(MILLISECONDS_IN_AN_HOUR);
  });

  test('a day is twenty-four hours in milliseconds', () => {
    expect(MILLISECONDS_PER_DAY).toBe(MILLISECONDS_IN_A_DAY);
    expect(MILLISECONDS_PER_DAY).toBe(HOURS_PER_DAY * MILLISECONDS_PER_HOUR);
  });

  test('every unit is a whole number of the one below', () => {
    expect(MILLISECONDS_PER_MINUTE % MILLISECONDS_PER_SECOND).toBe(0);
    expect(MILLISECONDS_PER_HOUR % MILLISECONDS_PER_MINUTE).toBe(0);
    expect(MILLISECONDS_PER_DAY % MILLISECONDS_PER_HOUR).toBe(0);
  });
});

describe('company constants', () => {
  test('the company is Logic Bit with its legal name, website and logo, and nothing else', () => {
    expect(COMPANY).toEqual({
      tradeName: 'Logic Bit',
      legalName: 'Logic Bit AI Software Boutique Ltda',
      website: 'https://logicbit.com.br',
      logo: 'https://www.logicbit.com.br/favicon/apple-touch-icon.png',
    });
  });
});

describe('health constants', () => {
  test('a todz server names itself todz, the name the app checks (pin)', () => {
    expect(HEALTH_SERVICE_NAME).toBe('todz');
  });
});

describe('mcp constants', () => {
  test('a project key starts with todz_ (pin)', () => {
    expect(PROJECT_KEY_PREFIX).toBe('todz_');
  });

  test('a list shows twenty tasks by default, within the list limit (pin)', () => {
    expect(LIST_LIMIT_DEFAULT).toBe(DEFAULT_LIST_SIZE);
    expect(LIST_LIMIT_DEFAULT).toBeLessThanOrEqual(LIST_LIMIT_MAX);
  });
});
