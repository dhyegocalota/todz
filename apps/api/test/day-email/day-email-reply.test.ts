import { OWNER_ACTOR } from '@todz/core';
import { DAY_EMAIL_RETENTION_MS, REPLY_DAILY_MAX, REPLY_SIZE_MAX_BYTES } from '@todz/types';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { digestCredential } from '../../src/credential-digest';
import { ReplyOutcome } from '../../src/day-email/day-email-reply';
import { issueReplyAddress } from '../../src/day-email/day-email-reply-address';
import { AuthenticationVerdict } from '../../src/day-email/reply-authentication';
import { calendarDateInTimeZone } from '../../src/owner-today';
import { seedEmailIdentity } from '../directory-seed';
import { consoleOutput, freshAddress, recordingBinding, recordingLimiter } from '../email-sign-in-client';
import { resetDayEmails, seedDayOwner } from './day-email-client';
import {
  REPLY_SUBJECT,
  REPLY_TITLE,
  type ReplyContext,
  type ReplyDelivery,
  authenticationResultsOf,
  deliverReply,
  inboxTasks,
  ownerReplyOf,
  projectStoreFailingFirstAdd,
  replyHeadersOf,
  replyLogLines,
  replyMessageOf,
  replyRows,
  seedReplyContext,
  seedWorkspacelessContext,
  uniqueMessageId,
} from './reply-client';

const PAST_THE_ADDRESS_LIFETIME_MS = 8 * 86_400_000;
const STRANGER_MESSAGE_COUNT = 100;
const STRANGER_DOMAIN = 'evil.test';
const FAILING_STORE_MESSAGE = 'the project is down';
const QUOTE_ONLY_BODY = 'On Wed, Nov 25, 2026 at 7:00 AM todz <noreply@todz.app> wrote:\r\n> Today';

type Refusal = {
  name: string;
  outcome: ReplyOutcome;
  verdict?: AuthenticationVerdict;
  prepare?: (context: ReplyContext) => Promise<void>;
  delivery: (context: ReplyContext) => ReplyDelivery;
  settings?: () => Parameters<typeof deliverReply>[0]['settings'];
};

function todayOfOwner(): string {
  return calendarDateInTimeZone({ timeZone: 'UTC', now: Date.now() });
}

async function insertRepliesToday({ ownerId, count }: { ownerId: string; count: number }): Promise<void> {
  await env.DIRECTORY.batch(
    Array.from({ length: count }, (_unused, index) =>
      env.DIRECTORY.prepare('INSERT INTO day_email_replies (owner_id, message_digest, accepted_at) VALUES (?, ?, ?)').bind(
        ownerId,
        String(index).padStart(64, '0'),
        Date.now(),
      ),
    ),
  );
}

