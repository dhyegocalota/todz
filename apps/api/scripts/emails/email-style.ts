import type { CSSProperties } from 'react';
import { EmailSlot } from '../../src/emails/email-slot';

export const HEADER_COLOR = '#0E1020';
const BRAND_COLOR = '#4764F5';
const BRAND_DEEP_COLOR = '#1B2A9E';
const ACCENT_COLOR = '#8CF7D0';
const TEXT_COLOR = '#161A33';
const MUTED_TEXT_COLOR = '#5B6285';
export const PAGE_COLOR = '#F2F4FA';
export const CARD_COLOR = '#FFFFFF';
const RULE_COLOR = '#E1E5F2';
const ON_BRAND_COLOR = '#FFFFFF';
const DARK_PAGE_COLOR = '#070812';
const DARK_CARD_COLOR = '#171A2E';
const DARK_TEXT_COLOR = '#F2F4FF';
const DARK_MUTED_TEXT_COLOR = '#A9B0D6';
const DARK_RULE_COLOR = '#2A2F4E';

export const COLOR_SCHEMES = 'light dark';
export const EMAIL_LOCKUP_URL = `${EmailSlot.Origin}/brand/todz-lockup.png`;
export const EMAIL_LOCKUP_WIDTH = 240;
export const EMAIL_LOCKUP_HEIGHT = 80;
export const EMAIL_FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const EMAIL_MONOSPACE_STACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";

export enum EmailClassName {
  Page = 'email-page',
  Card = 'email-card',
  Text = 'email-text',
  Muted = 'email-muted',
  Rule = 'email-rule',
  Link = 'email-link',
  StopLink = 'email-stop-link',
  Button = 'email-button',
}

export const DARK_MODE_CSS = [
  `:root { color-scheme: ${COLOR_SCHEMES}; supported-color-schemes: ${COLOR_SCHEMES}; }`,
  '@media (prefers-color-scheme: dark) {',
  `  .${EmailClassName.Page} { background-color: ${DARK_PAGE_COLOR} !important; }`,
  `  .${EmailClassName.Card} { background-color: ${DARK_CARD_COLOR} !important; border-color: ${DARK_RULE_COLOR} !important; }`,
  `  .${EmailClassName.Text} { color: ${DARK_TEXT_COLOR} !important; }`,
  `  .${EmailClassName.Muted} { color: ${DARK_MUTED_TEXT_COLOR} !important; }`,
  `  .${EmailClassName.Rule} { border-color: ${DARK_RULE_COLOR} !important; }`,
  `  .${EmailClassName.Link} { color: ${ACCENT_COLOR} !important; }`,
  `  .${EmailClassName.Button} { color: ${ON_BRAND_COLOR} !important; }`,
  '}',
].join('\n');

export const BODY_STYLE: CSSProperties = {
  backgroundColor: PAGE_COLOR,
  color: TEXT_COLOR,
  fontFamily: EMAIL_FONT_STACK,
  margin: 0,
  padding: 0,
};
export const PAGE_STYLE: CSSProperties = { backgroundColor: PAGE_COLOR, padding: '24px 12px' };
export const LOCKUP_STYLE: CSSProperties = { margin: '0 auto' };
export const CONTAINER_STYLE: CSSProperties = { maxWidth: '560px' };
export const HEADER_STYLE: CSSProperties = {
  backgroundColor: HEADER_COLOR,
  borderBottom: `3px solid ${ACCENT_COLOR}`,
  borderRadius: '16px 16px 0 0',
  padding: '16px 0',
  textAlign: 'center',
};
export const CARD_STYLE: CSSProperties = {
  backgroundColor: CARD_COLOR,
  border: `1px solid ${RULE_COLOR}`,
  borderRadius: '0 0 16px 16px',
  borderTop: 0,
};
export const CARD_CONTENT_STYLE: CSSProperties = { padding: '32px' };
export const HEADING_STYLE: CSSProperties = { color: TEXT_COLOR, fontSize: '26px', lineHeight: '34px', margin: '0 0 16px' };
export const PARAGRAPH_STYLE: CSSProperties = { color: TEXT_COLOR, fontSize: '16px', lineHeight: '24px', margin: '0 0 16px' };
export const ACTION_STYLE: CSSProperties = { margin: '8px 0 24px', textAlign: 'center' };
export const BUTTON_STYLE: CSSProperties = {
  backgroundColor: BRAND_COLOR,
  backgroundImage: `linear-gradient(135deg, ${BRAND_COLOR}, ${BRAND_DEEP_COLOR})`,
  borderRadius: '999px',
  color: ON_BRAND_COLOR,
  fontSize: '16px',
  fontWeight: 600,
  padding: '14px 32px',
  textDecoration: 'none',
};
export const CODE_STYLE: CSSProperties = {
  color: TEXT_COLOR,
  fontFamily: EMAIL_MONOSPACE_STACK,
  fontSize: '34px',
  fontWeight: 700,
  letterSpacing: '10px',
  lineHeight: '44px',
  margin: '0 0 24px',
  textAlign: 'center',
};
export const LINK_STYLE: CSSProperties = { color: BRAND_COLOR, fontSize: '14px', wordBreak: 'break-all' };
export const RULE_STYLE: CSSProperties = { borderColor: RULE_COLOR, margin: '24px 0' };
export const FOOTER_STYLE: CSSProperties = { color: MUTED_TEXT_COLOR, fontSize: '13px', lineHeight: '20px', margin: 0 };
export const FOOTER_LINK_STYLE: CSSProperties = { color: BRAND_COLOR, fontSize: '13px' };
export const MUTED_STYLE: CSSProperties = { color: MUTED_TEXT_COLOR, fontSize: '14px', lineHeight: '22px', margin: '0 0 4px' };
