// truonglt phase2 proposal guard tests start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

test('Phase2 schema remains offline; preview generator cannot deploy or import', () => {
  const active = fs.readFileSync(path.join(root, 'apps/api/prisma/schema.prisma'), 'utf8');
  assert.doesNotMatch(active, /^model\s+/m);
  const builder = fs.readFileSync(path.join(root, 'scripts/phase0/prepare-schema-preview.cjs'), 'utf8');
  assert.match(builder, /'--from-empty'/);
  assert.match(builder, /'--to-schema'/);
  assert.doesNotMatch(builder, /'deploy'|'dev'|'execute'|'db'|createDatabaseClient|DATABASE_URL/);
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
});
// truonglt phase2 proposal guard tests end
