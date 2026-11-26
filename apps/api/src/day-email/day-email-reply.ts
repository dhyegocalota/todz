import { OWNER_ACTOR } from '@todz/core';
import { FairUseLimit, REPLY_SIZE_MAX_BYTES } from '@todz/types';
import PostalMime from 'postal-mime';
import type { Email } from 'postal-mime';
import { digestCredential } from '../credential-digest';
import type { Env } from '../env';
import { limitRefusal } from '../limit-refusal';
import { fairUseLimitsOf } from '../fair-use-limits';
import { calendarDateInTimeZone } from '../owner-today';
import { reserveWrites, textBytesOf } from '../owner-write-quota';
import { openReplyInbox, replyOwnerOf } from '../project-routing';
import { DayEmailEvent, logDayEmailEvent } from './day-email-log';
import { ReplyClaim, claimReply, findOwnerEmailIdentities, findReplyAddressOwner } from './day-email-store';
import { AddressingVerdict, addressingOf } from './reply-addressing';
import { isAutomaticReply } from './reply-automatic';
import { AuthenticationVerdict, authenticationOf } from './reply-authentication';
import { replySecretOf } from './reply-recipient';
import { SenderVerdict, senderOf } from './reply-sender';
import { TitleOutcome, replyTitleOf } from './reply-title';

const MAIL_KEY_PREFIX = 'mail:';
const FAILURE_MESSAGE = 'the day email reply failed';

export enum ReplyOutcome {
  Added = 'added',
  Duplicate = 'duplicate',
  UnknownRecipient = 'unknown_recipient',
  Limited = 'limited',
  TooLarge = 'too_large',
  Unparseable = 'unparseable',
  Automatic = 'automatic',
  Unauthenticated = 'unauthenticated',
  NotOwner = 'not_owner',
  NotAReply = 'not_a_reply',
  NoMessageId = 'no_message_id',
  DailyCap = 'daily_cap',
  WriteRefused = 'write_refused',
  Empty = 'empty',
  InvalidTitle = 'invalid_title',
  NoInbox = 'no_inbox',
  Failed = 'failed',
}

const OUTCOME_OF_ADDRESSING_REFUSAL: Record<Exclude<AddressingVerdict, AddressingVerdict.Addressed>, ReplyOutcome> = {
  [AddressingVerdict.NotAReply]: ReplyOutcome.NotAReply,
  [AddressingVerdict.NoMessageId]: ReplyOutcome.NoMessageId,
};

const OUTCOME_OF_TITLE_REFUSAL: Record<Exclude<TitleOutcome, TitleOutcome.Titled>, ReplyOutcome> = {
  [TitleOutcome.Empty]: ReplyOutcome.Empty,
  [TitleOutcome.InvalidTitle]: ReplyOutcome.InvalidTitle,
};

type ReplyResult = { outcome: ReplyOutcome } | { outcome: ReplyOutcome.Unauthenticated; verdict: AuthenticationVerdict };

type Admission<Value> = { isAdmitted: true; value: Value } | { isAdmitted: false; result: ReplyResult };

type Reply = { message: ForwardableEmailMessage; env: Env; now: number };

type ParsedReply = { email: Email; domain: string };

type Sender = { timeZone: string };

function admitted<Value>(value: Value): Admission<Value> {
  return { isAdmitted: true, value };
}

function refused(outcome: ReplyOutcome): Admission<never> {
  return { isAdmitted: false, result: { outcome } };
}

async function admitRecipient({ message, env, now }: Reply): Promise<Admission<string>> {
  const secret = replySecretOf(message.to);
  if (secret === null) return refused(ReplyOutcome.UnknownRecipient);
  const ownerId = await findReplyAddressOwner({ directory: env.DIRECTORY, digest: await digestCredential(secret), now });
  if (ownerId === null) return refused(ReplyOutcome.UnknownRecipient);
  const limitation = await limitRefusal({ limiter: env.DAY_EMAIL_REPLY_LIMITER, key: ownerId });
  if (limitation !== null) return refused(ReplyOutcome.Limited);
  return admitted(ownerId);
}

async function parsedEmailOf(message: ForwardableEmailMessage): Promise<Email | null> {
  try {
    return await PostalMime.parse(message.raw);
  } catch {
    return null;
  }
}

async function admitContent(message: ForwardableEmailMessage): Promise<Admission<ParsedReply>> {
  if (message.rawSize > REPLY_SIZE_MAX_BYTES) return refused(ReplyOutcome.TooLarge);
  const email = await parsedEmailOf(message);
  if (email === null) return refused(ReplyOutcome.Unparseable);
  if (isAutomaticReply(email.headers)) return refused(ReplyOutcome.Automatic);
  const authentication = authenticationOf(email.headers);
  if (authentication.verdict !== AuthenticationVerdict.Passed) {
    return { isAdmitted: false, result: { outcome: ReplyOutcome.Unauthenticated, verdict: authentication.verdict } };
  }
  return admitted({ email, domain: authentication.domain });
}

