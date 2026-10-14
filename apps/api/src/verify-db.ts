// truonglt phase1 live db verification start
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createDatabaseClient, probeDatabase, sanitizedDatabaseError } from './database';

config({ path: resolve(__dirname, '../.env'), quiet: true });

async function main() {
  const existingReadonly = process.env.DB_ENVIRONMENT === 'EXISTING' &&
    process.argv.includes('--existing-readonly');
  if (process.env.DB_ENVIRONMENT !== 'DEV' && !existingReadonly) {
    console.error(JSON.stringify({ status: 'NOT_RUN', reason: 'CONFIRMED_DEV_REQUIRED' }));
    process.exitCode = 1;
    return;
  }
  for (const route of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const url = process.env[route];
    if (!url) {
      console.error(JSON.stringify({ route, status: 'NOT_RUN', reason: 'MISSING_ENV' }));
      process.exitCode = 1;
      continue;
    }
    let client;
    try {
      client = createDatabaseClient(url);
      const result = await probeDatabase(client);
      console.log(JSON.stringify({ route, status: 'PASS', environment: process.env.DB_ENVIRONMENT, ...result,
        note: 'Read-only route connectivity; no migration executed, pooling mode not inferred.' }));
    } catch (error) {
      console.error(JSON.stringify({ route, status: 'FAIL', code: sanitizedDatabaseError(error) }));
      process.exitCode = 1;
    } finally {
      await client?.$disconnect();
    }
  }
}
main().catch(() => { process.exitCode = 1; });
// truonglt phase1 live db verification end
