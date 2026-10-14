// truonglt phase2 proposal guard tests start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

test('official schema is prepared after Gate1; generators cannot execute database migrations', () => {
  const active = fs.readFileSync(path.join(root, 'apps/api/prisma/schema.prisma'), 'utf8');
  assert.equal((active.match(/^model\s+/gm) || []).length, 13);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'docs/phase1/GATE1_SIGNOFF.json'))).status, 'PASS_OWNER_EXCEPTION');
  const builder = fs.readFileSync(path.join(root, 'scripts/phase0/prepare-schema-preview.cjs'), 'utf8');
  assert.match(builder, /'--from-empty'/);
  assert.match(builder, /'--to-schema'/);
  assert.doesNotMatch(builder, /'deploy'|'dev'|'execute'|'db'|createDatabaseClient|DATABASE_URL/);
  const official = fs.readFileSync(path.join(root, 'scripts/phase2/prepare-official-migration.cjs'), 'utf8');
  assert.match(official, /'--from-empty'/);
  assert.match(official, /'--to-schema'/);
  assert.doesNotMatch(official, /'deploy'|'dev'|'execute'|'db'|createDatabaseClient|DATABASE_URL/);
});

test('official migration matches reviewed datamodel, pins checksum and does not import or erase data', () => {
  const normalize = text => text.replace(/\/\/[^\n]*/g, '').replace(/generator client\s*\{[^}]*\}/, '').replace(/\s+/g, ' ').trim();
  assert.equal(normalize(fs.readFileSync(path.join(root, 'apps/api/prisma/schema.prisma'), 'utf8')),
    normalize(fs.readFileSync(path.join(root, 'docs/phase2/schema.prisma'), 'utf8')));
  const report = JSON.parse(fs.readFileSync(path.join(root, 'docs/phase2/OFFICIAL_MIGRATION_REVIEW.json')));
  const bytes = fs.readFileSync(path.join(root, report.migration.replace(/\\/g, '/')));
  assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'), report.sha256);
  const sql = bytes.toString('utf8');
  assert.match(sql, /^BEGIN;$/m);
  assert.match(sql, /^COMMIT;$/m);
  assert.match(sql, /DEV public schema is not the reviewed empty baseline/);
  assert.doesNotMatch(sql, /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|DROP|COPY)\b/im);
  assert.equal((sql.match(/CREATE TABLE /g) || []).length, 13);
  assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g) || []).length, 13);
  assert.equal(report.migrationApproved, false);
  assert.equal(report.importApproved, false);
});

test('proposal preserves unknown values and financial history; restrictive deletion/RLS policies exist', () => {
  const schema = fs.readFileSync(path.join(root, 'docs/phase2/schema.prisma'), 'utf8');
  assert.doesNotMatch(schema, /onDelete:\s*Cascade/);
  for (const field of ['originalBytes', 'rawJsonText', 'legacyEventIndex', 'sourceTimestampText',
    'sourceFieldStates', 'rawState', 'orderPriceState', 'classification']) assert.ok(schema.includes(field));
  const sql = fs.readFileSync(path.join(root, 'docs/phase2/migration-preview.sql'), 'utf8');
  assert.match(sql, /BEFORE UPDATE OR DELETE ON "product_history"/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /CHECK \("round_index" > 0 AND "round_index" <= 9007199254740991\)/);
  assert.doesNotMatch(sql, /ON DELETE CASCADE/);
  for (const guard of ['record_batch_source_fk', 'record_product_key_fk', 'history_imported_product_fk',
    'snapshot_imported_product_fk', 'refund_sample_product_fk', 'refund_end_product_fk',
    'order_price_state_consistent', 'batch_plan_checksum_format', 'history_no_truncate'])
    assert.ok(sql.includes(guard), guard);
  assert.match(sql, /FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(schema, /@@unique\(\[productId, importBatchId, sourceJsonPointer\]\)/);
});
// truonglt phase2 proposal guard tests end
