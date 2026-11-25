import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EmailSlot, filledHtmlOf } from '../../src/emails/email-slot';
import { EmailTemplateName, GENERATED_EMAILS_PATH, generatedEmailsOf, generatedEmailsSource } from './generated-emails';

enum EmailsCliMode {
  Generate = 'generate',
  Check = 'check',
  Preview = 'preview',
}

const FAILURE_EXIT_CODE = 1;
const SUCCESS_EXIT_CODE = 0;
const STALE_MESSAGE = `${GENERATED_EMAILS_PATH} is stale; run pnpm emails:generate`;
const PREVIEW_DIRECTORY = fileURLToPath(new URL('../../../../.pr-media/emails/', import.meta.url));
const PREVIEW_VALUES = {
  [EmailSlot.Link]: 'http://localhost:8787/sign-in#token=preview-only-not-a-token',
  [EmailSlot.Email]: 'maria@example.com',
  [EmailSlot.Origin]: 'http://localhost:8787',
  [EmailSlot.Joined]: '2',
  [EmailSlot.Total]: '42',
  [EmailSlot.Failed]: '1',
  [EmailSlot.Addresses]: 'maria@example.com\njoao@example.com',
  [EmailSlot.More]: 'and 3 more.',
  [EmailSlot.Count]: '3',
  [EmailSlot.Tasks]: 'T-12 Review the release notes · Inbox · overdue\nT-4 Call the bank · Home\nT-31 Ship the beta · Work / todz',
  [EmailSlot.Workspace]: 'Personal',
  [EmailSlot.Time]: '07:00',
};

async function generate(): Promise<number> {
  writeFileSync(GENERATED_EMAILS_PATH, await generatedEmailsSource());
  console.log(`wrote ${GENERATED_EMAILS_PATH}`);
  return SUCCESS_EXIT_CODE;
}

function staleExitCode(): number {
  console.error(STALE_MESSAGE);
  return FAILURE_EXIT_CODE;
}

async function check(): Promise<number> {
  if (!existsSync(GENERATED_EMAILS_PATH)) return staleExitCode();
  const current = readFileSync(GENERATED_EMAILS_PATH, 'utf8');
  if (current === (await generatedEmailsSource())) return SUCCESS_EXIT_CODE;
  return staleExitCode();
}

async function preview(): Promise<number> {
  const emails = await generatedEmailsOf();
  mkdirSync(PREVIEW_DIRECTORY, { recursive: true });
  Object.values(EmailTemplateName).forEach((name) => {
    const path = `${PREVIEW_DIRECTORY}${name}.html`;
    writeFileSync(path, filledHtmlOf({ html: emails[name].html, values: PREVIEW_VALUES }));
    console.log(`wrote ${path}`);
  });
  return SUCCESS_EXIT_CODE;
}

const HANDLERS: Record<EmailsCliMode, () => Promise<number>> = {
  [EmailsCliMode.Generate]: generate,
  [EmailsCliMode.Check]: check,
  [EmailsCliMode.Preview]: preview,
};

const mode = process.argv[2] as EmailsCliMode;
if (!Object.values(EmailsCliMode).includes(mode)) throw new Error(`usage: cli.ts ${Object.values(EmailsCliMode).join(' | ')}`);
process.exitCode = await HANDLERS[mode]();
