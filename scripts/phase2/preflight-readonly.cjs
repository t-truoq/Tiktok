// truonglt DEV migration preflight read-only start
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(root, 'apps/api/.env'), quiet: true });
const { createDatabaseClient, probeDatabase, inspectDatabase, sanitizedDatabaseError } = require('../../apps/api/dist/database');
async function main() {
  if (process.env.DB_ENVIRONMENT !== 'DEV') throw Error('DEV_REQUIRED');
  const route = new URL(process.env.DIRECT_URL);
  if (route.hostname !== 'aws-0-ap-northeast-2.pooler.supabase.com' ||
      route.username !== 'postgres.nqdaykgasfnsaixkhbya' || route.port !== '5432' || route.pathname !== '/postgres')
    throw Error('DEV_PROJECT_MISMATCH');
  const client = createDatabaseClient(process.env.DIRECT_URL);
  try {
    const transport = await probeDatabase(client);
    const catalog = await inspectDatabase(client);
    const privileges = await client.$queryRaw`
      SELECT current_user AS role, rolbypassrls AS "bypassRls", rolsuper AS "superuser",
        has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInPublic",
        has_schema_privilege(current_user, 'public', 'USAGE') AS "canUsePublic"
      FROM pg_roles WHERE rolname = current_user
    `;
    const clientRoles = await client.$queryRaw`
      SELECT rolname AS name FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') ORDER BY rolname
    `;
    const ready = catalog.publicObjects.length === 0 && catalog.migrationHistory[0].exists === false &&
      privileges.length === 1 && privileges[0].canCreateInPublic && privileges[0].canUsePublic && clientRoles.length === 3;
    const report = { verifiedAtUtc: new Date().toISOString(), environment: 'DEV', projectRef: 'nqdaykgasfnsaixkhbya', transport,
      catalog, privileges, clientRoles, schemaPreconditions: ready ? 'PASS' : 'REVIEW_REQUIRED',
      backupRestoreRehearsal: 'NOT_VERIFIED', migrationsExecuted: false, importsExecuted: false };
    fs.writeFileSync(path.join(root, 'docs/phase2/DEV_PREFLIGHT.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
    if (!ready) process.exitCode = 1;
  } finally { await client.$disconnect(); }
}
main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', code: sanitizedDatabaseError(error) })); process.exitCode = 1; });
// truonglt DEV migration preflight read-only end
