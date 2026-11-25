import { applyD1Migrations } from 'cloudflare:test';
import type { D1Migration } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

const MIGRATION_NUMBER_LENGTH = 4;

function migrationNumberOf(migration: D1Migration): string {
  return migration.name.slice(0, MIGRATION_NUMBER_LENGTH);
}

export function applyMigrationsThrough(lastNumber: string): Promise<void> {
  const migrations = env.MIGRATIONS.filter((migration) => migrationNumberOf(migration) <= lastNumber);
  return applyD1Migrations(env.MIGRATION_DIRECTORY, migrations);
}

export function applyMigrationNamed(name: string): Promise<void> {
  const migration = env.MIGRATIONS.find((candidate) => candidate.name === name);
  if (migration === undefined) throw new Error(`no migration named ${name}`);
  return applyD1Migrations(env.MIGRATION_DIRECTORY, [migration]);
}
