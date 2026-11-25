import { DAY_EMAIL_LINES_MAX, MINUTES_PER_HOUR, TASK_SHORT_ID_PREFIX } from '@todz/types';
import type { EmailMessage } from '../email-sender';
import { DAY_MAIL_COPY } from './day-mail-copy';
import { EmailSlot, type EmailSlotValues, filledTextOf } from './email-slot';
import { filledEmailOf } from './filled-email';
import type { GeneratedEmail } from './generated-email';
import { DAY_EMAIL, DAY_EMAIL_EMPTY } from './generated/email-templates';

export type DayMailTask = { number: number; title: string; workspaceName: string; projectName: string; isOverdue: boolean };

type DayMailInput = {
  to: string;
  replyTo: string;
  origin: string;
  stopToken: string;
  tasks: DayMailTask[];
  count: number;
  workspaceName: string;
  hasSeveralWorkspaces: boolean;
  minutes: number;
};

enum MailHeader {
  AutoSubmitted = 'Auto-Submitted',
}

const AUTO_GENERATED = 'auto-generated';
const LINE_SEPARATOR = '\n';
const NO_MORE_TASKS = '';
const TIME_SEPARATOR = ':';
const TIME_PART_LENGTH = 2;
const TIME_PART_FILL = '0';
const NO_OVERDUE_MARK = '';
const BLANK_LINE_RUN = /\n{3,}/g;
const BLANK_LINE = '\n\n';

function timeOf(minutes: number): string {
  const parts = [Math.floor(minutes / MINUTES_PER_HOUR), minutes % MINUTES_PER_HOUR];
  return parts.map((part) => String(part).padStart(TIME_PART_LENGTH, TIME_PART_FILL)).join(TIME_SEPARATOR);
}

function lineOf({ task, hasSeveralWorkspaces }: { task: DayMailTask; hasSeveralWorkspaces: boolean }): string {
  const projectNames = hasSeveralWorkspaces ? [task.workspaceName, task.projectName] : [task.projectName];
  const overdueMark = task.isOverdue ? DAY_MAIL_COPY.overdue : NO_OVERDUE_MARK;
  const label = `${TASK_SHORT_ID_PREFIX}${task.number} ${task.title}`;
  return `${label}${DAY_MAIL_COPY.lineSeparator}${projectNames.join(DAY_MAIL_COPY.workspaceSeparator)}${overdueMark}`;
}

function moreSentenceOf(moreTasks: number): string {
  if (moreTasks === 0) return NO_MORE_TASKS;
  return DAY_MAIL_COPY.moreTasks(moreTasks);
}

function valuesOf(input: DayMailInput): EmailSlotValues {
  const lines = input.tasks.slice(0, DAY_EMAIL_LINES_MAX).map((task) => lineOf({ task, hasSeveralWorkspaces: input.hasSeveralWorkspaces }));
  return {
    [EmailSlot.Count]: String(input.count),
    [EmailSlot.Tasks]: lines.join(LINE_SEPARATOR),
    [EmailSlot.More]: moreSentenceOf(input.count - lines.length),
    [EmailSlot.Workspace]: input.workspaceName,
    [EmailSlot.Time]: timeOf(input.minutes),
    [EmailSlot.Origin]: input.origin,
  };
}

function subjectOf({ email, values }: { email: GeneratedEmail; values: EmailSlotValues }): string {
  return filledTextOf({ text: email.subject, values });
}

export function dayMail(input: DayMailInput): EmailMessage {
  const email = input.count === 0 ? DAY_EMAIL_EMPTY : DAY_EMAIL;
  const values = valuesOf(input);
  const message = filledEmailOf({ email, values, to: input.to, subject: subjectOf({ email, values }), replyTo: input.replyTo });
  return { ...message, text: message.text.replace(BLANK_LINE_RUN, BLANK_LINE), headers: { [MailHeader.AutoSubmitted]: AUTO_GENERATED } };
}
