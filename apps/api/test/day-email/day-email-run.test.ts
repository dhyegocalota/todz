import {
  DAY_EMAIL_REPLY_ADDRESS_LIFETIME_MS,
  DAY_EMAIL_RETENTION_MS,
  DAY_EMAIL_SENDS_PER_TICK_MAX,
  MILLISECONDS_PER_DAY,
} from '@todz/types';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { digestCredential } from '../../src/credential-digest';
import { DayEmailMissingPiece } from '../../src/day-email/day-email-run';
import { calendarDateInTimeZone } from '../../src/owner-today';
import { consoleOutput, recordingBinding } from '../email-sign-in-client';
import { recordingEnv } from '../owner-client';
import { CLOCK_NOW } from '../task-fixtures';
import {
  FAILED_RUN_MESSAGE,
  UTC_SEVEN_O_CLOCK,
  addTask,
  bindingFailingFor,
  dayEmailRows,
  mailTo,
  mailsTo,
  observedProjectStore,
  resetDayEmails,
  secretOfReplyTo,
  seedDayOwner,
  seedProjectOf,
  seedWorkspaceOf,
  tick,
} from './day-email-client';

const PROJECTS_OVER_THE_CAP = 101;
const TODAY = calendarDateInTimeZone({ timeZone: 'UTC', now: UTC_SEVEN_O_CLOCK });
const OVERDUE_DATE = '2026-11-20';
const UPCOMING_DATE = '2026-11-30';
const OWNER_COUNT_OVER_THE_CAP = DAY_EMAIL_SENDS_PER_TICK_MAX + 1;
const NEXT_TICK = UTC_SEVEN_O_CLOCK + 15 * 60_000;
const PAST_THE_RETENTION_MS = DAY_EMAIL_RETENTION_MS + MILLISECONDS_PER_DAY;
const INSIDE_THE_RETENTION_MS = DAY_EMAIL_RETENTION_MS - MILLISECONDS_PER_DAY;
const MESSAGE_DIGEST = 'f'.repeat(64);
const OLD_MESSAGE_DIGEST = 'e'.repeat(64);

type WindowCase = { name: string; timeZone: string; minutes: number; ticks: string[]; expectedMails: number };

const WINDOW_CASES: WindowCase[] = [
  {
    name: 'Sao Paulo 07:00 before its tick',
    timeZone: 'America/Sao_Paulo',
    minutes: 420,
    ticks: ['2026-11-24T09:45:00Z'],
    expectedMails: 0,
  },
  { name: 'Sao Paulo 07:00 at its tick', timeZone: 'America/Sao_Paulo', minutes: 420, ticks: ['2026-11-24T10:00:00Z'], expectedMails: 1 },
  { name: 'Sao Paulo 07:10 at 07:00', timeZone: 'America/Sao_Paulo', minutes: 430, ticks: ['2026-11-24T10:00:00Z'], expectedMails: 0 },
  { name: 'Sao Paulo 07:10 at 07:15', timeZone: 'America/Sao_Paulo', minutes: 430, ticks: ['2026-11-24T10:15:00Z'], expectedMails: 1 },
  {
    name: 'Sao Paulo 07:00 first seen 165 minutes late',
    timeZone: 'America/Sao_Paulo',
    minutes: 420,
    ticks: ['2026-11-24T12:45:00Z'],
    expectedMails: 1,
  },
  {
    name: 'Sao Paulo 07:00 first seen 180 minutes late',
    timeZone: 'America/Sao_Paulo',
    minutes: 420,
    ticks: ['2026-11-24T13:00:00Z'],
    expectedMails: 0,
  },
  {
    name: 'UTC 00:00 at local midnight, read as 00 and never 24',
    timeZone: 'UTC',
    minutes: 0,
    ticks: ['2026-11-24T00:00:00Z'],
    expectedMails: 1,
  },
  { name: 'UTC 00:05 at local midnight', timeZone: 'UTC', minutes: 5, ticks: ['2026-11-24T00:00:00Z'], expectedMails: 0 },
  { name: 'UTC 00:05 at 00:15', timeZone: 'UTC', minutes: 5, ticks: ['2026-11-24T00:15:00Z'], expectedMails: 1 },
  { name: 'Kolkata 07:00 a quarter hour early', timeZone: 'Asia/Kolkata', minutes: 420, ticks: ['2026-11-24T01:15:00Z'], expectedMails: 0 },
  { name: 'Kolkata 07:00 at 01:30 UTC', timeZone: 'Asia/Kolkata', minutes: 420, ticks: ['2026-11-24T01:30:00Z'], expectedMails: 1 },
  {
    name: 'New York 01:30 on the day the clocks fall back, the hour repeating',
    timeZone: 'America/New_York',
    minutes: 90,
    ticks: ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'],
    expectedMails: 1,
  },
  {
    name: 'New York 02:30 on the day the clocks spring forward, before 03:00',
    timeZone: 'America/New_York',
    minutes: 150,
    ticks: ['2027-03-14T06:45:00Z'],
    expectedMails: 0,
  },
  {
    name: 'New York 02:30 on the day the clocks spring forward, at 03:00',
    timeZone: 'America/New_York',
    minutes: 150,
    ticks: ['2027-03-14T06:45:00Z', '2027-03-14T07:00:00Z'],
    expectedMails: 1,
  },
  {
    name: 'UTC 23:00 never spills into the next local day',
    timeZone: 'UTC',
    minutes: 1380,
    ticks: ['2026-11-25T01:00:00Z'],
    expectedMails: 0,
  },
];

