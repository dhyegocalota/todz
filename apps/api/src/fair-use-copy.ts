import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE, FORMATTER_LOCALE, FairUseLimit } from '@todz/types';

const SIZE_FORMAT = new Intl.NumberFormat(FORMATTER_LOCALE, { maximumFractionDigits: 1 });

function sizeLabelOf(bytes: number): string {
  if (bytes < BYTES_PER_MEBIBYTE) return `${SIZE_FORMAT.format(bytes / BYTES_PER_KIBIBYTE)} KB`;
  return `${SIZE_FORMAT.format(bytes / BYTES_PER_MEBIBYTE)} MB`;
}

const LIMIT_MESSAGE_OF: Record<FairUseLimit, (max: number) => string> = {
  [FairUseLimit.Workspaces]: (max) => `You have reached the limit of ${max} workspaces.`,
  [FairUseLimit.Projects]: (max) => `A workspace holds at most ${max} projects.`,
  [FairUseLimit.OpenTasks]: (max) => `A project holds at most ${max} open tasks. Complete some to add more.`,
  [FairUseLimit.LiveKeys]: (max) => `A project holds at most ${max} agent keys. Revoke one to issue another.`,
  [FairUseLimit.DailyWrites]: (max) => `You have reached the limit of ${max} task changes today. Changes resume at midnight UTC.`,
  [FairUseLimit.StoredBytes]: (max) => `You have reached the storage limit of ${sizeLabelOf(max)} of task text. Reading still works.`,
  [FairUseLimit.DailySignUps]: () => 'Too many new accounts from this network today. Try again tomorrow.',
};

export const FAIR_USE_COPY = {
  suspended: 'This account is suspended. It can read its tasks but cannot change them or use agents until it is restored.',
  signUpRefused: 'This email provider is not accepted for new accounts. Use another address.',
  limitMessageOf({ limit, max }: { limit: FairUseLimit; max: number }): string {
    return LIMIT_MESSAGE_OF[limit](max);
  },
};
