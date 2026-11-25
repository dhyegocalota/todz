import { describe, expect, test } from 'vitest';
import { isAutomaticReply } from '../../src/day-email/reply-automatic';
import { parsedHeadersOf } from '../fixtures/day-email/raw-message';

describe('isAutomaticReply', () => {
  test.each([
    ['Auto-Submitted: auto-replied'],
    ['Auto-Submitted: auto-generated'],
    ['Auto-Submitted: AUTO-REPLIED'],
    ['Auto-Submitted: auto-replied; reason=vacation'],
    ['X-Autoreply: yes'],
    ['X-Autorespond: x'],
    ['Precedence: bulk'],
    ['Precedence: junk'],
    ['Precedence: list'],
    ['Precedence: auto_reply'],
    ['Precedence: BULK'],
    ['Precedence:  Auto_Reply '],
  ])('%s is automatic', async (header) => {
    expect(isAutomaticReply(await parsedHeadersOf([header]))).toBe(true);
  });

  test.each([['Auto-Submitted: no'], ['Auto-Submitted: NO'], ['Precedence: first-class'], ['Subject: Precedence: bulk'], ['X-Mailer: x']])(
    '%s is not automatic',
    async (header) => {
      expect(isAutomaticReply(await parsedHeadersOf([header]))).toBe(false);
    },
  );

  test('a message with no headers of the kind is not automatic', async () => {
    expect(isAutomaticReply(await parsedHeadersOf(['From: owner@gmail.com']))).toBe(false);
  });
});
