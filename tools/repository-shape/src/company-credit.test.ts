import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const README_FILE = 'README.md';
const COMPANY_TRADE_NAME = 'Logic Bit';
const COMPANY_WEBSITE = 'https://logicbit.com.br';
const COMPANY_WEBSITE_LABEL = 'logicbit.com.br';
const README_CREDIT_LINE = `todz is a product of ${COMPANY_TRADE_NAME}, made in Brazil: [${COMPANY_WEBSITE_LABEL}](${COMPANY_WEBSITE})`;

describe('company credit', () => {
  test('the README credits Logic Bit as the studio behind todz, linking its website', () => {
    expect(readRepositoryFile(README_FILE).split('\n')).toContain(README_CREDIT_LINE);
  });
});