type OwnerSeed = Awaited<ReturnType<typeof seedDayOwner>>;

async function mailedTo({ owner, recording }: { owner: OwnerSeed; recording: ReturnType<typeof recordingBinding> }): Promise<number> {
  return mailsTo({ recording, address: owner.address }).length;
}

function runOutput(output: ReturnType<typeof consoleOutput>): unknown[] {
  return output.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown);
}

beforeEach(async () => {
  await resetDayEmails();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the day email window', () => {
  test.each(WINDOW_CASES)('$name', async ({ timeZone, minutes, ticks, expectedMails }) => {
    const recording = recordingBinding();
    const owner = await seedDayOwner({ timeZone, minutes });
    await ticks.reduce(async (previous, scheduledTime) => {
      await previous;
      await tick({ recording, scheduledTime: Date.parse(scheduledTime) });
    }, Promise.resolve());
    expect(await mailedTo({ owner, recording })).toBe(expectedMails);
    expect(await dayEmailRows(owner.ownerId)).toHaveLength(expectedMails);
  });
});

describe('who is due', () => {
  test('an owner with the flag off gets nothing and no row', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner({ isEnabled: false });
    await tick({ recording });
    expect(recording.sent).toEqual([]);
    expect(await dayEmailRows(owner.ownerId)).toEqual([]);
  });

  test('an owner with no email identity gets nothing', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner();
    await env.DIRECTORY.prepare('DELETE FROM owner_identities WHERE owner_id = ?').bind(owner.ownerId).run();
    await tick({ recording });
    expect(recording.sent).toEqual([]);
    expect(await dayEmailRows(owner.ownerId)).toEqual([]);
  });

  test('an owner with two email identities gets nothing', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner();
    await env.DIRECTORY.prepare('INSERT INTO owner_identities (provider, subject, owner_id, created_at) VALUES (?, ?, ?, ?)')
      .bind('email', `second.${owner.address}`, owner.ownerId, CLOCK_NOW)
      .run();
    await tick({ recording });
    expect(recording.sent).toEqual([]);
    expect(await dayEmailRows(owner.ownerId)).toEqual([]);
  });

  test('an owner with no workspace gets nothing', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner();
    await env.DIRECTORY.prepare('DELETE FROM projects WHERE workspace_id = ?').bind(owner.workspaceId).run();
    await env.DIRECTORY.prepare('DELETE FROM workspaces WHERE id = ?').bind(owner.workspaceId).run();
    await tick({ recording });
    expect(recording.sent).toEqual([]);
    expect(await dayEmailRows(owner.ownerId)).toEqual([]);
  });

  test('an owner whose stored zone no longer resolves is skipped and the others are still mailed', async () => {
    const recording = recordingBinding();
    const broken = await seedDayOwner();
    const healthy = await seedDayOwner();
    await env.DIRECTORY.prepare('UPDATE owners SET time_zone = ? WHERE id = ?').bind('Not/A_Zone', broken.ownerId).run();
    await tick({ recording });
    expect(await mailedTo({ owner: broken, recording })).toBe(0);
    expect(await mailedTo({ owner: healthy, recording })).toBe(1);
    expect(await dayEmailRows(broken.ownerId)).toEqual([]);
  });
});

