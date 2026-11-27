import type { Language } from '@todz/types';

export type OwnerRecord = {
  id: string;
  timeZone: string;
  agentNudge: boolean;
  dayEmail: boolean;
  dayEmailMinutes: number;
  language: Language;
};

export type WorkspaceRecord = { id: string; name: string; createdAt: number; lastActivityAt: number | null };

export type ProjectRecord = { id: string; name: string; isInbox: boolean; createdAt: number };
