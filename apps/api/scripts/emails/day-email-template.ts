import { Heading, Text } from 'react-email';
import { createElement, type ReactElement } from 'react';
import { EmailSlot } from '../../src/emails/email-slot';
import type { GeneratedEmail } from '../../src/emails/generated-email';
import { DAY_EMAIL_COPY, DAY_EMAIL_EMPTY_COPY } from './day-email-copy';
import { EmailLayout } from './email-layout';
import { EmailClassName, HEADING_STYLE, MUTED_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';

type DayEmailCopy = typeof DAY_EMAIL_COPY;

const TASKS_STYLE = { ...PARAGRAPH_STYLE, whiteSpace: 'pre-line' } as const;

function DayEmailTemplate({ copy, hasTasks }: { copy: DayEmailCopy; hasTasks: boolean }): ReactElement {
  const taskElements = [
    createElement(Text, { key: 'tasks', className: EmailClassName.Text, style: TASKS_STYLE }, EmailSlot.Tasks),
    createElement(Text, { key: 'more', className: EmailClassName.Muted, style: MUTED_STYLE }, EmailSlot.More),
  ];
  return createElement(
    EmailLayout,
    { title: copy.subject, preview: copy.preview, footer: copy.footer },
    createElement(Heading, { as: 'h1', className: EmailClassName.Text, style: HEADING_STYLE }, copy.heading),
    ...(hasTasks ? taskElements : []),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, copy.replyHint),
  );
}

async function generatedDayEmail({ copy, hasTasks }: { copy: DayEmailCopy; hasTasks: boolean }): Promise<GeneratedEmail> {
  const rendered = await renderEmail({ element: createElement(DayEmailTemplate, { copy, hasTasks }) });
  return { subject: copy.subject, ...rendered };
}

export function generatedDayEmailWithTasks(): Promise<GeneratedEmail> {
  return generatedDayEmail({ copy: DAY_EMAIL_COPY, hasTasks: true });
}

export function generatedDayEmailEmpty(): Promise<GeneratedEmail> {
  return generatedDayEmail({ copy: DAY_EMAIL_EMPTY_COPY, hasTasks: false });
}