async function admitSender({
  env,
  ownerId,
  parsed,
  runtimeFrom,
}: {
  env: Env;
  ownerId: string;
  parsed: ParsedReply;
  runtimeFrom: string | null;
}): Promise<Admission<Sender>> {
  const [identity, ...otherIdentities] = await findOwnerEmailIdentities({ directory: env.DIRECTORY, ownerId });
  if (identity === undefined || otherIdentities.length > 0) return refused(ReplyOutcome.NotOwner);
  const sender = senderOf({ headers: parsed.email.headers, domain: parsed.domain, runtimeFrom });
  const isOwnerSender = sender.verdict === SenderVerdict.Accepted && sender.address === identity.subject;
  if (!isOwnerSender) return refused(ReplyOutcome.NotOwner);
  return admitted({ timeZone: identity.time_zone });
}

function admitAddressing({ parsed, recipient }: { parsed: ParsedReply; recipient: string }): Admission<string> {
  const addressing = addressingOf({ headers: parsed.email.headers, recipient, domain: parsed.domain });
  if (addressing.verdict === AddressingVerdict.Addressed) return admitted(addressing.messageId);
  return refused(OUTCOME_OF_ADDRESSING_REFUSAL[addressing.verdict]);
}

function admitTitle(email: Email): Admission<string> {
  const reply = replyTitleOf(email.text);
  if (reply.outcome === TitleOutcome.Titled) return admitted(reply.title);
  return refused(OUTCOME_OF_TITLE_REFUSAL[reply.outcome]);
}

async function addReplyTask({
  env,
  now,
  ownerId,
  timeZone,
  messageId,
  title,
}: {
  env: Env;
  now: number;
  ownerId: string;
  timeZone: string;
  messageId: string;
  title: string;
}): Promise<ReplyResult> {
  const inbox = await openReplyInbox({ env, owner: replyOwnerOf(ownerId) });
  if (inbox === null) return { outcome: ReplyOutcome.NoInbox };
  const writeRefusal = await reserveWrites({ env, ownerId, now, writes: 1, bytes: textBytesOf([title]) });
  if (writeRefusal !== null) return { outcome: ReplyOutcome.WriteRefused };
  const messageDigest = await digestCredential(messageId);
  const claim = await claimReply({ directory: env.DIRECTORY, ownerId, messageDigest, now });
  if (claim === ReplyClaim.DailyMaximum) return { outcome: ReplyOutcome.DailyCap };
  const dueDate = calendarDateInTimeZone({ timeZone, now });
  const result = await inbox.addTasks({
    actor: OWNER_ACTOR,
    drafts: [{ title, notes: null, dueDate, idempotencyKey: `${MAIL_KEY_PREFIX}${messageDigest}` }],
    openTasksMax: fairUseLimitsOf(env)[FairUseLimit.OpenTasks],
  });
  if (!result.ok) throw new Error(FAILURE_MESSAGE);
  const isReplay = result.value.every(({ replayed }) => replayed);
  if (isReplay) return { outcome: ReplyOutcome.Duplicate };
  return { outcome: ReplyOutcome.Added };
}

// NB ADR 0064: every check fails closed and silent, in the order of the decision's section 3.
async function resultOf(reply: Reply): Promise<ReplyResult> {
  const { message, env, now } = reply;
  const recipient = await admitRecipient(reply);
  if (!recipient.isAdmitted) return recipient.result;
  const ownerId = recipient.value;
  const content = await admitContent(message);
  if (!content.isAdmitted) return content.result;
  const parsed = content.value;
  const sender = await admitSender({ env, ownerId, parsed, runtimeFrom: message.headers.get('from') });
  if (!sender.isAdmitted) return sender.result;
  const messageId = admitAddressing({ parsed, recipient: message.to });
  if (!messageId.isAdmitted) return messageId.result;
  const title = admitTitle(parsed.email);
  if (!title.isAdmitted) return title.result;
  return addReplyTask({ env, now, ownerId, timeZone: sender.value.timeZone, messageId: messageId.value, title: title.value });
}

export async function handleReply(reply: Reply): Promise<void> {
  try {
    logDayEmailEvent({ event: DayEmailEvent.Reply, ...(await resultOf(reply)) });
  } catch {
    logDayEmailEvent({ event: DayEmailEvent.Reply, outcome: ReplyOutcome.Failed });
    throw new Error(FAILURE_MESSAGE);
  }
}