describe('the claim', () => {
  test('two sequential runs of one tick send one mail and keep one row with sent_at', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner();
    await tick({ recording });
    await tick({ recording });
    expect(await mailedTo({ owner, recording })).toBe(1);
    const [row, ...others] = await dayEmailRows(owner.ownerId);
    expect(others).toEqual([]);
    expect(row).toMatchObject({ owner_id: owner.ownerId, day: TODAY, claimed_at: UTC_SEVEN_O_CLOCK, failed_at: null, failure: null });
    expect(row?.sent_at).not.toBeNull();
  });

  test('two concurrent runs of one tick send one mail and keep one row', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner();
    await Promise.all([tick({ recording }), tick({ recording })]);
    expect(await mailedTo({ owner, recording })).toBe(1);
    expect(await dayEmailRows(owner.ownerId)).toHaveLength(1);
  });

  test('a later tick of the same local day sends nothing more', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner();
    await tick({ recording });
    await tick({ recording, scheduledTime: NEXT_TICK });
    expect(await mailedTo({ owner, recording })).toBe(1);
  });
});

describe('a failing owner', () => {
  test('a sender that throws marks send_failed, mails the others and rejects with the count only', async () => {
    const recording = recordingBinding();
    const failing = await seedDayOwner();
    const healthy = await seedDayOwner();
    const rejection = tick({ recording, settings: { EMAIL: bindingFailingFor({ address: failing.address, recording }) } });
    await expect(rejection).rejects.toThrow(FAILED_RUN_MESSAGE);
    await expect(rejection).rejects.not.toThrow(failing.address);
    await expect(rejection).rejects.not.toThrow(failing.ownerId);
    expect(await mailedTo({ owner: healthy, recording })).toBe(1);
    const [failedRow] = await dayEmailRows(failing.ownerId);
    expect(failedRow).toMatchObject({ sent_at: null, failure: 'send_failed' });
    expect(failedRow?.failed_at).not.toBeNull();
    const [sentRow] = await dayEmailRows(healthy.ownerId);
    expect(sentRow?.sent_at).not.toBeNull();
  });

  test('a project whose read fails marks read_failed, sends no mail and the others are still mailed', async () => {
    const recording = recordingBinding();
    const failing = await seedDayOwner();
    const healthy = await seedDayOwner();
    const { namespace } = observedProjectStore({ failingProjectId: failing.inboxId });
    await expect(tick({ recording, settings: { PROJECT_STORE: namespace } })).rejects.toThrow(FAILED_RUN_MESSAGE);
    expect(await mailedTo({ owner: failing, recording })).toBe(0);
    expect(await mailedTo({ owner: healthy, recording })).toBe(1);
    expect(await dayEmailRows(failing.ownerId)).toMatchObject([{ sent_at: null, failure: 'read_failed' }]);
  });

  test('an owner with 101 projects is marked too_many_projects with no project read and the next owner is mailed', async () => {
    const recording = recordingBinding();
    const crowded = await seedDayOwner();
    const healthy = await seedDayOwner();
    await env.DIRECTORY.batch(
      Array.from({ length: PROJECTS_OVER_THE_CAP - 1 }, (_unused, index) =>
        env.DIRECTORY.prepare('INSERT INTO projects (id, workspace_id, name, is_inbox, created_at) VALUES (?, ?, ?, 0, ?)').bind(
          crypto.randomUUID(),
          crowded.workspaceId,
          `Project ${index}`,
          CLOCK_NOW + index + 1,
        ),
      ),
    );
    const { namespace, listCalls } = observedProjectStore();
    await expect(tick({ recording, settings: { PROJECT_STORE: namespace } })).rejects.toThrow(FAILED_RUN_MESSAGE);
    expect(await mailedTo({ owner: crowded, recording })).toBe(0);
    expect(await dayEmailRows(crowded.ownerId)).toMatchObject([{ sent_at: null, failure: 'too_many_projects' }]);
    expect(listCalls).toHaveLength(1);
    expect(await mailedTo({ owner: healthy, recording })).toBe(1);
  });

  test('owners are sent one at a time', async () => {
    const recording = recordingBinding();
    const events: string[] = [];
    const overlapDetectingBinding: SendEmail = {
      async send(message) {
        events.push('start');
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        events.push('end');
        return recording.binding.send(message as EmailMessageBuilder);
      },
    };
    await seedDayOwner();
    await seedDayOwner();
    await seedDayOwner();
    await tick({ recording, settings: { EMAIL: overlapDetectingBinding } });
    expect(events).toEqual(['start', 'end', 'start', 'end', 'start', 'end']);
  });

  test('a sender missing from the configuration claims nothing and rejects naming the missing piece', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner();
    await expect(tick({ recording, settings: { EMAIL: undefined } })).rejects.toThrow(DayEmailMissingPiece.EmailSender);
    await expect(tick({ recording, settings: { EMAIL_SENDER: undefined } })).rejects.toThrow(DayEmailMissingPiece.EmailSender);
    expect(await dayEmailRows(owner.ownerId)).toEqual([]);
    expect(recording.sent).toEqual([]);
  });
});

