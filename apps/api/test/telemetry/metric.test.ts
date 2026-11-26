import { describe, expect, test } from 'vitest';
import {
  AgentClient,
  Metric,
  NO_DIMENSION,
  OTHER_DIMENSION,
  UNKNOWN_MACOS,
  UsageEvent,
  agentClientOf,
  dimensionOf,
} from '../../src/telemetry/metric';
import { sparkleClientOf } from '../../src/telemetry/sparkle-user-agent';
import { utcDayOf, utcDayStartOf } from '../../src/telemetry/telemetry-day';
import { isTelemetryOn } from '../../src/telemetry/telemetry-mode';

const SPARKLE_AGENT = 'Todz/0.2.1 Sparkle/2.6.4 macOS/15';
const OVERLONG_AGENT = `Todz/0.2.1 Sparkle/2.6.4 macOS/15 ${'x'.repeat(300)}`;

describe('the dimension allow-lists', () => {
  test.each([
    ['claude-code', AgentClient.ClaudeCode],
    ['Claude Code 1.2.3', AgentClient.ClaudeCode],
    ['codex-mcp-client', AgentClient.Codex],
    ['cursor-vscode', AgentClient.Cursor],
    ['my-private-bot', AgentClient.Other],
    ['maria@example.com', AgentClient.Other],
  ])('the agent client %j is %j', (clientName, expected) => {
    expect(agentClientOf(clientName)).toBe(expected);
    expect(dimensionOf({ metric: Metric.AgentWrites, candidate: clientName })).toBe(expected);
  });

  test.each([
    [UsageEvent.PopoverOpened, UsageEvent.PopoverOpened],
    ['screen_time', OTHER_DIMENSION],
  ])('the usage event %j is stored as %j', (candidate, expected) => {
    expect(dimensionOf({ metric: Metric.UsageEvents, candidate })).toBe(expected);
  });

  test.each([
    ['0.2.1|15', '0.2.1|15'],
    [`0.2.1|${UNKNOWN_MACOS}`, `0.2.1|${UNKNOWN_MACOS}`],
    ['Todz/0.2.1 Sparkle/2.6.4', OTHER_DIMENSION],
    ['0.2.1|15|maria@example.com', OTHER_DIMENSION],
  ])('the app version dimension %j is stored as %j', (candidate, expected) => {
    expect(dimensionOf({ metric: Metric.AppcastRequests, candidate })).toBe(expected);
    expect(dimensionOf({ metric: Metric.UsageVersions, candidate })).toBe(expected);
  });

  test.each([Metric.OwnersTotal, Metric.TasksAdded, Metric.DayMailsSent, Metric.UsageRollups])('%s has no dimension at all', (metric) => {
    expect(dimensionOf({ metric, candidate: 'anything' })).toBe(NO_DIMENSION);
  });
});

describe('the Sparkle user agent', () => {
  test('the app version and the macOS major version are read', () => {
    expect(sparkleClientOf(SPARKLE_AGENT)).toEqual({ appVersion: '0.2.1', macosMajor: '15' });
  });

  test('a user agent without a system version is counted as unknown', () => {
    expect(sparkleClientOf('Todz/0.2.1 Sparkle/2.6.4')).toEqual({ appVersion: '0.2.1', macosMajor: UNKNOWN_MACOS });
  });

  test.each([null, '', 'Mozilla/5.0 (Macintosh)', 'Todz/dev Sparkle/2.6.4', `${SPARKLE_AGENT} extra`, OVERLONG_AGENT])(
    'the user agent %j is not an app client',
    (userAgent) => {
      expect(sparkleClientOf(userAgent)).toBeNull();
    },
  );
});

describe('the UTC day', () => {
  test('a moment belongs to its UTC day', () => {
    expect(utcDayOf(Date.UTC(2026, 10, 26, 23, 59, 59))).toBe('2026-11-26');
    expect(utcDayStartOf(Date.UTC(2026, 10, 26, 23, 59, 59))).toBe(Date.UTC(2026, 10, 26));
  });
});

describe('the self-host default', () => {
  test('an unset variable is off', () => {
    expect(isTelemetryOn({ TELEMETRY: undefined })).toBe(false);
  });

  test.each(['off', '', 'true', '1', 'ON'])('the value %j is off', (value) => {
    expect(isTelemetryOn({ TELEMETRY: value })).toBe(false);
  });

  test('only the value on turns it on', () => {
    expect(isTelemetryOn({ TELEMETRY: 'on' })).toBe(true);
  });
});
