import { describe, expect, test } from 'vitest';
import {
  ABSENT_INDEX,
  AGENT_NUDGE_BY_DEFAULT,
  API_VERSION_HEADER,
  APP_VERSION_HEADER,
  COMPANY,
  DAY_EMAIL_BY_DEFAULT,
  DAY_EMAIL_CATCH_UP_MINUTES,
  DAY_EMAIL_LINES_MAX,
  DAY_EMAIL_MINUTES_DEFAULT,
  DAY_EMAIL_MINUTES_MAX,
  DAY_EMAIL_PROJECTS_PER_OWNER_MAX,
  DAY_EMAIL_REPLY_ADDRESS_LIFETIME_MS,
  DAY_EMAIL_RETENTION_MS,
  DAY_EMAIL_SENDS_PER_TICK_MAX,
  DAY_EMAIL_STOP_LINK_LIFETIME_MS,
  DAY_EMAIL_STOP_RATE_LIMIT_MAX,
  DAY_EMAIL_STOP_RATE_LIMIT_PERIOD_SECONDS,
  DAY_EMAIL_STOP_TOKEN_LENGTH,
  APPCAST_RATE_LIMIT_MAX,
  USAGE_ADDRESS_RATE_LIMIT_MAX,
  USAGE_GLOBAL_RATE_LIMIT_MAX,
  USAGE_INSTALL_RATE_LIMIT_MAX,
  USAGE_RATE_LIMIT_PERIOD_SECONDS,
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
  MINIMUM_APP_VERSION,
  PROJECT_KEY_PREFIX,
  REPLY_ADDRESS_LOCAL_PART,
  REPLY_DAILY_MAX,
  REPLY_RATE_LIMIT_MAX,
  REPLY_RATE_LIMIT_PERIOD_SECONDS,
  REPLY_SIZE_MAX_BYTES,
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

describe('version constants', () => {
  test('the oldest app the server accepts is 0.2.0 (pin)', () => {
    expect(MINIMUM_APP_VERSION).toBe('0.2.0');
  });

  test('the server and the app name their versions in these headers (pin)', () => {
    expect(API_VERSION_HEADER).toBe('Todz-Api-Version');
    expect(APP_VERSION_HEADER).toBe('Todz-App-Version');
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

describe('day email constants', () => {
  test('a new owner starts with the agent nudge and the day email on (pin)', () => {
    expect(AGENT_NUDGE_BY_DEFAULT).toBe(true);
    expect(DAY_EMAIL_BY_DEFAULT).toBe(true);
  });

  test('the mail defaults to 07:00 and the minute of the day ends at 23:59 (pin)', () => {
    expect(DAY_EMAIL_MINUTES_DEFAULT).toBe(420);
    expect(DAY_EMAIL_MINUTES_MAX).toBe(1439);
  });

  test('a missed tick is caught up for three hours (pin)', () => {
    expect(DAY_EMAIL_CATCH_UP_MINUTES).toBe(180);
  });

  test('a tick sends at most fifty mails, reads at most a hundred projects per owner and lists at most twenty lines (pin)', () => {
    expect(DAY_EMAIL_SENDS_PER_TICK_MAX).toBe(50);
    expect(DAY_EMAIL_PROJECTS_PER_OWNER_MAX).toBe(100);
    expect(DAY_EMAIL_LINES_MAX).toBe(20);
  });

  test('records are kept thirty days and a reply address lives seven (pin)', () => {
    expect(DAY_EMAIL_RETENTION_MS).toBe(30 * MILLISECONDS_IN_A_DAY);
    expect(DAY_EMAIL_REPLY_ADDRESS_LIFETIME_MS).toBe(7 * MILLISECONDS_IN_A_DAY);
  });

  test('a stop link lives thirty days and its token is sixty-four hexadecimal characters (pin)', () => {
    expect(DAY_EMAIL_STOP_LINK_LIFETIME_MS).toBe(30 * MILLISECONDS_IN_A_DAY);
    expect(DAY_EMAIL_STOP_TOKEN_LENGTH).toBe(64);
  });

  test('the stop link answers ten requests a minute to one client (pin)', () => {
    expect(DAY_EMAIL_STOP_RATE_LIMIT_MAX).toBe(10);
    expect(DAY_EMAIL_STOP_RATE_LIMIT_PERIOD_SECONDS).toBe(60);
  });

  test('the usage report answers three a minute to one client, one to one install and sixty to the world, and the appcast counts six hundred a minute (pin)', () => {
    expect(USAGE_ADDRESS_RATE_LIMIT_MAX).toBe(3);
    expect(USAGE_INSTALL_RATE_LIMIT_MAX).toBe(1);
    expect(USAGE_GLOBAL_RATE_LIMIT_MAX).toBe(60);
    expect(USAGE_RATE_LIMIT_PERIOD_SECONDS).toBe(60);
    expect(APPCAST_RATE_LIMIT_MAX).toBe(600);
  });

  test('a reply comes to the reply local part, is at most a mebibyte, and an owner adds at most five a minute and twenty a day (pin)', () => {
    expect(REPLY_ADDRESS_LOCAL_PART).toBe('reply');
    expect(REPLY_SIZE_MAX_BYTES).toBe(1_048_576);
    expect(REPLY_RATE_LIMIT_MAX).toBe(5);
    expect(REPLY_RATE_LIMIT_PERIOD_SECONDS).toBe(60);
    expect(REPLY_DAILY_MAX).toBe(20);
  });
});
