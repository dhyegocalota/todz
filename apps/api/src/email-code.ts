import {
  EMAIL_CODE_LENGTH,
  EMAIL_CODE_MISSES_PER_ADDRESS_MAX,
  EMAIL_CODE_MISSES_PER_REQUEST_MAX,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_MINUTE,
  SIGN_IN_LINK_LIFETIME_MINUTES,
} from '@todz/types';
import { digestCredential, isSameSignature, keyedDigest } from './credential-digest';
import { generateCredentialSecret } from './credential-secret';

export const EMAIL_CODE_PATTERN = new RegExp(`^[0-9]{${EMAIL_CODE_LENGTH}}$`);

const CODE_SPACE = 10 ** EMAIL_CODE_LENGTH;
const RANDOM_WORD_SPACE = 2 ** 32;
const UNBIASED_WORD_LIMIT = RANDOM_WORD_SPACE - (RANDOM_WORD_SPACE % CODE_SPACE);
const ABSENT_ROW_SALT = 'absent-row';
const REQUEST_MISS_WINDOW_MS = SIGN_IN_LINK_LIFETIME_MINUTES * MILLISECONDS_PER_MINUTE;
const ADDRESS_MISS_WINDOW_MS = MILLISECONDS_PER_DAY;

export enum CodeTable {
  SignInLinks = 'sign_in_links',
  AdminSignInLinks = 'admin_sign_in_links',
}

export enum CodeVerdict {
  Spent = 'spent',
  Wrong = 'wrong',
  Locked = 'locked',
}

export type CodeOutcome =
  { verdict: CodeVerdict.Spent; email: string } | { verdict: CodeVerdict.Wrong } | { verdict: CodeVerdict.Locked; retryAfterMs: number };

export type CodeSpending = {
  directory: D1Database;
  table: CodeTable;
  email: string;
  challenge: string;
  code: string;
  now: number;
};

export type IssuedCode = { code: string; salt: string; digest: string };

type CodeRow = { digest: string; code_digest: string; code_salt: string };

type MissCounts = { address_misses: number; address_oldest: number | null; request_misses: number; request_oldest: number | null };

function randomWord(): number {
  const [word] = crypto.getRandomValues(new Uint32Array(1));
  if (word === undefined) throw new Error('the random source returned no word');
  return word;
}

function randomCodeNumber(): number {
  const word = randomWord();
  if (word >= UNBIASED_WORD_LIMIT) return randomCodeNumber();
  return word % CODE_SPACE;
}

// NB ADR 0127: the code is hashed at rest with a per-row random salt and compared through the shared timing-safe signature helper.
export async function issuedEmailCode(): Promise<IssuedCode> {
  const code = String(randomCodeNumber()).padStart(EMAIL_CODE_LENGTH, '0');
  const salt = generateCredentialSecret();
  return { code, salt, digest: await keyedDigest({ secret: salt, text: code }) };
}

async function isCodeOfRow({ row, code }: { row: CodeRow | null; code: string }): Promise<boolean> {
  if (row === null) {
    await keyedDigest({ secret: ABSENT_ROW_SALT, text: code });
    return false;
  }
  const candidate = await keyedDigest({ secret: row.code_salt, text: code });
  return isSameSignature({ secret: row.code_salt, left: candidate, right: row.code_digest });
}

async function reservedMiss({
  directory,
  addressDigest,
  challenge,
  now,
}: {
  directory: D1Database;
  addressDigest: string;
  challenge: string;
  now: number;
}): Promise<number | null> {
  await directory
    .prepare('DELETE FROM sign_in_code_misses WHERE missed_at <= ?')
    .bind(now - ADDRESS_MISS_WINDOW_MS)
    .run();
  const reservation = await directory
    .prepare(
      'INSERT INTO sign_in_code_misses (address_digest, challenge, missed_at) SELECT ?, ?, ? WHERE (SELECT count(*) FROM sign_in_code_misses WHERE address_digest = ? AND missed_at > ?) < ? AND (SELECT count(*) FROM sign_in_code_misses WHERE address_digest = ? AND challenge = ? AND missed_at > ?) < ?',
    )
    .bind(
      addressDigest,
      challenge,
      now,
      addressDigest,
      now - ADDRESS_MISS_WINDOW_MS,
      EMAIL_CODE_MISSES_PER_ADDRESS_MAX,
      addressDigest,
      challenge,
      now - REQUEST_MISS_WINDOW_MS,
      EMAIL_CODE_MISSES_PER_REQUEST_MAX,
    )
    .run();
  if (reservation.meta.changes === 0) return null;
  return reservation.meta.last_row_id;
}

