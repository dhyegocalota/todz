import type { Language } from '@todz/types';
import { Button, Heading, Link, Section, Text } from 'react-email';
import { createElement, type ReactElement } from 'react';
import { EmailSlot } from '../../src/emails/email-slot';
import type { GeneratedEmail } from '../../src/emails/generated-email';
import { EmailLayout } from './email-layout';
import { ACTION_STYLE, BUTTON_STYLE, EmailClassName, HEADING_STYLE, LINK_STYLE, MUTED_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';
import type { SignInEmailCopy } from './sign-in-email-copy';

type SignInTemplateInput = { copy: SignInEmailCopy; language: Language };

export function SignInTemplate({ copy, language }: SignInTemplateInput): ReactElement {
  return createElement(
    EmailLayout,
    { language, title: copy.subject, preview: copy.preview, footer: copy.footer },
    createElement(Heading, { as: 'h1', className: EmailClassName.Text, style: HEADING_STYLE }, copy.heading),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, copy.intro),
    createElement(
      Section,
      { style: ACTION_STYLE },
      createElement(Button, { href: EmailSlot.Link, className: EmailClassName.Button, style: BUTTON_STYLE }, copy.action),
    ),
    createElement(Text, { className: EmailClassName.Muted, style: MUTED_STYLE }, copy.fallback),
    createElement(
      Text,
      { style: MUTED_STYLE },
      createElement(Link, { href: EmailSlot.Link, className: EmailClassName.Link, style: LINK_STYLE }, EmailSlot.Link),
    ),
  );
}

export async function generatedSignInEmail({ copy, language }: SignInTemplateInput): Promise<GeneratedEmail> {
  const rendered = await renderEmail({ element: createElement(SignInTemplate, { copy, language }) });
  return { subject: copy.subject, ...rendered };
}
