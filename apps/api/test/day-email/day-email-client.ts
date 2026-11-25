import { OWNER_ACTOR } from '@todz/core';
import { env } from 'cloudflare:workers';
import { createScheduledController } from 'cloudflare:test';
import type { Env } from '../../src/env';
import worker from '../../src/index';
import type { ProjectStore } from '../../src/project-store';
import { ScheduledCron } from '../../src/scheduled';
import { enableDayEmail, seedEmailIdentity, seedOwner } from '../directory-seed';
import { CLOUDFLARE_SETTINGS, type RecordingBinding, freshAddress, recordingBinding } from '../email-sign-in-client';
import { workerEnvWith } from '../owner-client';
import { CLOCK_NOW } from '../task-fixtures';

export const DAY_EMAIL_MINUTES = 420;
export const UTC_SEVEN_O_CLOCK = Date.parse('2026-11-24T07:00:00Z');
export const FAILED_RUN_MESSAGE = 'the day email failed for 1 owner';

const DAY_EMAIL_TABLES = ['day_emails', 'day_email_reply_addresses', 'day_email_replies'];
const REPLY_ADDRESS_PATTERN = /^reply\+([0-9a-f]{32})@todz\.app$/;
const SECRET_GROUP = 1;

export type DayEmailRow = {
  owner_id: string;
  day: string;
  claimed_at: number;
  sent_at: number | null;
  failed_at: number | null;
  failure: string | null;
};

export type SeededDayOwner = { ownerId: string; address: string; workspaceId: string; inboxId: string };

export async function resetDayEmails(): Promise<void> {
  await env.DIRECTORY.prepare('UPDATE owners SET day_email = 0').run();
  await env.DIRECTORY.batch(DAY_EMAIL_TABLES.map((table) => env.DIRECTORY.prepare(`DELETE FROM ${table}`)));
}

export async function seedWorkspaceOf({
  ownerId,
  name = 'Personal',
  createdAt = CLOCK_NOW,
}: {
  ownerId: string;
  name?: string;
  createdAt?: number;
}): Promise<{ workspaceId: string; inboxId: string }> {
  const workspaceId = crypto.randomUUID();
  const inboxId = crypto.randomUUID();
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare('INSERT INTO workspaces (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').bind(
      workspaceId,
      ownerId,
      name,
      createdAt,
    ),
    env.DIRECTORY.prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) VALUES (?, ?, ?, 1, ?)').bind(
      inboxId,
      workspaceId,
      'Inbox',
      createdAt,
    ),
  ]);
  return { workspaceId, inboxId };
}

export async function seedProjectOf({
  workspaceId,
  name,
  createdAt = CLOCK_NOW,
}: {
  workspaceId: string;
  name: string;
  createdAt?: number;
}): Promise<string> {
  const projectId = crypto.randomUUID();
  await env.DIRECTORY.prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) VALUES (?, ?, ?, 0, ?)')
    .bind(projectId, workspaceId, name, createdAt)
    .run();
  return projectId;
}

export async function seedDayOwner({
  timeZone = 'UTC',
  minutes = DAY_EMAIL_MINUTES,
  isEnabled = true,
  workspaceName = 'Personal',
}: { timeZone?: string; minutes?: number; isEnabled?: boolean; workspaceName?: string } = {}): Promise<SeededDayOwner> {
  const ownerId = await seedOwner(timeZone);
  const address = freshAddress();
  await seedEmailIdentity({ ownerId, email: address });
  if (isEnabled) await enableDayEmail({ directory: env.DIRECTORY, ownerId, minutes });
  const { workspaceId, inboxId } = await seedWorkspaceOf({ ownerId, name: workspaceName });
  return { ownerId, address, workspaceId, inboxId };
}

export async function addTask({ projectId, title, dueDate }: { projectId: string; title: string; dueDate: string | null }): Promise<void> {
  const project = env.PROJECT_STORE.get(env.PROJECT_STORE.idFromName(projectId));
  await project.addTasks({ actor: OWNER_ACTOR, drafts: [{ title, notes: null, dueDate, idempotencyKey: null }] });
}

export function tick({
  settings = {},
  recording,
  cron = ScheduledCron.DayEmail,
  scheduledTime = UTC_SEVEN_O_CLOCK,
}: {
  settings?: Partial<Env>;
  recording: RecordingBinding;
  cron?: string;
  scheduledTime?: number;
}): Promise<void> {
  return worker.scheduled(
    createScheduledController({ cron, scheduledTime }),
    workerEnvWith({ ...CLOUDFLARE_SETTINGS, EMAIL: recording.binding, ...settings }),
  );
}

export function mailsTo({ recording, address }: { recording: RecordingBinding; address: string }): RecordingBinding['sent'] {
  return recording.sent.filter((message) => message.to === address);
}

export function mailTo({ recording, address }: { recording: RecordingBinding; address: string }): RecordingBinding['sent'][number] {
  const [message, ...others] = mailsTo({ recording, address });
  if (message === undefined || others.length > 0) throw new Error('exactly one mail should have gone to the owner');
  return message;
}

export function secretOfReplyTo(replyTo: string): string {
  const secret = REPLY_ADDRESS_PATTERN.exec(replyTo)?.[SECRET_GROUP];
  if (secret === undefined) throw new Error('the reply-to should be reply+<32 hex>@todz.app');
  return secret;
}

export async function dayEmailRows(ownerId: string): Promise<DayEmailRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT owner_id, day, claimed_at, sent_at, failed_at, failure FROM day_emails WHERE owner_id = ? ORDER BY day',
  )
    .bind(ownerId)
    .all<DayEmailRow>();
  return results;
}

export type ObservedProjectStore = { namespace: DurableObjectNamespace<ProjectStore>; listCalls: string[] };

export function observedProjectStore({ failingProjectId }: { failingProjectId?: string } = {}): ObservedProjectStore {
  const listCalls: string[] = [];
  const failingId = failingProjectId === undefined ? null : env.PROJECT_STORE.idFromName(failingProjectId).toString();
  const namespace = new Proxy(env.PROJECT_STORE, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      if (property !== 'get') return member.bind(target);
      return (id: DurableObjectId) =>
        new Proxy(target.get(id), {
          get(stub, stubProperty) {
            const stubMember = Reflect.get(stub, stubProperty);
            if (stubProperty !== 'listTasks') return stubMember;
            return (...parameters: Parameters<typeof stub.listTasks>) => {
              listCalls.push(id.toString());
              if (id.toString() === failingId) return Promise.reject(new Error('the project is down'));
              return stub.listTasks(...parameters);
            };
          },
        });
    },
  });
  return { namespace, listCalls };
}

export function bindingFailingFor({ address, recording }: { address: string; recording: RecordingBinding }): SendEmail {
  return {
    async send(message) {
      if (JSON.stringify(message).includes(address)) throw new Error('the mail service is down');
      return recording.binding.send(message as EmailMessageBuilder);
    },
  };
}
