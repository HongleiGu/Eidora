/**
 * Applies supabase/migrations/*.sql to your cloud Supabase project
 * using the Supabase Management API.
 *
 * Requires a Personal Access Token (one-time setup):
 *   1. Go to https://supabase.com/dashboard/account/tokens
 *   2. Create a token and add to .env:  SUPABASE_ACCESS_TOKEN=sbp_...
 *
 * Run: pnpm tsx --env-file=.env scripts/setup-db.ts
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const projectRef = (process.env.SUPABASE_URL ?? '').replace('https://', '').split('.')[0];
const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? '';

if (!projectRef) {
  console.error('SUPABASE_URL is not set in .env');
  process.exit(1);
}

if (!accessToken) {
  console.error('SUPABASE_ACCESS_TOKEN is not set in .env');
  console.error('Create one at: https://supabase.com/dashboard/account/tokens\n');
  process.exit(1);
}

async function runSql(sql: string): Promise<void> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}

(async () => {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error('No migration files found in supabase/migrations/');
    process.exit(1);
  }

  console.log(`\nApplying ${files.length} migration(s) to project ${projectRef}...\n`);

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    process.stdout.write(`  ${file} ... `);
    try {
      await runSql(sql);
      console.log('done');
    } catch (err) {
      console.log('FAILED');
      console.error(`  ${(err as Error).message}\n`);
      process.exit(1);
    }
  }

  console.log('\nAll migrations applied.\n');
})();
