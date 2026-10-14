// truonglt owner-approved single migration deployment start
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(root, 'apps/api/.env'), quiet: true });
const pin = '148e77f65ba5c08720afddc569e3535512017b3257a1384ba39cdb7c5cb37c93';
const migration = 'apps/api/prisma/migrations/20261014063000_preserve_source_baseline/migration.sql';
const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, migration))).digest('hex');
if (hash !== pin) throw Error('MIGRATION_CHECKSUM_MISMATCH');
if (process.argv[2] !== '--owner-override-approved') throw Error('EXPLICIT_OWNER_APPROVAL_REQUIRED');
const reportPath = path.join(root, 'docs/phase2/MIGRATION_DEPLOY_RESULT.json');
if (fs.existsSync(reportPath)) throw Error('DEPLOY_ALREADY_ATTEMPTED_NO_AUTOMATIC_RETRY');
const url = new URL(process.env.DIRECT_URL);
if (process.env.DB_ENVIRONMENT !== 'DEV' || url.hostname !== 'aws-0-ap-northeast-2.pooler.supabase.com' ||
    url.username !== 'postgres.nqdaykgasfnsaixkhbya' || url.port !== '5432' || url.pathname !== '/postgres')
  throw Error('DEV_PROJECT_MISMATCH');
const ca = path.resolve(process.env.DATABASE_CA_CERT_PATH);
if (!fs.existsSync(ca)) throw Error('CA_FILE_NOT_FOUND');
// Prisma Schema Engine's strict certificate/hostname verification; same endpoint
// and credentials, official CA explicitly supplied. No separate TLS preflight.
url.searchParams.set('sslmode', 'require');
url.searchParams.set('sslaccept', 'strict');
url.searchParams.set('sslcert', ca.replace(/\\/g, '/'));
const redact = text => {
  let safe = String(text || '').replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[REDACTED_DATABASE_URL]');
  for (const secret of [url.password, decodeURIComponent(url.password)]) if (secret) safe = safe.split(secret).join('[REDACTED]');
  return safe;
};
const report = { startedAtUtc: new Date().toISOString(), projectRef: 'nqdaykgasfnsaixkhbya',
  migration, sha256: hash, attempts: 1, backupGate: 'WAIVED_BY_OWNER',
  separatePrismaTlsPreflight: 'WAIVED_BY_OWNER', tlsRequired: true, sslaccept: 'strict',
  command: 'Prisma 7 migrate deploy --config apps/api/prisma.config.ts', status: 'ATTEMPT_STARTED', importExecuted: false };
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
try {
  const output = execFileSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'),
    'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
    cwd: root, env: { ...process.env, DIRECT_URL: url.toString() }, encoding: 'utf8', timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  report.status = 'CLI_DEPLOY_SUCCEEDED_REQUIRES_CATALOG_VERIFICATION';
  report.exitCode = 0;
  fs.writeFileSync(path.join(root, 'docs/phase2/MIGRATION_DEPLOY_LOG.txt'), redact(output));
  console.log(redact(output));
} catch (error) {
  report.status = 'CLI_DEPLOY_FAILED_STOPPED';
  report.exitCode = error.status;
  report.processErrorCode = error.code;
  const safe = redact(String(error.stdout || '') + '\n' + String(error.stderr || ''));
  fs.writeFileSync(path.join(root, 'docs/phase2/MIGRATION_DEPLOY_LOG.txt'), safe);
  console.log(safe);
  process.exitCode = 1;
} finally {
  report.finishedAtUtc = new Date().toISOString();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
// truonglt owner-approved single migration deployment end
