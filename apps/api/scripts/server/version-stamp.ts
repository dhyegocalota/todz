const COMMIT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,40}$/;
const SHORT_HASH_LENGTH = 7;
const DATE_SEPARATOR = '-';
const STAMP_DATE_SEPARATOR = '.';
const STAMP_HASH_SEPARATOR = '+';

export const STAMP_FAILURE_MESSAGE = 'Cannot stamp the server version';

export function versionStamp({ commitDate, commitHash }: { commitDate: string; commitHash: string }): string {
  if (!COMMIT_DATE_PATTERN.test(commitDate))
    throw new Error(`${STAMP_FAILURE_MESSAGE}: the commit date ${JSON.stringify(commitDate)} is not YYYY-MM-DD`);
  if (!COMMIT_HASH_PATTERN.test(commitHash))
    throw new Error(`${STAMP_FAILURE_MESSAGE}: the commit hash ${JSON.stringify(commitHash)} is not hexadecimal`);
  return `${commitDate.replaceAll(DATE_SEPARATOR, STAMP_DATE_SEPARATOR)}${STAMP_HASH_SEPARATOR}${commitHash.slice(0, SHORT_HASH_LENGTH)}`;
}