describe('the cap per tick', () => {
  test('mails fifty of fifty-one due owners on the tick and the last one on the next', async () => {
    const recording = recordingBinding();
    const owners = await Promise.all(Array.from({ length: OWNER_COUNT_OVER_THE_CAP }, () => seedDayOwner()));
    await tick({ recording });
    expect(recording.sent).toHaveLength(DAY_EMAIL_SENDS_PER_TICK_MAX);
    await tick({ recording, scheduledTime: NEXT_TICK });
    expect(recording.sent).toHaveLength(OWNER_COUNT_OVER_THE_CAP);
    expect(new Set(recording.sent.map((message) => message.to))).toEqual(new Set(owners.map((owner) => owner.address)));
  });
});

describe('the reply address', () => {
  test('is a reply+secret address whose digest is stored for seven days and whose secret is stored nowhere', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner();
    await tick({ recording });
    const message = mailTo({ recording, address: owner.address });
    const secret = secretOfReplyTo(message.replyTo);
    const row = await env.DIRECTORY.prepare(
      'SELECT digest, owner_id, created_at, expires_at FROM day_email_reply_addresses WHERE owner_id = ?',
    )
      .bind(owner.ownerId)
      .first();
    expect(row).toEqual({
      digest: await digestCredential(secret),
      owner_id: owner.ownerId,
      created_at: UTC_SEVEN_O_CLOCK,
      expires_at: UTC_SEVEN_O_CLOCK + DAY_EMAIL_REPLY_ADDRESS_LIFETIME_MS,
    });
    const stored = await Promise.all(
      ['day_emails', 'day_email_reply_addresses', 'day_email_replies'].map((table) =>
        env.DIRECTORY.prepare(`SELECT * FROM ${table}`).all(),
      ),
    );
    expect(JSON.stringify(stored)).not.toContain(secret);
  });
});

