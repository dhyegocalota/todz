import { Button, Heading, Link, Section, Text } from 'react-email';
import { createElement, type ReactElement } from 'react';
import { EmailSlot } from '../../src/emails/email-slot';
import type { GeneratedEmail } from '../../src/emails/generated-email';
import { ADMIN_SIGN_IN_EMAIL_COPY } from './admin-sign-in-email-copy';
import { EmailLayout } from './email-layout';
import { ACTION_STYLE, BUTTON_STYLE, EmailClassName, HEADING_STYLE, LINK_STYLE, MUTED_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';

export function AdminSignInTemplate(): ReactElement {
  return createElement(
    EmailLayout,
    { title: ADMIN_SIGN_IN_EMAIL_COPY.subject, preview: ADMIN_SIGN_IN_EMAIL_COPY.preview, footer: ADMIN_SIGN_IN_EMAIL_COPY.footer },
    createElement(Heading, { as: 'h1', className: EmailClassName.Text, style: HEADING_STYLE }, ADMIN_SIGN_IN_EMAIL_COPY.heading),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, ADMIN_SIGN_IN_EMAIL_COPY.intro),
    createElement(
      Section,
      { style: ACTION_STYLE },
      createElement(
        Button,
        { href: EmailSlot.Link, className: EmailClassName.Button, style: BUTTON_STYLE },
        ADMIN_SIGN_IN_EMAIL_COPY.action,
      ),
    ),
    createElement(Text, { className: EmailClassName.Muted, style: MUTED_STYLE }, ADMIN_SIGN_IN_EMAIL_COPY.fallback),
    createElement(
      Text,
      { style: MUTED_STYLE },
      createElement(Link, { href: EmailSlot.Link, className: EmailClassName.Link, style: LINK_STYLE }, EmailSlot.Link),
    ),
  );
}

export async function generatedAdminSignInEmail(): Promise<GeneratedEmail> {
  const rendered = await renderEmail({ element: createElement(AdminSignInTemplate) });
  return { subject: ADMIN_SIGN_IN_EMAIL_COPY.subject, ...rendered };
}
