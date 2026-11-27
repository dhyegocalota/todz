import { Button, Heading, Link, Section, Text } from 'react-email';
import { createElement, type ReactElement } from 'react';
import { EmailSlot } from '../../src/emails/email-slot';
import type { GeneratedEmail } from '../../src/emails/generated-email';
import { OAUTH_SIGN_IN_EMAIL_COPY } from './oauth-sign-in-email-copy';
import { EmailLayout } from './email-layout';
import { ACTION_STYLE, BUTTON_STYLE, EmailClassName, HEADING_STYLE, LINK_STYLE, MUTED_STYLE, PARAGRAPH_STYLE } from './email-style';
import { renderEmail } from './render-email';

export function OAuthSignInTemplate(): ReactElement {
  return createElement(
    EmailLayout,
    { title: OAUTH_SIGN_IN_EMAIL_COPY.subject, preview: OAUTH_SIGN_IN_EMAIL_COPY.preview, footer: OAUTH_SIGN_IN_EMAIL_COPY.footer },
    createElement(Heading, { as: 'h1', className: EmailClassName.Text, style: HEADING_STYLE }, OAUTH_SIGN_IN_EMAIL_COPY.heading),
    createElement(Text, { className: EmailClassName.Text, style: PARAGRAPH_STYLE }, OAUTH_SIGN_IN_EMAIL_COPY.intro),
    createElement(
      Section,
      { style: ACTION_STYLE },
      createElement(
        Button,
        { href: EmailSlot.Link, className: EmailClassName.Button, style: BUTTON_STYLE },
        OAUTH_SIGN_IN_EMAIL_COPY.action,
      ),
    ),
    createElement(Text, { className: EmailClassName.Muted, style: MUTED_STYLE }, OAUTH_SIGN_IN_EMAIL_COPY.fallback),
    createElement(
      Text,
      { style: MUTED_STYLE },
      createElement(Link, { href: EmailSlot.Link, className: EmailClassName.Link, style: LINK_STYLE }, EmailSlot.Link),
    ),
  );
}

export async function generatedOAuthSignInEmail(): Promise<GeneratedEmail> {
  const rendered = await renderEmail({ element: createElement(OAuthSignInTemplate) });
  return { subject: OAUTH_SIGN_IN_EMAIL_COPY.subject, ...rendered };
}
