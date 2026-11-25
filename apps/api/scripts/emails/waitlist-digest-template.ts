import { Button, Heading, Section, Text } from 'react-email';
import { createElement, type ReactElement } from 'react';
import { EmailSlot } from '../../src/emails/email-slot';
import type { GeneratedEmail } from '../../src/emails/generated-email';
import { EmailLayout } from './email-layout';
import { ACTION_STYLE, BUTTON_STYLE, EmailClassName, HEADING_STYLE, MUTED_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';
import { WAITLIST_DIGEST_EMAIL_COPY, WAITLIST_DIGEST_EMPTY_EMAIL_COPY } from './waitlist-digest-email-copy';

type WaitlistDigestCopy = typeof WAITLIST_DIGEST_EMAIL_COPY;

const ADDRESSES_STYLE = { ...PARAGRAPH_STYLE, whiteSpace: 'pre-line' } as const;

function WaitlistDigestTemplate({ copy, hasAddresses }: { copy: WaitlistDigestCopy; hasAddresses: boolean }): ReactElement {
  const addressElements = [
    createElement(Text, { key: 'addresses', className: EmailClassName.Text, style: ADDRESSES_STYLE }, EmailSlot.Addresses),
    createElement(Text, { key: 'more', className: EmailClassName.Muted, style: MUTED_STYLE }, EmailSlot.More),
  ];
  return createElement(
    EmailLayout,
    { title: copy.subject, preview: copy.preview, footer: copy.footer },
    createElement(Heading, { as: 'h1', className: EmailClassName.Text, style: HEADING_STYLE }, copy.heading),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, copy.total),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, copy.failed),
    ...(hasAddresses ? addressElements : []),
    createElement(
      Section,
      { style: ACTION_STYLE },
      createElement(Button, { href: EmailSlot.Link, className: EmailClassName.Button, style: BUTTON_STYLE }, copy.action),
    ),
  );
}

async function generatedDigestEmail({ copy, hasAddresses }: { copy: WaitlistDigestCopy; hasAddresses: boolean }): Promise<GeneratedEmail> {
  const rendered = await renderEmail({ element: createElement(WaitlistDigestTemplate, { copy, hasAddresses }) });
  return { subject: copy.subject, ...rendered };
}

export function generatedWaitlistDigestEmail(): Promise<GeneratedEmail> {
  return generatedDigestEmail({ copy: WAITLIST_DIGEST_EMAIL_COPY, hasAddresses: true });
}

export function generatedWaitlistDigestEmptyEmail(): Promise<GeneratedEmail> {
  return generatedDigestEmail({ copy: WAITLIST_DIGEST_EMPTY_EMAIL_COPY, hasAddresses: false });
}
