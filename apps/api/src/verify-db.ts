// truonglt phase1 live db verification start
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createDatabaseClient, probeDatabase, inspectDatabase, sanitizedDatabaseError } from './database';
import { writeFileSync, mkdirSync } from 'node:fs';

config({ path: resolve(__dirname, '../.env'), quiet: true });

async function main() {
  const evidence: object[] = [];
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
      const inspection = await inspectDatabase(client);
      const report = { route, status: 'PASS', environment: process.env.DB_ENVIRONMENT,
        verifiedAtUtc: new Date().toISOString(), ...result, inspection,
        note: 'Read-only route connectivity/schema inspection; no migration executed. TLS scopes reported separately.' };
      evidence.push(report);
      console.log(JSON.stringify(report));
    } catch (error) {
      console.error(JSON.stringify({ route, status: 'FAIL', code: sanitizedDatabaseError(error) }));
      process.exitCode = 1;
    } finally {
      await client?.$disconnect();
    }
  }
  if (evidence.length === 2) {
    const directory = resolve(__dirname, '../../../docs/phase1');
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, 'live-db-verification.json'), JSON.stringify(evidence, null, 2) + '\n');
  }
}
main().catch(() => { process.exitCode = 1; });
// truonglt phase1 live db verification end