async function lockOutcome({
  directory,
  table,
  email,
  addressDigest,
  challenge,
  now,
}: {
  directory: D1Database;
  table: CodeTable;
  email: string;
  addressDigest: string;
  challenge: string;
  now: number;
}): Promise<CodeOutcome> {
  const counts = await directory
    .prepare(
      'SELECT (SELECT count(*) FROM sign_in_code_misses WHERE address_digest = ? AND missed_at > ?) AS address_misses, (SELECT min(missed_at) FROM sign_in_code_misses WHERE address_digest = ? AND missed_at > ?) AS address_oldest, (SELECT count(*) FROM sign_in_code_misses WHERE address_digest = ? AND challenge = ? AND missed_at > ?) AS request_misses, (SELECT min(missed_at) FROM sign_in_code_misses WHERE address_digest = ? AND challenge = ? AND missed_at > ?) AS request_oldest',
    )
    .bind(
      addressDigest,
      now - ADDRESS_MISS_WINDOW_MS,
      addressDigest,
      now - ADDRESS_MISS_WINDOW_MS,
      addressDigest,
      challenge,
      now - REQUEST_MISS_WINDOW_MS,
      addressDigest,
      challenge,
      now - REQUEST_MISS_WINDOW_MS,
    )
    .first<MissCounts>();
  if (counts === null) throw new Error('a count always answers a row');
  const isAddressLocked = counts.address_misses >= EMAIL_CODE_MISSES_PER_ADDRESS_MAX && counts.address_oldest !== null;
  const isRequestLocked = counts.request_misses >= EMAIL_CODE_MISSES_PER_REQUEST_MAX && counts.request_oldest !== null;
  if (!isAddressLocked && !isRequestLocked) return { verdict: CodeVerdict.Wrong };
  if (isRequestLocked)
    await directory
      .prepare(`UPDATE ${table} SET consumed_at = ? WHERE email = ? AND challenge = ? AND consumed_at IS NULL`)
      .bind(now, email, challenge)
      .run();
  const addressLift = isAddressLocked && counts.address_oldest !== null ? counts.address_oldest + ADDRESS_MISS_WINDOW_MS : now;
  const requestLift = isRequestLocked && counts.request_oldest !== null ? counts.request_oldest + REQUEST_MISS_WINDOW_MS : now;
  return { verdict: CodeVerdict.Locked, retryAfterMs: Math.max(addressLift, requestLift) - now };
}

// NB ADR 0127: a guess is reserved before it is compared, in one statement that counts the misses of the request and of the address, so parallel guesses cannot outrun the lock; the counts key on the digest of the address and the request alone, so an address with no link answers exactly like one that has it.
export async function spendEmailCode({ directory, table, email, challenge, code, now }: CodeSpending): Promise<CodeOutcome> {
  const addressDigest = await digestCredential(email);
  const reservation = await reservedMiss({ directory, addressDigest, challenge, now });
  const lockArguments = { directory, table, email, addressDigest, challenge, now };
  if (reservation === null) return lockOutcome(lockArguments);
  const row = await directory
    .prepare(
      `SELECT digest, code_digest, code_salt FROM ${table} WHERE email = ? AND challenge = ? AND consumed_at IS NULL AND expires_at > ? AND code_digest IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(email, challenge, now)
    .first<CodeRow>();
  const isRightCode = await isCodeOfRow({ row, code });
  if (!isRightCode || row === null) return lockOutcome(lockArguments);
  const spent = await directory
    .prepare(`UPDATE ${table} SET consumed_at = ? WHERE digest = ? AND consumed_at IS NULL AND expires_at > ? RETURNING email`)
    .bind(now, row.digest, now)
    .first<{ email: string }>();
  if (spent === null) return lockOutcome(lockArguments);
  await directory.prepare('DELETE FROM sign_in_code_misses WHERE rowid = ?').bind(reservation).run();
  return { verdict: CodeVerdict.Spent, email: spent.email };
}
