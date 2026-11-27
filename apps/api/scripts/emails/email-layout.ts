import { Body, Column, Container, Head, Hr, Html, Img, Link, Preview, Row, Section, Text } from 'react-email';
import { LANGUAGE_PROFILES, type Language } from '@todz/types';
import { createElement, type PropsWithChildren, type ReactElement, type ReactNode } from 'react';
import { EMAIL_BRAND_NAME } from './email-layout-copy';
import {
  BODY_STYLE,
  CARD_COLOR,
  CARD_CONTENT_STYLE,
  CARD_STYLE,
  COLOR_SCHEMES,
  CONTAINER_STYLE,
  DARK_MODE_CSS,
  EMAIL_LOCKUP_HEIGHT,
  EMAIL_LOCKUP_URL,
  EMAIL_LOCKUP_WIDTH,
  EmailClassName,
  FOOTER_LINK_STYLE,
  FOOTER_STYLE,
  HEADER_COLOR,
  HEADER_STYLE,
  LOCKUP_STYLE,
  PAGE_COLOR,
  PAGE_STYLE,
  RULE_STYLE,
} from './email-style';

type FooterLink = { href: string; label: string };

export type EmailLayoutProps = PropsWithChildren<{
  language: Language;
  title: string;
  preview: string;
  footer: string;
  footerLink?: FooterLink;
}>;

const FOOTER_LINK_CLASS_NAME = `${EmailClassName.Link} ${EmailClassName.StopLink}`;
const FOOTER_LINK_SEPARATOR = ' ';

function footerLinkNodes(footerLink: FooterLink | undefined): ReactNode[] {
  if (footerLink === undefined) return [];
  const link = createElement(
    Link,
    { href: footerLink.href, className: FOOTER_LINK_CLASS_NAME, style: FOOTER_LINK_STYLE },
    footerLink.label,
  );
  return [FOOTER_LINK_SEPARATOR, link];
}

export function EmailLayout(props: EmailLayoutProps): ReactElement {
  return createElement(
    Html,
    { lang: LANGUAGE_PROFILES[props.language].htmlLang },
    createElement(
      Head,
      null,
      createElement('title', null, props.title),
      createElement('meta', { name: 'color-scheme', content: COLOR_SCHEMES }),
      createElement('meta', { name: 'supported-color-schemes', content: COLOR_SCHEMES }),
      createElement('style', null, DARK_MODE_CSS),
    ),
    createElement(Preview, null, props.preview),
    createElement(
      Body,
      { className: EmailClassName.Page, style: BODY_STYLE },
      createElement(
        Section,
        { className: EmailClassName.Page, style: PAGE_STYLE, bgcolor: PAGE_COLOR },
        createElement(
          Container,
          { style: CONTAINER_STYLE },
          createElement(
            Section,
            { style: HEADER_STYLE, bgcolor: HEADER_COLOR },
            createElement(Img, {
              src: EMAIL_LOCKUP_URL,
              width: EMAIL_LOCKUP_WIDTH,
              height: EMAIL_LOCKUP_HEIGHT,
              alt: EMAIL_BRAND_NAME,
              style: LOCKUP_STYLE,
            }),
          ),
          createElement(
            Section,
            { className: EmailClassName.Card, style: CARD_STYLE, bgcolor: CARD_COLOR },
            createElement(
              Row,
              null,
              createElement(
                Column,
                { style: CARD_CONTENT_STYLE },
                props.children,
                createElement(Hr, { className: EmailClassName.Rule, style: RULE_STYLE }),
                createElement(
                  Text,
                  { className: EmailClassName.Muted, style: FOOTER_STYLE },
                  props.footer,
                  ...footerLinkNodes(props.footerLink),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
