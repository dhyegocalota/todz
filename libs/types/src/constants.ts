export const ABSENT_INDEX = -1;
export const LAST_INDEX = -1;
export const FORMATTER_LOCALE = 'en-US';
export const BYTES_PER_KIBIBYTE = 1_024;
export const BYTES_PER_MEBIBYTE = BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
export const MILLISECONDS_PER_SECOND = 1_000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MILLISECONDS_PER_MINUTE = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE;
export const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_MINUTE * MINUTES_PER_HOUR;
export const MILLISECONDS_PER_DAY = MILLISECONDS_PER_HOUR * HOURS_PER_DAY;
export const PROJECT_KEY_PREFIX = 'todz_';
export const HEALTH_SERVICE_NAME = 'todz';
export const MINIMUM_APP_VERSION = '0.2.0';
export const API_VERSION_HEADER = 'Todz-Api-Version';
export const APP_VERSION_HEADER = 'Todz-App-Version';
export const LIST_LIMIT_DEFAULT = 20;
export const SIGN_IN_RATE_LIMIT_MAX = 10;
export const SIGN_IN_RATE_LIMIT_PERIOD_SECONDS = SECONDS_PER_MINUTE;
export const SIGN_IN_ADDRESS_RATE_LIMIT_MAX = 3;
export const SIGN_IN_GLOBAL_RATE_LIMIT_MAX = 100;
export const WAITLIST_RATE_LIMIT_MAX = 10;
export const WAITLIST_RATE_LIMIT_PERIOD_SECONDS = SECONDS_PER_MINUTE;
export const WAITLIST_ADDRESS_RATE_LIMIT_MAX = 3;
export const WAITLIST_GLOBAL_RATE_LIMIT_MAX = 60;
export const WAITLIST_MINIMUM_FILL_MS = 2 * MILLISECONDS_PER_SECOND;
export const WAITLIST_FILL_MARGIN_MS = MILLISECONDS_PER_SECOND;
export const WAITLIST_FILL_HOLD_MS = WAITLIST_MINIMUM_FILL_MS + WAITLIST_FILL_MARGIN_MS;
export const WAITLIST_JOIN_TIMEOUT_MS = 15 * MILLISECONDS_PER_SECOND;
export const WAITLIST_CHECK_RETRY_MAX = 3;
export const ADMIN_RATE_LIMIT_MAX = 10;
export const ADMIN_RATE_LIMIT_PERIOD_SECONDS = SECONDS_PER_MINUTE;
export const ADMIN_ADDRESS_RATE_LIMIT_MAX = 3;
export const ADMIN_GLOBAL_RATE_LIMIT_MAX = 30;
export const OWNER_RATE_LIMIT_MAX = 600;
export const MCP_RATE_LIMIT_MAX = 3600;
export const SIGNED_IN_RATE_LIMIT_PERIOD_SECONDS = SECONDS_PER_MINUTE;
export const OWNER_WORKSPACES_MAX = 20;
export const WORKSPACE_PROJECTS_MAX = 100;
export const PROJECT_LIVE_KEYS_MAX = 10;
export const PROJECT_OPEN_TASKS_MAX = 5_000;
export const OWNER_WRITES_PER_DAY_MAX = 1_000;
export const OWNER_STORED_BYTES_MAX = 50 * BYTES_PER_MEBIBYTE;
export const SIGN_UPS_PER_CLIENT_DAY_MAX = 5;
export const WAITLIST_DAILY_JOINS_MAX = 500;
export const AGENT_NUDGE_BY_DEFAULT = true;
export const DAY_EMAIL_BY_DEFAULT = true;
export const DAY_EMAIL_MINUTES_DEFAULT = 7 * MINUTES_PER_HOUR;
export const DAY_EMAIL_MINUTES_MAX = HOURS_PER_DAY * MINUTES_PER_HOUR - 1;
export const DAY_EMAIL_CATCH_UP_MINUTES = 3 * MINUTES_PER_HOUR;
export const DAY_EMAIL_SENDS_PER_TICK_MAX = 50;
export const DAY_EMAIL_PROJECTS_PER_OWNER_MAX = 100;
export const DAY_EMAIL_LINES_MAX = 20;
export const DAY_EMAIL_RETENTION_MS = 30 * MILLISECONDS_PER_DAY;
export const DAY_EMAIL_REPLY_ADDRESS_LIFETIME_MS = 7 * MILLISECONDS_PER_DAY;
export const DAY_EMAIL_STOP_LINK_LIFETIME_MS = 30 * MILLISECONDS_PER_DAY;
export const DAY_EMAIL_STOP_TOKEN_LENGTH = 64;
export const DAY_EMAIL_STOP_RATE_LIMIT_MAX = 10;
export const DAY_EMAIL_STOP_RATE_LIMIT_PERIOD_SECONDS = SECONDS_PER_MINUTE;
export const USAGE_ADDRESS_RATE_LIMIT_MAX = 1;
export const USAGE_INSTALL_RATE_LIMIT_MAX = 1;
export const USAGE_GLOBAL_RATE_LIMIT_MAX = 60;
export const USAGE_RATE_LIMIT_PERIOD_SECONDS = SECONDS_PER_MINUTE;
export const APPCAST_RATE_LIMIT_MAX = 60;
export const APPCAST_ADDRESS_RATE_LIMIT_MAX = 1;
export const COMPANY = {
  tradeName: 'Logic Bit',
  legalName: 'Logic Bit AI Software Boutique Ltda',
  website: 'https://logicbit.com.br',
  logo: 'https://www.logicbit.com.br/favicon/apple-touch-icon.png',
} as const;
const REPOSITORY_PATH = 'dhyegocalota/todz';
const REPOSITORY_URL = `https://github.com/${REPOSITORY_PATH}`;
export const REPOSITORY = {
  path: REPOSITORY_PATH,
  url: REPOSITORY_URL,
  licenseName: 'AGPL-3.0',
  licenseUrl: `${REPOSITORY_URL}/blob/main/LICENSE`,
  licenseSpdxUrl: 'https://spdx.org/licenses/AGPL-3.0-only.html',
  contributingUrl: `${REPOSITORY_URL}/blob/main/.github/CONTRIBUTING.md`,
} as const;
export const AUTHOR = { name: 'Dhyego Calota', url: 'https://dhyegocalota.com.br' } as const;
export const REPLY_SECRET_LENGTH = 32;
export const REPLY_ADDRESS_DOMAIN = 'todz.app';
export const MAIL_SENDER_ADDRESS = `noreply@${REPLY_ADDRESS_DOMAIN}`;
export const REPLY_ADDRESS_LOCAL_PART = 'reply';
export const REPLY_SIZE_MAX_BYTES = 1024 * 1024;
export const REPLY_RATE_LIMIT_MAX = 5;
export const REPLY_RATE_LIMIT_PERIOD_SECONDS = SECONDS_PER_MINUTE;
export const REPLY_DAILY_MAX = 20;
