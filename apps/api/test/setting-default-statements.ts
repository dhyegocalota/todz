import { env } from 'cloudflare:workers';

export function statementNamed(name: string): string {
  const statement = env.SETTING_DEFAULT_STATEMENTS[name];
  if (statement === undefined) throw new Error(`no statement named ${name}`);
  return statement;
}
