export const ABSENT_INDEX = -1;
export const LAST_INDEX = -1;
export const FORMATTER_LOCALE = 'en-US';
export const MILLISECONDS_PER_SECOND = 1_000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MILLISECONDS_PER_MINUTE = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE;
export const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_MINUTE * MINUTES_PER_HOUR;
export const MILLISECONDS_PER_DAY = MILLISECONDS_PER_HOUR * HOURS_PER_DAY;
export const PROJECT_KEY_PREFIX = 'todz_';
export const HEALTH_SERVICE_NAME = 'todz';
export const LIST_LIMIT_DEFAULT = 20;
export const SIGN_IN_RATE_LIMIT_MAX = 10;
export const SIGN_IN_RATE_LIMIT_PERIOD_SECONDS = SECONDS_PER_MINUTE;
export const SIGN_IN_ADDRESS_RATE_LIMIT_MAX = 3;
export const SIGN_IN_GLOBAL_RATE_LIMIT_MAX = 100;
export const WAITLIST_RATE_LIMIT_MAX = 10;
export const WAITLIST_RATE_LIMIT_PERIOD_SECONDS = SECONDS_PER_MINUTE;
export const WAITLIST_ADDRESS_RATE_LIMIT_MAX = 3;
export const WAITLIST_GLOBAL_RATE_LIMIT_MAX = 60;
export const ADMIN_RATE_LIMIT_MAX = 10;
export const ADMIN_RATE_LIMIT_PERIOD_SECONDS = SECONDS_PER_MINUTE;
export const ADMIN_ADDRESS_RATE_LIMIT_MAX = 3;
export const ADMIN_GLOBAL_RATE_LIMIT_MAX = 30;
export const DAY_EMAIL_MINUTES_DEFAULT = 7 * MINUTES_PER_HOUR;
export const DAY_EMAIL_MINUTES_MAX = HOURS_PER_DAY * MINUTES_PER_HOUR - 1;
export const DAY_EMAIL_CATCH_UP_MINUTES = 3 * MINUTES_PER_HOUR;
export const DAY_EMAIL_SENDS_PER_TICK_MAX = 50;
export const DAY_EMAIL_PROJECTS_PER_OWNER_MAX = 100;
export const DAY_EMAIL_LINES_MAX = 20;
export const DAY_EMAIL_RETENTION_MS = 30 * MILLISECONDS_PER_DAY;
export const DAY_EMAIL_REPLY_ADDRESS_LIFETIME_MS = 7 * MILLISECONDS_PER_DAY;
export const COMPANY = {
  tradeName: 'Logic Bit',
  legalName: 'Logic Bit AI Software Boutique Ltda',
  website: 'https://logicbit.com.br',
  logo: 'https://www.logicbit.com.br/favicon/apple-touch-icon.png',
} as const;
export const REPLY_SECRET_LENGTH = 32;
export const REPLY_ADDRESS_DOMAIN = 'todz.app';
export const REPLY_ATTRIBUTION_ADDRESS = 'noreply@todz.app';
export const REPLY_ADDRESS_LOCAL_PART = 'reply';
export const REPLY_SIZE_MAX_BYTES = 1024 * 1024;
export const REPLY_RATE_LIMIT_MAX = 5;
export const REPLY_RATE_LIMIT_PERIOD_SECONDS = SECONDS_PER_MINUTE;
export const REPLY_DAILY_MAX = 20;
