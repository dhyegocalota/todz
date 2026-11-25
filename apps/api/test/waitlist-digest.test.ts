import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR } from '@todz/types';
import { createScheduledController } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Env } from '../src/env';
import worker from '../src/index';
import { DigestCron, DigestMissingPiece } from '../src/site/waitlist-digest';
import { joinWaitlist } from '../src/site/waitlist-store';
import { CLOUDFLARE_SETTINGS, bindingFailingWith, recordingBinding } from './email-sign-in-client';
import { workerEnvWith } from './owner-client';
import { CLOCK_NOW } from './task-fixtures';

const ADMIN_ADDRESS = 'admin@todz.test';
const SITE_ORIGIN = 'https://todz.app';
const UNKNOWN_CRON = '*/5 * * * *';
const ESCAPING_ADDRESS = "o'brien&co@example.com";
const ESCAPED_ESCAPING_ADDRESS = 'o&#39;brien&amp;co@example.com';
const SINCE = CLOCK_NOW - MILLISECONDS_PER_DAY;
const REQUIRED_SETTINGS: Partial<Env> = { ...CLOUDFLARE_SETTINGS, ADMIN_EMAIL: ADMIN_ADDRESS, SITE_ORIGIN };

type ScheduledRun = { settings?: Partial<Env>; cron?: string; scheduledTime?: number };

async function runDigest({ settings = {}, cron = DigestCron.Daily, scheduledTime = CLOCK_NOW }: ScheduledRun): Promise<void> {
  await worker.scheduled(createScheduledController({ cron, scheduledTime }), workerEnvWith(settings));
}

async function digestSentBy({
  recording,
  settings = {},
}: {
  recording: ReturnType<typeof recordingBinding>;
  settings?: Partial<Env>;
}): Promise<void> {
  await runDigest({ settings: { ...REQUIRED_SETTINGS, EMAIL: recording.binding, ...settings } });
}

function directoryFailingToBatch(): D1Database {
  return new Proxy(env.DIRECTORY, {
    get(target, property) {
      const member = Reflect.get(target, property);
      if (typeof member !== 'function') return member;
      if (property === 'batch') return () => Promise.reject(new Error('the directory is down'));
      return (...parameters: unknown[]) => member.apply(target, parameters);
    },
  });
}

beforeEach(async () => {
  await env.DIRECTORY.prepare('DELETE FROM waitlist').run();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the scheduled waitlist digest', () => {
  test('mails the admin address one digest of the last 24 hours, the window closed at the run and open at its start', async () => {
    const recording = recordingBinding();
    await joinWaitlist({ database: env.DIRECTORY, address: 'old@example.com', now: SINCE });
    await joinWaitlist({ database: env.DIRECTORY, address: 'first@example.com', now: SINCE + MILLISECONDS_PER_HOUR });
    await joinWaitlist({ database: env.DIRECTORY, address: 'last@example.com', now: CLOCK_NOW });
    await joinWaitlist({ database: env.DIRECTORY, address: 'later@example.com', now: CLOCK_NOW + 1 });
    await digestSentBy({ recording });
    const [message, ...others] = recording.sent;
    expect(others).toEqual([]);
    expect(message?.to).toBe(ADMIN_ADDRESS);
    expect(message?.subject).toBe('Your todz waitlist: 2 new');
    expect(message?.text).toContain('3 on the list in all.');
    expect(message?.text).toContain('last@example.com\nfirst@example.com');
    expect(message?.text).not.toContain('old@example.com');
    expect(message?.text).not.toContain('later@example.com');
    expect(message?.html).toContain(`href="${SITE_ORIGIN}/admin"`);
  });

  test('still mails on an empty day, with the total', async () => {
    const recording = recordingBinding();
    await joinWaitlist({ database: env.DIRECTORY, address: 'old@example.com', now: SINCE - MILLISECONDS_PER_HOUR });
    await digestSentBy({ recording });
    const [message, ...others] = recording.sent;
    expect(others).toEqual([]);
    expect(message?.subject).toBe('Your todz waitlist: no one new');
    expect(message?.text).toContain('1 on the list in all.');
  });

  test('escapes an address in the html and keeps it as it is in the text', async () => {
    const recording = recordingBinding();
    await joinWaitlist({ database: env.DIRECTORY, address: ESCAPING_ADDRESS, now: CLOCK_NOW });
    await digestSentBy({ recording });
    const [message] = recording.sent;
    expect(message?.html).toContain(ESCAPED_ESCAPING_ADDRESS);
    expect(message?.html).not.toContain(ESCAPING_ADDRESS);
    expect(message?.text).toContain(ESCAPING_ADDRESS);
  });

  test.each([
    ['no admin address', { ADMIN_EMAIL: undefined }, DigestMissingPiece.AdminEmail],
    ['an admin address that is not an address', { ADMIN_EMAIL: 'not an address' }, DigestMissingPiece.AdminEmail],
    ['no site origin', { SITE_ORIGIN: undefined }, DigestMissingPiece.SiteOrigin],
    ['a site origin that is not an origin', { SITE_ORIGIN: 'todz.app/path' }, DigestMissingPiece.SiteOrigin],
    ['no mail binding', { EMAIL: undefined }, DigestMissingPiece.EmailSender],
    ['no sender kind', { EMAIL_SENDER: undefined }, DigestMissingPiece.EmailSender],
  ])('rejects naming the missing piece and sends nothing with %s', async (_name, settings, piece) => {
    const recording = recordingBinding();
    const output = vi.spyOn(console, 'log');
    const failure = digestSentBy({ recording, settings });
    await expect(failure).rejects.toThrow(piece);
    await expect(failure).rejects.not.toThrow(ADMIN_ADDRESS);
    expect(recording.sent).toEqual([]);
    expect(output).not.toHaveBeenCalled();
  });

  test('rejects with the console sender on the public site origin and sends nothing', async () => {
    const recording = recordingBinding();
    const output = vi.spyOn(console, 'log');
    await expect(digestSentBy({ recording, settings: { EMAIL_SENDER: 'console' } })).rejects.toThrow(DigestMissingPiece.EmailSender);
    expect(recording.sent).toEqual([]);
    expect(output).not.toHaveBeenCalled();
  });

  test('rejects an unknown cron and sends nothing', async () => {
    const recording = recordingBinding();
    const settings = { ...REQUIRED_SETTINGS, EMAIL: recording.binding };
    await expect(runDigest({ settings, cron: UNKNOWN_CRON })).rejects.toThrow(UNKNOWN_CRON);
    expect(recording.sent).toEqual([]);
  });

  test('rejects when the directory throws and sends nothing', async () => {
    const recording = recordingBinding();
    await expect(digestSentBy({ recording, settings: { DIRECTORY: directoryFailingToBatch() } })).rejects.toThrow('the directory is down');
    expect(recording.sent).toEqual([]);
  });

  test('rejects when the send throws', async () => {
    const recording = recordingBinding();
    await expect(
      digestSentBy({ recording, settings: { EMAIL: bindingFailingWith(new Error('the mail service is down')) } }),
    ).rejects.toThrow('the mail service is down');
  });
});
