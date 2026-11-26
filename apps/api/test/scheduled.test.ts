import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ScheduledCron } from '../src/scheduled';
import { resetDayEmails, seedDayOwner, tick } from './day-email/day-email-client';
import { CLOUDFLARE_SETTINGS, recordingBinding } from './email-sign-in-client';

const ADMIN_ADDRESS = 'admin@todz.test';
const ADMIN_SETTINGS = { ...CLOUDFLARE_SETTINGS, ADMIN_EMAIL: ADMIN_ADDRESS, SITE_ORIGIN: 'https://todz.app' };
const FORMER_DIGEST_CRON = '0 11 * * *';
const UNKNOWN_CRON = '*/5 * * * *';
const SEVEN_O_CLOCK_IN_UTC = Date.parse('2026-11-24T07:00:00Z');

beforeEach(async () => {
  await resetDayEmails();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the scheduled dispatch', () => {
  test('the day email cron sends the day email and nothing to the admin', async () => {
    const recording = recordingBinding();
    await seedDayOwner();
    await tick({ recording, settings: ADMIN_SETTINGS, cron: ScheduledCron.DayEmail, scheduledTime: SEVEN_O_CLOCK_IN_UTC });
    expect(recording.sent.map((message) => message.to)).not.toContain(ADMIN_ADDRESS);
    expect(recording.sent).toHaveLength(1);
  });

  test('the former digest cron rejects naming it and sends nothing', async () => {
    const recording = recordingBinding();
    await seedDayOwner();
    await expect(
      tick({ recording, settings: ADMIN_SETTINGS, cron: FORMER_DIGEST_CRON, scheduledTime: SEVEN_O_CLOCK_IN_UTC }),
    ).rejects.toThrow(FORMER_DIGEST_CRON);
    expect(recording.sent).toEqual([]);
  });

  test('an unknown cron rejects naming it and sends nothing', async () => {
    const recording = recordingBinding();
    await seedDayOwner();
    await expect(tick({ recording, cron: UNKNOWN_CRON, scheduledTime: SEVEN_O_CLOCK_IN_UTC })).rejects.toThrow(UNKNOWN_CRON);
    expect(recording.sent).toEqual([]);
  });
});
