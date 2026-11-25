import { env } from 'cloudflare:workers';
import type { MockInstance } from 'vitest';
import { issueReplyAddress } from '../../src/day-email/day-email-reply-address';
import type { Env } from '../../src/env';
import worker from '../../src/index';
import type { ProjectStore } from '../../src/project-store';
import { seedEmailIdentity, seedOwner } from '../directory-seed';
import { CLOUDFLARE_SETTINGS, type RecordingBinding, freshAddress, recordingLimiter } from '../email-sign-in-client';
import { workerEnvWith } from '../owner-client';
import { openTasksFilter, unwrap } from '../task-fixtures';
import { type SeededDayOwner, seedDayOwner } from './day-email-client';

export const REPLY_SUBJECT = 'Re: Your day, Wednesday';
export const REPLY_TITLE = 'Buy milk';

const DOMAIN_SEPARATOR = '@';

export type ReplyContext = { owner: SeededDayOwner; replyAddress: string };

export type ReplyCalls = { rejects: string[]; forwards: string[]; replies: number };

export type ReplyDelivery = { message: ForwardableEmailMessage; calls: ReplyCalls };

export type ReplyHeaderName = 'Authentication-Results' | 'From' | 'To' | 'Message-ID' | 'Subject';

export type ReplyHeaderOverrides = Partial<Record<ReplyHeaderName, string | null>>;

export type RepliedTask = { title: string; dueDate: string | null; createdBy: unknown };

export type ReplyRow = { owner_id: string; message_digest: string; accepted_at: number };

function domainOf(address: string): string {
  return address.slice(address.lastIndexOf(DOMAIN_SEPARATOR) + DOMAIN_SEPARATOR.length);
}

export function authenticationResultsOf(domain: string): string {
  return `mx.cloudflare.net; spf=pass smtp.mailfrom=owner@${domain}; dkim=pass header.d=${domain} header.s=20230601; dmarc=pass header.from=${domain}`;
}

export function uniqueMessageId(): string {
  return `<${crypto.randomUUID()}@mail.example.com>`;
}

export function replyHeadersOf({
  address,
  replyAddress,
  overrides = {},
  extras = [],
}: {
  address: string;
  replyAddress: string;
  overrides?: ReplyHeaderOverrides;
  extras?: string[];
}): string[] {
  const defaults: Record<ReplyHeaderName, string | null> = {
    'Authentication-Results': authenticationResultsOf(domainOf(address)),
    From: `Owner <${address}>`,
    To: `todz <${replyAddress}>`,
    'Message-ID': uniqueMessageId(),
    Subject: REPLY_SUBJECT,
  };
  const merged = { ...defaults, ...overrides };
  const named = Object.entries(merged).flatMap(([name, value]) => (value === null ? [] : [`${name}: ${value}`]));
  return [...named, ...extras];
}

export function replyMessageOf({
  to,
  headers,
  body = REPLY_TITLE,
  rawSize,
  raw,
}: {
  to: string;
  headers: string[];
  body?: string;
  rawSize?: number;
  raw?: ReadableStream<Uint8Array>;
}): ReplyDelivery {
  const text = [...headers, '', body].join('\r\n');
  const bytes = new TextEncoder().encode(text);
  const calls: ReplyCalls = { rejects: [], forwards: [], replies: 0 };
  const message: ForwardableEmailMessage = {
    from: 'bounce@mail.example.com',
    to,
    headers: new Headers(),
    raw: raw === undefined ? new Blob([bytes]).stream() : raw,
    rawSize: rawSize === undefined ? bytes.byteLength : rawSize,
    canBeForwarded: true,
    setReject(reason) {
      calls.rejects.push(reason);
    },
    async forward(recipient) {
      calls.forwards.push(recipient);
      return { messageId: 'forwarded' };
    },
    async reply() {
      calls.replies += 1;
      return { messageId: 'replied' };
    },
  };
  return { message, calls };
}

export async function seedReplyContext(): Promise<ReplyContext> {
  const owner = await seedDayOwner();
  const replyAddress = await issueReplyAddress({ directory: env.DIRECTORY, ownerId: owner.ownerId, now: Date.now() });
  return { owner, replyAddress };
}

export async function seedWorkspacelessContext(): Promise<ReplyContext> {
  const ownerId = await seedOwner();
  const address = freshAddress();
  await seedEmailIdentity({ ownerId, email: address });
  const replyAddress = await issueReplyAddress({ directory: env.DIRECTORY, ownerId, now: Date.now() });
  return { owner: { ownerId, address, workspaceId: '', inboxId: '' }, replyAddress };
}

export function ownerReplyOf({
  context,
  overrides,
  extras,
  body,
}: {
  context: ReplyContext;
  overrides?: ReplyHeaderOverrides;
  extras?: string[];
  body?: string;
}): ReplyDelivery {
  const headers = replyHeadersOf({ address: context.owner.address, replyAddress: context.replyAddress, overrides, extras });
  return replyMessageOf({ to: context.replyAddress, headers, body });
}

export function deliverReply({
  delivery,
  settings = {},
  recording,
}: {
  delivery: ReplyDelivery;
  settings?: Partial<Env>;
  recording?: RecordingBinding;
}): Promise<void> {
  const sendingSettings: Partial<Env> = recording === undefined ? {} : { EMAIL: recording.binding };
  const limiter = recordingLimiter({ isAllowed: true }).limiter;
  return worker.email(
    delivery.message,
    workerEnvWith({ ...CLOUDFLARE_SETTINGS, DAY_EMAIL_REPLY_LIMITER: limiter, ...sendingSettings, ...settings }),
  );
}

export async function inboxTasks(inboxId: string): Promise<RepliedTask[]> {
  const stub = env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(inboxId));
  const { tasks } = unwrap(await stub.listTasks({ today: '2026-11-25', filter: openTasksFilter() }));
  return tasks.map(({ title, dueDate, createdBy }) => ({ title, dueDate, createdBy }));
}

export async function replyRows(ownerId: string): Promise<ReplyRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT owner_id, message_digest, accepted_at FROM day_email_replies WHERE owner_id = ? ORDER BY accepted_at',
  )
    .bind(ownerId)
    .all<ReplyRow>();
  return results;
}

export function replyLogLines(output: MockInstance<typeof console.log>): unknown[] {
  return output.mock.calls.map(([line]) => JSON.parse(String(line)));
}

export type FailingAdds = { namespace: DurableObjectNamespace<ProjectStore> };

export function projectStoreFailingFirstAdd({ message }: { message: string }): FailingAdds {
  let failuresLeft = 1;
  const namespace = new Proxy(env.PROJECT_STORE, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      if (property !== 'get') return member.bind(target);
      return (id: DurableObjectId) =>
        new Proxy(target.get(id), {
          get(stub, stubProperty) {
            const stubMember = Reflect.get(stub, stubProperty);
            if (stubProperty !== 'addTasks') return stubMember;
            return (...parameters: Parameters<typeof stub.addTasks>) => {
              if (failuresLeft === 0) return stub.addTasks(...parameters);
              failuresLeft -= 1;
              return Promise.reject(new Error(message));
            };
          },
        });
    },
  });
  return { namespace };
}
