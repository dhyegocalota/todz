import type { Verdict } from './report';

export enum ProbeEventKind {
  LaunchReady = 'launch-ready',
  Scroll = 'scroll',
  Footprint = 'footprint',
  TaskArrived = 'task-arrived',
}

export type ProbeEvent =
  | { kind: ProbeEventKind.LaunchReady; ms: number }
  | { kind: ProbeEventKind.Scroll; frames: number; overBudget: number; worstMs: number; refreshMs: number }
  | { kind: ProbeEventKind.Footprint; mb: number }
  | { kind: ProbeEventKind.TaskArrived; number: number; atMs: number };

export type AppCheck = { name: string; summary: string; verdict: Verdict };

export type Send = { number: number; sentAtMs: number };

export function probeEventsOf(_: string): ProbeEvent[] {
  throw new Error('probeEventsOf is not implemented');
}

export function launchCheck(_: ProbeEvent[]): AppCheck {
  throw new Error('launchCheck is not implemented');
}

export function scrollCheck(_: ProbeEvent[]): AppCheck {
  throw new Error('scrollCheck is not implemented');
}

export function footprintCheck(_: ProbeEvent[]): AppCheck {
  throw new Error('footprintCheck is not implemented');
}

export function arrivalLatencies(_: { sends: Send[]; events: ProbeEvent[] }): number[] {
  throw new Error('arrivalLatencies is not implemented');
}

export function arrivalCheck(_: number[]): AppCheck {
  throw new Error('arrivalCheck is not implemented');
}
