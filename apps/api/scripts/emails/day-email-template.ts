import type { Language } from '@todz/types';
import { Heading, Text } from 'react-email';
import { createElement, type ReactElement } from 'react';
import { EmailSlot } from '../../src/emails/email-slot';
import type { GeneratedEmail } from '../../src/emails/generated-email';
import type { DayEmailCopy } from './day-email-copy';
import { EmailLayout } from './email-layout';
import { EmailClassName, HEADING_STYLE, MUTED_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';

type DayEmailTemplateInput = { copy: DayEmailCopy; language: Language; hasTasks: boolean };

const TASKS_STYLE = { ...PARAGRAPH_STYLE, whiteSpace: 'pre-line' } as const;

function DayEmailTemplate({ copy, language, hasTasks }: DayEmailTemplateInput): ReactElement {
  const taskElements = [
    createElement(Text, { key: 'tasks', className: EmailClassName.Text, style: TASKS_STYLE }, EmailSlot.Tasks),
    createElement(Text, { key: 'more', className: EmailClassName.Muted, style: MUTED_STYLE }, EmailSlot.More),
  ];
  return createElement(
    EmailLayout,
    {
      language,
      title: copy.subject,
      preview: copy.preview,
      footer: copy.footer,
      footerLink: { href: EmailSlot.StopUrl, label: copy.stopLabel },
    },
    createElement(Heading, { as: 'h1', className: EmailClassName.Text, style: HEADING_STYLE }, copy.heading),
    ...(hasTasks ? taskElements : []),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, copy.replyHint),
  );
}

async function generatedDayEmail({ copy, language, hasTasks }: DayEmailTemplateInput): Promise<GeneratedEmail> {
  const rendered = await renderEmail({ element: createElement(DayEmailTemplate, { copy, language, hasTasks }) });
  return { subject: copy.subject, ...rendered };
}

export function generatedDayEmailWithTasks({ copy, language }: { copy: DayEmailCopy; language: Language }): Promise<GeneratedEmail> {
  return generatedDayEmail({ copy, language, hasTasks: true });
}

export function generatedDayEmailEmpty({ copy, language }: { copy: DayEmailCopy; language: Language }): Promise<GeneratedEmail> {
  return generatedDayEmail({ copy, language, hasTasks: false });
}
