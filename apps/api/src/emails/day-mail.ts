import type { EmailMessage } from '../email-sender';

export type DayMailTask = { number: number; title: string; workspaceName: string; projectName: string; isOverdue: boolean };

type DayMailInput = {
  to: string;
  replyTo: string;
  origin: string;
  tasks: DayMailTask[];
  count: number;
  workspaceName: string;
  hasSeveralWorkspaces: boolean;
  minutes: number;
};

export function dayMail(input: DayMailInput): EmailMessage {
  throw new Error(`dayMail is not implemented for ${input.to}`);
}