describe('the pruning on each tick', () => {
  test('deletes day emails and replies past thirty days and expired reply addresses and keeps newer ones', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner({ isEnabled: false });
    const digest = (character: string): string => character.repeat(64);
    await env.DIRECTORY.batch([
      env.DIRECTORY.prepare('INSERT INTO day_emails (owner_id, day, claimed_at) VALUES (?, ?, ?)').bind(
        owner.ownerId,
        '2026-10-01',
        UTC_SEVEN_O_CLOCK - PAST_THE_RETENTION_MS,
      ),
      env.DIRECTORY.prepare('INSERT INTO day_emails (owner_id, day, claimed_at) VALUES (?, ?, ?)').bind(
        owner.ownerId,
        '2026-10-30',
        UTC_SEVEN_O_CLOCK - INSIDE_THE_RETENTION_MS,
      ),
      env.DIRECTORY.prepare('INSERT INTO day_email_replies (owner_id, message_digest, accepted_at) VALUES (?, ?, ?)').bind(
        owner.ownerId,
        OLD_MESSAGE_DIGEST,
        UTC_SEVEN_O_CLOCK - PAST_THE_RETENTION_MS,
      ),
      env.DIRECTORY.prepare('INSERT INTO day_email_replies (owner_id, message_digest, accepted_at) VALUES (?, ?, ?)').bind(
        owner.ownerId,
        MESSAGE_DIGEST,
        UTC_SEVEN_O_CLOCK - INSIDE_THE_RETENTION_MS,
      ),
      env.DIRECTORY.prepare('INSERT INTO day_email_reply_addresses (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(
        digest('a'),
        owner.ownerId,
        UTC_SEVEN_O_CLOCK - MILLISECONDS_PER_DAY,
        UTC_SEVEN_O_CLOCK - 1,
      ),
      env.DIRECTORY.prepare('INSERT INTO day_email_reply_addresses (digest, owner_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(
        digest('b'),
        owner.ownerId,
        UTC_SEVEN_O_CLOCK - MILLISECONDS_PER_DAY,
        UTC_SEVEN_O_CLOCK + MILLISECONDS_PER_DAY,
      ),
    ]);
    await tick({ recording });
    expect((await dayEmailRows(owner.ownerId)).map((row) => row.day)).toEqual(['2026-10-30']);
    const replies = await env.DIRECTORY.prepare('SELECT message_digest FROM day_email_replies WHERE owner_id = ?')
      .bind(owner.ownerId)
      .all();
    expect(replies.results).toEqual([{ message_digest: MESSAGE_DIGEST }]);
    const addresses = await env.DIRECTORY.prepare('SELECT digest FROM day_email_reply_addresses WHERE owner_id = ?')
      .bind(owner.ownerId)
      .all();
    expect(addresses.results).toEqual([{ digest: digest('b') }]);
  });
});

