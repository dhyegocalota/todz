import type { Client } from '@modelcontextprotocol/client';
import type { ScenarioKind } from './scenario-kind';
import type { Sample } from './timed-fetch';

export enum McpEra {
  Legacy = 'legacy',
  Modern = 'modern',
}

export type McpAccess = { origin: string; key: string; era: McpEra; fetch: typeof fetch };

export type ListedTask = { number: number; title: string };

export type ListAnswer = { totalMatched: number; tasks: ListedTask[] };

export function connectMeasuredMcp(
  _: McpAccess & { now: () => number; scenario: ScenarioKind; record: (sample: Sample) => void },
): Promise<Client> {
  throw new Error('connectMeasuredMcp is not implemented');
}

export function measureInitialize(
  _: Omit<McpAccess, 'era'> & { now: () => number; record: (sample: Sample) => void; count: number },
): Promise<void> {
  throw new Error('measureInitialize is not implemented');
}

export function listTasks(_: { client: Client; text?: string; limit?: number }): Promise<ListAnswer> {
  throw new Error('listTasks is not implemented');
}

export function addTask(_: { client: Client; title: string; idempotencyKey: string }): Promise<number> {
  throw new Error('addTask is not implemented');
}

export function completeTasks(_: { client: Client; numbers: number[] }): Promise<void> {
  throw new Error('completeTasks is not implemented');
}
