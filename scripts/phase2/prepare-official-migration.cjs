// truonglt official migration preparation offline start
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const gate = JSON.parse(fs.readFileSync(path.join(root, 'docs/phase1/GATE1_SIGNOFF.json')));
if (gate.status !== 'PASS_OWNER_EXCEPTION') throw Error('GATE1_REQUIRED');
const prisma = path.join(root, 'node_modules/prisma/build/index.js');
const schema = 'apps/api/prisma/schema.prisma';
const config = 'apps/api/prisma.config.ts';
execFileSync(process.execPath, [prisma, 'validate', '--schema', schema, '--config', config], { cwd: root, stdio: 'inherit' });
const generated = execFileSync(process.execPath, [prisma, 'migrate', 'diff', '--from-empty',
  '--to-schema', schema, '--script', '--config', config], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
const constraints = fs.readFileSync(path.join(root, 'docs/phase2/constraints-preview.sql'), 'utf8').replace(/\r\n/g, '\n');
const sql = `-- truonglt official baseline schema migration start
-- PREPARED OFFLINE ONLY. Owner has not approved execution or data import.
BEGIN;
DO $$
BEGIN
  IF current_schema() <> 'public' OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
      AND c.relname <> '_prisma_migrations'
  ) THEN
    RAISE EXCEPTION 'DEV public schema is not the reviewed empty baseline' USING ERRCODE = '55000';
  END IF;
END;
$$;
${generated}
${constraints}
COMMIT;
-- truonglt official baseline schema migration end
`;
const directory = path.join(root, 'apps/api/prisma/migrations/20261014063000_preserve_source_baseline');
fs.mkdirSync(directory, { recursive: true });
const target = path.join(directory, 'migration.sql');
if (fs.existsSync(target) && fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== sql) throw Error('EXISTING_MIGRATION_CHANGED_REVIEW_REQUIRED');
fs.writeFileSync(target, sql);
const report = { status: 'PREPARED_NOT_APPLIED', migration: path.relative(root, target),
  sha256: crypto.createHash('sha256').update(sql).digest('hex'),
  tables: (generated.match(/CREATE TABLE /g) || []).length,
  rowLevelSecurityTables: (constraints.match(/ENABLE ROW LEVEL SECURITY/g) || []).length,
  immutableTriggers: (constraints.match(/CREATE TRIGGER /g) || []).length,
  transactionWrapped: true, databaseCalls: 0, migrationApproved: false, importApproved: false };
fs.writeFileSync(path.join(root, 'docs/phase2/OFFICIAL_MIGRATION_REVIEW.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
// truonglt official migration preparation offline end