describe("the mail's Today", () => {
  test('lists the open tasks due today or overdue of every workspace in the directory order, labelled by workspace', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner({ workspaceName: 'Personal' });
    const home = await seedProjectOf({ workspaceId: owner.workspaceId, name: 'Home', createdAt: CLOCK_NOW + 1 });
    const work = await seedWorkspaceOf({ ownerId: owner.ownerId, name: 'Work', createdAt: CLOCK_NOW + 2 });
    const todz = await seedProjectOf({ workspaceId: work.workspaceId, name: 'todz', createdAt: CLOCK_NOW + 3 });
    await addTask({ projectId: owner.inboxId, title: 'Pay rent', dueDate: OVERDUE_DATE });
    await addTask({ projectId: owner.inboxId, title: 'Call the bank', dueDate: TODAY });
    await addTask({ projectId: owner.inboxId, title: 'Later', dueDate: UPCOMING_DATE });
    await addTask({ projectId: owner.inboxId, title: 'Someday', dueDate: null });
    await addTask({ projectId: home, title: 'Water the plants', dueDate: TODAY });
    await addTask({ projectId: work.inboxId, title: 'Standup', dueDate: TODAY });
    await addTask({ projectId: todz, title: 'Ship the beta', dueDate: OVERDUE_DATE });
    await tick({ recording });
    const message = mailTo({ recording, address: owner.address });
    expect(message.subject).toBe('Your day: 5 due');
    expect(message.text).toContain(
      [
        'T-1 Pay rent · Personal / Inbox · overdue',
        'T-2 Call the bank · Personal / Inbox',
        'T-1 Water the plants · Personal / Home',
        'T-1 Standup · Work / Inbox',
        'T-1 Ship the beta · Work / todz · overdue',
      ].join('\n'),
    );
    expect(message.text).not.toContain('Later');
    expect(message.text).not.toContain('Someday');
    expect(message.text).toContain('in the Inbox of Personal.');
    expect(message.replyTo).toMatch(/^reply\+[0-9a-f]{32}@todz\.app$/);
    expect(message.headers).toEqual({ 'Auto-Submitted': 'auto-generated' });
  });

  test('mails an empty Today as nothing due, with the reply hint', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner();
    await addTask({ projectId: owner.inboxId, title: 'Later', dueDate: UPCOMING_DATE });
    await tick({ recording });
    const message = mailTo({ recording, address: owner.address });
    expect(message.subject).toBe('Your day: nothing due');
    expect(message.text).toContain('Reply from the address you sign in with');
  });

  test("never lists another owner's tasks", async () => {
    const recording = recordingBinding();
    const first = await seedDayOwner();
    const second = await seedDayOwner();
    await addTask({ projectId: first.inboxId, title: 'First owner only', dueDate: TODAY });
    await addTask({ projectId: second.inboxId, title: 'Second owner only', dueDate: TODAY });
    await tick({ recording });
    const firstMail = mailTo({ recording, address: first.address });
    const secondMail = mailTo({ recording, address: second.address });
    expect(firstMail.text).toContain('First owner only');
    expect(firstMail.text).not.toContain('Second owner only');
    expect(secondMail.text).toContain('Second owner only');
    expect(secondMail.text).not.toContain('First owner only');
  });
});

describe('the work of the ticks after a send', () => {
  test('an owner claimed earlier in the window costs no claim on the next tick', async () => {
    const recording = recordingBinding();
    await seedDayOwner();
    await tick({ recording });
    const { workerEnv, statements } = recordingEnv();
    await tick({ recording, scheduledTime: NEXT_TICK, settings: { DIRECTORY: workerEnv.DIRECTORY } });
    expect(statements.filter((statement) => statement.startsWith('INSERT INTO day_emails'))).toEqual([]);
    expect(recording.sent).toHaveLength(1);
  });

  test('the day after a send the owner is claimed again', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner();
    await tick({ recording });
    await tick({ recording, scheduledTime: UTC_SEVEN_O_CLOCK + MILLISECONDS_PER_DAY });
    expect(await dayEmailRows(owner.ownerId)).toHaveLength(2);
  });
});

describe('the summary line', () => {
  test('logs the due, sent and failed counts and no address', async () => {
    const recording = recordingBinding();
    const output = consoleOutput();
    const owner = await seedDayOwner();
    await seedDayOwner();
    await tick({ recording });
    expect(runOutput(output)).toEqual([{ event: 'day_email_run', due: 2, sent: 2, failed: 0 }]);
    expect(JSON.stringify(runOutput(output))).not.toContain(owner.address);
  });

  test('logs the failure before the run rejects', async () => {
    const recording = recordingBinding();
    const output = consoleOutput();
    const failing = await seedDayOwner();
    await expect(tick({ recording, settings: { EMAIL: bindingFailingFor({ address: failing.address, recording }) } })).rejects.toThrow(
      FAILED_RUN_MESSAGE,
    );
    expect(runOutput(output)).toEqual([{ event: 'day_email_run', due: 1, sent: 0, failed: 1 }]);
  });
});