const REFUSALS: Refusal[] = [
  {
    name: 'a recipient that is not a reply address',
    outcome: ReplyOutcome.UnknownRecipient,
    delivery: (context) =>
      replyMessageOf({
        to: 'hello@todz.app',
        headers: replyHeadersOf({ address: context.owner.address, replyAddress: context.replyAddress }),
      }),
  },
  {
    name: 'a reply address nobody was issued',
    outcome: ReplyOutcome.UnknownRecipient,
    delivery: (context) =>
      replyMessageOf({
        to: `reply+${'a'.repeat(32)}@todz.app`,
        headers: replyHeadersOf({ address: context.owner.address, replyAddress: context.replyAddress }),
      }),
  },
  {
    name: 'a limiter that refuses the owner',
    outcome: ReplyOutcome.Limited,
    delivery: (context) => ownerReplyOf({ context }),
    settings: () => ({ DAY_EMAIL_REPLY_LIMITER: recordingLimiter({ isAllowed: false }).limiter }),
  },
  {
    name: 'a limiter that is not bound',
    outcome: ReplyOutcome.Limited,
    delivery: (context) => ownerReplyOf({ context }),
    settings: () => ({ DAY_EMAIL_REPLY_LIMITER: undefined }),
  },
  {
    name: 'a message over the size cap',
    outcome: ReplyOutcome.TooLarge,
    delivery: (context) =>
      replyMessageOf({
        to: context.replyAddress,
        headers: replyHeadersOf({ address: context.owner.address, replyAddress: context.replyAddress }),
        rawSize: REPLY_SIZE_MAX_BYTES + 1,
      }),
  },
  {
    name: 'a message whose body cannot be read',
    outcome: ReplyOutcome.Unparseable,
    delivery: (context) =>
      replyMessageOf({
        to: context.replyAddress,
        headers: [],
        raw: new ReadableStream({
          start(controller) {
            controller.error(new Error('the stream broke'));
          },
        }),
      }),
  },
  {
    name: 'an auto-reply',
    outcome: ReplyOutcome.Automatic,
    delivery: (context) => ownerReplyOf({ context, extras: ['Auto-Submitted: auto-replied'] }),
  },
  {
    name: 'a message without the Cloudflare verdict',
    outcome: ReplyOutcome.Unauthenticated,
    verdict: AuthenticationVerdict.MissingServiceHeader,
    delivery: (context) => ownerReplyOf({ context, overrides: { 'Authentication-Results': null } }),
  },
  {
    name: 'a message whose DMARC failed',
    outcome: ReplyOutcome.Unauthenticated,
    verdict: AuthenticationVerdict.DmarcNotPassed,
    delivery: (context) =>
      ownerReplyOf({
        context,
        overrides: { 'Authentication-Results': 'mx.cloudflare.net; dkim=pass header.d=example.com; dmarc=fail header.from=example.com' },
      }),
  },
  {
    name: 'a DKIM pass after the DMARC result in the Cloudflare header',
    outcome: ReplyOutcome.Unauthenticated,
    verdict: AuthenticationVerdict.ResultsAfterDmarc,
    delivery: (context) =>
      ownerReplyOf({
        context,
        overrides: { 'Authentication-Results': 'mx.cloudflare.net; dmarc=pass header.from=example.com; dkim=pass header.d=example.com' },
      }),
  },
  {
    name: 'a runtime From that differs from the parsed From',
    outcome: ReplyOutcome.NotOwner,
    delivery: (context) => ownerReplyOf({ context, runtimeHeaders: new Headers({ From: 'Other <other@example.com>' }) }),
  },
  {
    name: 'a From holding the owner and an attacker address',
    outcome: ReplyOutcome.NotOwner,
    delivery: (context) =>
      ownerReplyOf({ context, overrides: { From: `a <${context.owner.address}> b <attacker@${context.owner.address.split('@')[1]}>` } }),
  },
  {
    name: 'a Cc naming the reply address beside another To',
    outcome: ReplyOutcome.NotAReply,
    delivery: (context) => ownerReplyOf({ context, overrides: { To: 'friend@example.com' }, extras: [`Cc: ${context.replyAddress}`] }),
  },
  {
    name: 'a To naming the reply address that the signature does not cover',
    outcome: ReplyOutcome.NotAReply,
    delivery: (context) =>
      ownerReplyOf({
        context,
        overrides: { 'DKIM-Signature': 'v=1; a=rsa-sha256; d=example.com; s=1; h=from:subject:message-id; bh=a; b=b' },
      }),
  },
  {
    name: 'a reply address of an owner who turned the day email off',
    outcome: ReplyOutcome.UnknownRecipient,
    prepare: async (context) => {
      await env.DIRECTORY.prepare('UPDATE owners SET day_email = 0 WHERE id = ?').bind(context.owner.ownerId).run();
    },
    delivery: (context) => ownerReplyOf({ context }),
  },
  {
    name: 'a different address that passes authentication',
    outcome: ReplyOutcome.NotOwner,
    delivery: (context) =>
      ownerReplyOf({
        context,
        overrides: { From: `Owner <stranger@${STRANGER_DOMAIN}>`, 'Authentication-Results': authenticationResultsOf(STRANGER_DOMAIN) },
      }),
  },
  {
    name: 'the owner address only in the display name',
    outcome: ReplyOutcome.NotOwner,
    delivery: (context) =>
      ownerReplyOf({
        context,
        overrides: {
          From: `"${context.owner.address}" <stranger@${STRANGER_DOMAIN}>`,
          'Authentication-Results': authenticationResultsOf(STRANGER_DOMAIN),
        },
      }),
  },
  {
    name: 'the owner address only in a comment',
    outcome: ReplyOutcome.NotOwner,
    delivery: (context) =>
      ownerReplyOf({
        context,
        overrides: {
          From: `${context.owner.address} (x) <stranger@${STRANGER_DOMAIN}>`,
          'Authentication-Results': authenticationResultsOf(STRANGER_DOMAIN),
        },
      }),
  },
  {
    name: 'two From headers',
    outcome: ReplyOutcome.NotOwner,
    delivery: (context) => ownerReplyOf({ context, extras: [`From: stranger@${STRANGER_DOMAIN}`] }),
  },
  {
    name: 'an owner with two email identities',
    outcome: ReplyOutcome.NotOwner,
    prepare: (context) => seedEmailIdentity({ ownerId: context.owner.ownerId, email: freshAddress() }),
    delivery: (context) => ownerReplyOf({ context }),
  },
  {
    name: 'a To header naming another address',
    outcome: ReplyOutcome.NotAReply,
    delivery: (context) => ownerReplyOf({ context, overrides: { To: 'friend@example.com' } }),
  },
  {
    name: 'two To headers',
    outcome: ReplyOutcome.NotAReply,
    delivery: (context) => ownerReplyOf({ context, extras: [`To: ${context.replyAddress}`] }),
  },
  {
    name: 'no Message-ID',
    outcome: ReplyOutcome.NoMessageId,
    delivery: (context) => ownerReplyOf({ context, overrides: { 'Message-ID': null } }),
  },
  {
    name: 'two Message-IDs',
    outcome: ReplyOutcome.NoMessageId,
    delivery: (context) => ownerReplyOf({ context, extras: [`Message-ID: ${uniqueMessageId()}`] }),
  },
  {
    name: 'the day after the daily maximum',
    outcome: ReplyOutcome.DailyCap,
    prepare: (context) => insertRepliesToday({ ownerId: context.owner.ownerId, count: REPLY_DAILY_MAX }),
    delivery: (context) => ownerReplyOf({ context }),
  },
  {
    name: 'a reply that is only the quote',
    outcome: ReplyOutcome.Empty,
    delivery: (context) => ownerReplyOf({ context, body: QUOTE_ONLY_BODY }),
  },
  {
    name: 'a reply with a control character in its first line',
    outcome: ReplyOutcome.InvalidTitle,
    delivery: (context) => ownerReplyOf({ context, body: 'Buy\u0007 milk' }),
  },
  {
    name: 'an HTML-only reply',
    outcome: ReplyOutcome.Empty,
    delivery: (context) => ownerReplyOf({ context, extras: ['Content-Type: text/html; charset=utf-8'], body: '<p>Buy milk</p>' }),
  },
];

