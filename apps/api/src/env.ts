import type { ProjectStore } from './project-store';

export type Env = {
  ASSETS?: Fetcher;
  DIRECTORY: D1Database;
  PROJECT_STORE: DurableObjectNamespace<ProjectStore>;
  SIGN_IN_PROVIDER?: string;
  EMAIL?: SendEmail;
  EMAIL_SENDER?: string;
  PUBLIC_ORIGIN?: string;
  SITE_ORIGIN?: string;
  SIGN_IN_LIMITER?: RateLimit;
  SIGN_IN_ADDRESS_LIMITER?: RateLimit;
  SIGN_IN_GLOBAL_LIMITER?: RateLimit;
  WAITLIST_LIMITER?: RateLimit;
  WAITLIST_ADDRESS_LIMITER?: RateLimit;
  WAITLIST_GLOBAL_LIMITER?: RateLimit;
  ADMIN_EMAIL?: string;
  ADMIN_LIMITER?: RateLimit;
  ADMIN_ADDRESS_LIMITER?: RateLimit;
  ADMIN_GLOBAL_LIMITER?: RateLimit;
  DAY_EMAIL_REPLY_LIMITER?: RateLimit;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};
