import { MILLISECONDS_PER_DAY } from '@todz/types';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ScheduledCron } from '../src/scheduled';
import { joinWaitlistWithinLimit } from '../src/site/waitlist-store';
import { resetDayEmails, seedDayOwner, tick } from './day-email/day-email-client';
import { CLOUDFLARE_SETTINGS, recordingBinding } from './email-sign-in-client';
import { CLOCK_NOW } from './task-fixtures';

const ADMIN_ADDRESS = 'admin@todz.test';
const DIGEST_SETTINGS = { ...CLOUDFLARE_SETTINGS, ADMIN_EMAIL: ADMIN_ADDRESS, SITE_ORIGIN: 'https://todz.app' };
const UNKNOWN_CRON = '*/5 * * * *';
const SEVEN_O_CLOCK_IN_UTC = Date.parse('2026-11-24T07:00:00Z');

beforeEach(async () => {
  await resetDayEmails();
  await env.DIRECTORY.prepare('DELETE FROM waitlist').run();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the scheduled dispatch', () => {
  test('the digest cron sends the digest and no day email, even for an owner who is due', async () => {
    const recording = recordingBinding();
    const owner = await seedDayOwner();
    await joinWaitlistWithinLimit({ database: env.DIRECTORY, address: 'new@example.com', now: CLOCK_NOW - MILLISECONDS_PER_DAY / 2 });
    await tick({ recording, settings: DIGEST_SETTINGS, cron: ScheduledCron.WaitlistDigest, scheduledTime: SEVEN_O_CLOCK_IN_UTC });
    expect(recording.sent.map((message) => message.to)).toEqual([ADMIN_ADDRESS]);
    expect(recording.sent.map((message) => message.to)).not.toContain(owner.address);
  });

  test('the day email cron sends no digest', async () => {
    const recording = recordingBinding();
    await seedDayOwner();
    await joinWaitlistWithinLimit({ database: env.DIRECTORY, address: 'new@example.com', now: SEVEN_O_CLOCK_IN_UTC - 1 });
    await tick({ recording, settings: DIGEST_SETTINGS, cron: ScheduledCron.DayEmail, scheduledTime: SEVEN_O_CLOCK_IN_UTC });
    expect(recording.sent.map((message) => message.to)).not.toContain(ADMIN_ADDRESS);
    expect(recording.sent).toHaveLength(1);
  });

  test('an unknown cron rejects naming it and sends nothing', async () => {
    const recording = recordingBinding();
    await seedDayOwner();
    await expect(tick({ recording, cron: UNKNOWN_CRON, scheduledTime: SEVEN_O_CLOCK_IN_UTC })).rejects.toThrow(UNKNOWN_CRON);
    expect(recording.sent).toEqual([]);
  });
});