describe('a reply to the day email', () => {
  beforeEach(async () => {
    await resetDayEmails();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('adds one task titled with the first line to the first workspace Inbox, due the owner today, by the owner', async () => {
    const context = await seedReplyContext();
    const delivery = ownerReplyOf({
      context,
      body: `${REPLY_TITLE}\r\n\r\nOn Wed, Nov 25, 2026 at 7:00 AM todz <noreply@todz.app> wrote:\r\n> Today`,
    });
    await deliverReply({ delivery });
    expect(await inboxTasks(context.owner.inboxId)).toEqual([{ title: REPLY_TITLE, dueDate: todayOfOwner(), createdBy: OWNER_ACTOR }]);
    expect(await replyRows(context.owner.ownerId)).toHaveLength(1);
  });

  test('logs one line with the event and the outcome, never the address, the subject or the title', async () => {
    const output = consoleOutput();
    const context = await seedReplyContext();
    await deliverReply({ delivery: ownerReplyOf({ context }) });
    expect(replyLogLines(output)).toEqual([{ event: 'day_email_reply', outcome: ReplyOutcome.Added }]);
    const logged = JSON.stringify(output.mock.calls);
    [context.owner.address, context.replyAddress, REPLY_SUBJECT, REPLY_TITLE].forEach((secretText) => {
      expect(logged).not.toContain(secretText);
    });
  });

  test.each(REFUSALS)('$name is dropped silently and logs only $outcome', async ({ outcome, verdict, prepare, delivery, settings }) => {
    const output = consoleOutput();
    const recording = recordingBinding();
    const context = await seedReplyContext();
    if (prepare !== undefined) await prepare(context);
    const refused = delivery(context);
    const rowsBefore = (await replyRows(context.owner.ownerId)).length;
    await deliverReply({ delivery: refused, recording, settings: settings === undefined ? {} : settings() });
    expect(await inboxTasks(context.owner.inboxId)).toEqual([]);
    expect(await replyRows(context.owner.ownerId)).toHaveLength(rowsBefore);
    expect(refused.calls).toEqual({ rejects: [], forwards: [], replies: 0 });
    expect(recording.sent).toEqual([]);
    const expectedLine = verdict === undefined ? { event: 'day_email_reply', outcome } : { event: 'day_email_reply', outcome, verdict };
    expect(replyLogLines(output)).toEqual([expectedLine]);
    const logged = JSON.stringify(output.mock.calls);
    [context.owner.address, context.replyAddress, REPLY_SUBJECT, REPLY_TITLE].forEach((secretText) => {
      expect(logged).not.toContain(secretText);
    });
  });

  test('an expired reply address is refused as unknown', async () => {
    const output = consoleOutput();
    const context = await seedReplyContext();
    const expiredAddress = await issueReplyAddress({
      directory: env.DIRECTORY,
      ownerId: context.owner.ownerId,
      now: Date.now() - PAST_THE_ADDRESS_LIFETIME_MS,
    });
    await deliverReply({ delivery: ownerReplyOf({ context: { ...context, replyAddress: expiredAddress } }) });
    expect(await inboxTasks(context.owner.inboxId)).toEqual([]);
    expect(replyLogLines(output)).toEqual([{ event: 'day_email_reply', outcome: ReplyOutcome.UnknownRecipient }]);
  });

  test('an owner without a workspace adds nothing', async () => {
    const output = consoleOutput();
    const context = await seedWorkspacelessContext();
    await deliverReply({ delivery: ownerReplyOf({ context }) });
    expect(await replyRows(context.owner.ownerId)).toEqual([]);
    expect(replyLogLines(output)).toEqual([{ event: 'day_email_reply', outcome: ReplyOutcome.NoInbox }]);
  });

  test('a reply whose upper-case recipient matches is accepted', async () => {
    const context = await seedReplyContext();
    const upperCased = replyMessageOf({
      to: context.replyAddress.toUpperCase(),
      headers: replyHeadersOf({ address: context.owner.address, replyAddress: context.replyAddress }),
    });
    await deliverReply({ delivery: upperCased });
    expect(await inboxTasks(context.owner.inboxId)).toHaveLength(1);
  });

  test('an old owner-signed mail replayed to a valid reply address is refused as not a reply', async () => {
    const output = consoleOutput();
    const context = await seedReplyContext();
    await deliverReply({ delivery: ownerReplyOf({ context, overrides: { To: 'friend@example.com' } }) });
    expect(await inboxTasks(context.owner.inboxId)).toEqual([]);
    expect(replyLogLines(output)).toEqual([{ event: 'day_email_reply', outcome: ReplyOutcome.NotAReply }]);
  });

  test('a stranger flooding unknown reply addresses spends no limiter and the owner reply of the same minute is added', async () => {
    const context = await seedReplyContext();
    const { limiter, keys } = recordingLimiter({ isAllowed: true });
    await Promise.all(
      Array.from({ length: STRANGER_MESSAGE_COUNT }, async () => {
        const stranger = replyMessageOf({
          to: `reply+${crypto.randomUUID().replaceAll('-', '')}@todz.app`,
          headers: replyHeadersOf({ address: `x@${STRANGER_DOMAIN}`, replyAddress: context.replyAddress }),
        });
        await deliverReply({ delivery: stranger, settings: { DAY_EMAIL_REPLY_LIMITER: limiter } });
      }),
    );
    expect(keys).toEqual([]);
    await deliverReply({ delivery: ownerReplyOf({ context }), settings: { DAY_EMAIL_REPLY_LIMITER: limiter } });
    expect(await inboxTasks(context.owner.inboxId)).toHaveLength(1);
    expect(keys).toEqual([context.owner.ownerId]);
  });

  test('the address of owner A with the sender and authentication of owner B adds nothing to either owner', async () => {
    const first = await seedReplyContext();
    const second = await seedDayOwner();
    await deliverReply({
      delivery: replyMessageOf({
        to: first.replyAddress,
        headers: replyHeadersOf({ address: second.address, replyAddress: first.replyAddress }),
      }),
    });
    expect(await inboxTasks(first.owner.inboxId)).toEqual([]);
    expect(await inboxTasks(second.inboxId)).toEqual([]);
    expect(await replyRows(first.owner.ownerId)).toEqual([]);
    expect(await replyRows(second.ownerId)).toEqual([]);
  });

  test('the same Message-ID twice adds one task and one row', async () => {
    const context = await seedReplyContext();
    const overrides = { 'Message-ID': uniqueMessageId() };
    await deliverReply({ delivery: ownerReplyOf({ context, overrides }) });
    await deliverReply({ delivery: ownerReplyOf({ context, overrides }) });
    expect(await inboxTasks(context.owner.inboxId)).toHaveLength(1);
    expect(await replyRows(context.owner.ownerId)).toHaveLength(1);
  });

  test('a replayed Message-ID logs duplicate and not added', async () => {
    const output = consoleOutput();
    const context = await seedReplyContext();
    const overrides = { 'Message-ID': uniqueMessageId() };
    await deliverReply({ delivery: ownerReplyOf({ context, overrides }) });
    await deliverReply({ delivery: ownerReplyOf({ context, overrides }) });
    expect(replyLogLines(output)).toEqual([
      { event: 'day_email_reply', outcome: ReplyOutcome.Added },
      { event: 'day_email_reply', outcome: ReplyOutcome.Duplicate },
    ]);
  });

  test('the row keeps the digest of the Message-ID and not the Message-ID', async () => {
    const context = await seedReplyContext();
    const messageId = uniqueMessageId();
    await deliverReply({ delivery: ownerReplyOf({ context, overrides: { 'Message-ID': messageId } }) });
    const [row] = await replyRows(context.owner.ownerId);
    expect(row?.message_digest).toBe(await digestCredential(messageId));
  });

  test('a project store that throws rejects the handler without header text, and the redelivery adds once', async () => {
    const output = consoleOutput();
    const context = await seedReplyContext();
    const overrides = { 'Message-ID': uniqueMessageId() };
    const failing = projectStoreFailingFirstAdd({ message: `${FAILING_STORE_MESSAGE} ${REPLY_SUBJECT} ${context.owner.address}` });
    const settings = { PROJECT_STORE: failing.namespace };
    const failure = await deliverReply({ delivery: ownerReplyOf({ context, overrides }), settings }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    const failureMessage = (failure as Error).message;
    [REPLY_SUBJECT, REPLY_TITLE, context.owner.address, FAILING_STORE_MESSAGE].forEach((text) => {
      expect(failureMessage).not.toContain(text);
    });
    expect(await replyRows(context.owner.ownerId)).toHaveLength(1);
    expect(replyLogLines(output)).toEqual([{ event: 'day_email_reply', outcome: ReplyOutcome.Failed }]);
    await deliverReply({ delivery: ownerReplyOf({ context, overrides }), settings });
    expect(await inboxTasks(context.owner.inboxId)).toHaveLength(1);
    expect(await replyRows(context.owner.ownerId)).toHaveLength(1);
  });

  test('concurrent distinct replies never add more than the daily maximum', async () => {
    const context = await seedReplyContext();
    await Promise.all(Array.from({ length: REPLY_DAILY_MAX + 5 }, () => deliverReply({ delivery: ownerReplyOf({ context }) })));
    expect(await inboxTasks(context.owner.inboxId)).toHaveLength(REPLY_DAILY_MAX);
    expect(await replyRows(context.owner.ownerId)).toHaveLength(REPLY_DAILY_MAX);
  });

  test('replies older than the retention are not counted against the daily maximum', async () => {
    const context = await seedReplyContext();
    await env.DIRECTORY.batch(
      Array.from({ length: REPLY_DAILY_MAX }, (_unused, index) =>
        env.DIRECTORY.prepare('INSERT INTO day_email_replies (owner_id, message_digest, accepted_at) VALUES (?, ?, ?)').bind(
          context.owner.ownerId,
          String(index).padStart(64, '0'),
          Date.now() - DAY_EMAIL_RETENTION_MS,
        ),
      ),
    );
    await deliverReply({ delivery: ownerReplyOf({ context }) });
    expect(await inboxTasks(context.owner.inboxId)).toHaveLength(1);
  });
});
