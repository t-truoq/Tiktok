// truonglt real PostgreSQL synthetic rollback acceptance start
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const root = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(root, 'apps/api/.env'), quiet: true });
const { databaseConnectionOptions, sanitizedDatabaseError } = require('../../apps/api/dist/database');
const migration = 'apps/api/prisma/migrations/20261014063000_preserve_source_baseline/migration.sql';
const sql = fs.readFileSync(path.join(root, migration), 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const tables = [...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map(m => m[1]);
const expectedConstraints = [...new Set([...sql.matchAll(/CONSTRAINT "([^"]+)"/g)].map(m => m[1]))];
const expectedIndexes = [...sql.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g)].map(m => m[1]);
const expectedTriggers = [...sql.matchAll(/CREATE TRIGGER "([^"]+)"/g)].map(m => m[1]);
const report = { startedAtUtc: new Date().toISOString(), migrationStatus: 'VERIFYING',
  sha256: sha(sql), syntheticOnly: true, realHistoryImported: false, tests: [],
  truncateTests: 'CATALOG_VERIFIED_NOT_EXECUTED', multiSessionVersionRace: 'NOT_RUN_ROLLBACK_ONLY', gate2: 'BLOCKED' };
let sequence = 0;
const uuid = () => crypto.randomUUID();
async function main() {
  assert.equal(report.sha256, '148e77f65ba5c08720afddc569e3535512017b3257a1384ba39cdb7c5cb37c93');
  assert.equal(process.env.DB_ENVIRONMENT, 'DEV');
  const url = new URL(process.env.DIRECT_URL);
  assert.equal(url.username, 'postgres.nqdaykgasfnsaixkhbya');
  assert.equal(url.hostname, 'aws-0-ap-northeast-2.pooler.supabase.com');
  assert.equal(url.port, '5432');
  const client = new Client({ ...databaseConnectionOptions(process.env.DIRECT_URL), connectionTimeoutMillis: 5000 });
  client.on('error', () => {});
  await client.connect();
  const q = (text, values) => client.query(text, values);
  async function check(name, fn) { await fn(); report.tests.push({ name, status: 'PASS' }); }
  async function reject(name, text, values, code) {
    const savepoint = 'case_' + (++sequence);
    await q('SAVEPOINT ' + savepoint);
    let caught;
    try { await q(text, values); } catch (error) { caught = error; }
    await q('ROLLBACK TO SAVEPOINT ' + savepoint);
    await q('RELEASE SAVEPOINT ' + savepoint);
    assert.equal(caught?.code, code, name);
    report.tests.push({ name, status: 'PASS', expectedSqlState: code });
  }
  async function counts() {
    const result = {};
    for (const table of tables) result[table] = (await q(`SELECT count(*)::int AS n FROM public."${table}"`)).rows[0].n;
    return result;
  }
  try {
    await q('BEGIN READ ONLY');
    const migrations = (await q('SELECT migration_name,checksum,finished_at,rolled_back_at,applied_steps_count FROM public._prisma_migrations ORDER BY started_at')).rows;
    assert.equal(migrations.length, 1);
    assert.equal(migrations[0].migration_name, '20261014063000_preserve_source_baseline');
    assert.equal(migrations[0].checksum, report.sha256);
    assert.ok(migrations[0].finished_at);
    assert.equal(migrations[0].rolled_back_at, null);
    report.migrations = migrations;
    report.migrationStatus = 'APPLIED';
    report.catalog = {
      tables: (await q("SELECT c.relname AS name,c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> '_prisma_migrations' ORDER BY c.relname")).rows,
      constraints: (await q("SELECT conname AS name,convalidated AS validated FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY conname")).rows,
      indexes: (await q("SELECT indexname AS name FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")).rows,
      triggers: (await q("SELECT t.tgname AS name,t.tgenabled AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY t.tgname")).rows
    };
    await check('13 exact tables and 13 RLS enabled', async () => {
      assert.deepEqual(report.catalog.tables.map(t => t.name).sort(), [...tables].sort());
      assert.ok(report.catalog.tables.every(t => t.rls));
    });
    await check('all generated/custom constraints validated and indexes present', async () => {
      for (const name of expectedConstraints) assert.ok(report.catalog.constraints.some(c => c.name === name && c.validated), name);
      for (const name of expectedIndexes) assert.ok(report.catalog.indexes.some(i => i.name === name), name);
    });
    await check('10 exact immutable triggers enabled', async () => {
      assert.equal(report.catalog.triggers.length, 10);
      for (const name of expectedTriggers) assert.ok(report.catalog.triggers.some(t => t.name === name && t.enabled === 'O'), name);
    });
    report.beforeCounts = await counts();
    assert.ok(Object.values(report.beforeCounts).every(n => n === 0), 'NONEMPTY_TABLE_STOP_SYNTHETIC_TESTS');
    await q('ROLLBACK');
    await q('BEGIN');
    await q("SET LOCAL statement_timeout='10s'");
    const p1 = uuid(), p2 = uuid(), user = uuid(), archive = uuid(), archive2 = uuid(), batch = uuid(), record = uuid();
    const key1 = 'SYNTHETIC_GATE2_' + p1, key2 = 'SYNTHETIC_GATE2_' + p2;
    for (const [id, key] of [[p1, key1], [p2, key2]]) await q('INSERT INTO products(id,legacy_key,root_name,root_name_normalized,classification,source_field_states,updated_at) VALUES($1,$2,$2,$2,\'LEGACY_UNMATCHED\',\'{}\',now())', [id, key]);
    await q('INSERT INTO users(id,auth_subject,role,updated_at) VALUES($1,$2,\'EDITOR\',now())', [user, 'SYNTHETIC_' + user]);
    const bytes = Buffer.from('{ "synthetic": true, "nil": null, "blank": "", "zero": 0 }');
    for (const [id, original] of [[archive, bytes], [archive2, Buffer.from('synthetic second archive')]])
      await q('INSERT INTO source_archives(id,filename,sha256,original_bytes,metadata,other_properties) VALUES($1,\'SYNTHETIC_ONLY\',$2,$3,\'{}\',\'{}\')', [id, sha(original), original]);
    await q('INSERT INTO import_batches(id,source_archive_id,mapping_version,plan_sha256,status) VALUES($1,$2,\'synthetic-v1\',$3,\'PREPARED\')', [batch, archive, sha('synthetic-plan')]);
    await reject('batch retry unique identity', 'INSERT INTO import_batches(id,source_archive_id,mapping_version,plan_sha256,status) VALUES($1,$2,\'synthetic-v1\',$3,\'PREPARED\')', [uuid(), archive, sha('different-plan')], '23505');
    const rawText = '{ "synthetic":true, "nil":null, "blank":"", "zero":0 }';
    const recordInsert = 'INSERT INTO legacy_records(id,product_id,source_archive_id,import_batch_id,legacy_key,manifest,chunks,raw_json_text,raw_json,decoded_sha256,field_types) VALUES($1,$2,$3,$4,$5,\'SYNTHETIC\',\'[]\',$6::text,$6::jsonb,$7,\'{}\')';
    await q(recordInsert, [record, p1, archive, batch, key1, rawText, sha(rawText)]);
    await reject('batch source foreign key rejects different archive', recordInsert, [uuid(), p2, archive2, batch, key2, rawText, sha(rawText)], '23503');
    await reject('product legacy identity foreign key', recordInsert, [uuid(), p2, archive, batch, 'WRONG_KEY', rawText, sha(rawText)], '23503');
    const valueRows = [];
    for (const [state, raw, decimal] of [['MISSING', null, null], ['NULL', 'null', null], ['BLANK', '""', null], ['NUMBER', '0', '0.000'], ['TEXT', '"0"', null]]) {
      const id = uuid(); valueRows.push(id);
      await q('INSERT INTO legacy_values(id,legacy_record_id,json_pointer,state,raw_value,decimal_value) VALUES($1,$2,$3,$4,$5::jsonb,$6)', [id, record, '/' + state, state, raw, decimal]);
    }
    await check('raw bytes/text and missing/null/blank/zero/numeric text round-trip', async () => {
      assert.ok((await q('SELECT original_bytes FROM source_archives WHERE id=$1', [archive])).rows[0].original_bytes.equals(bytes));
      assert.equal((await q('SELECT raw_json_text FROM legacy_records WHERE id=$1', [record])).rows[0].raw_json_text, rawText);
      const rows = (await q('SELECT state,raw_value,raw_value IS NULL AS sql_null,decimal_value FROM legacy_values WHERE legacy_record_id=$1', [record])).rows;
      const get = s => rows.find(r => r.state === s);
      assert.equal(get('MISSING').sql_null, true); assert.equal(get('NULL').sql_null, false);
      assert.equal(get('NULL').raw_value, null); assert.equal(get('BLANK').raw_value, '');
      assert.equal(get('NUMBER').decimal_value, '0.000'); assert.equal(get('TEXT').raw_value, '0');
    });
    const sample = uuid(), end = uuid();
    const roundInsert = 'INSERT INTO purchase_rounds(id,product_id,"group",round_index,order_price,order_price_state,source_field_states) VALUES($1,$2,$3,$4,$5,$6,\'{}\')';
    await q(roundInsert, [sample, p1, 'SAMPLE', '1', '0.00', 'NUMBER']);
    await q(roundInsert, [end, p1, 'END', '1', null, 'MISSING']);
    await q(roundInsert, [uuid(), p1, 'END', '9007199254740991', null, 'BLANK']);
    await reject('round index rejects zero', roundInsert, [uuid(), p1, 'END', '0', null, 'MISSING'], '23514');
    await reject('round index rejects unsafe integer', roundInsert, [uuid(), p1, 'END', '9007199254740992', null, 'MISSING'], '23514');
    await reject('number price state requires decimal', roundInsert, [uuid(), p1, 'END', '2', null, 'NUMBER'], '23514');
    await q('INSERT INTO sales_details(id,round_id,unit_price,unit_price_state,sold_quantity,quantity_state,raw_fields) VALUES($1,$2,\'12.34\',\'NUMBER\',\'1.234\',\'NUMBER\',\'{}\')', [uuid(), end]);
    await check('exact Decimal and dynamic bigint retained', async () => {
      const sale = (await q('SELECT unit_price,sold_quantity FROM sales_details WHERE round_id=$1', [end])).rows[0];
      assert.equal(sale.unit_price, '12.34'); assert.equal(sale.sold_quantity, '1.234');
      assert.equal((await q('SELECT max(round_index)::text AS n FROM purchase_rounds WHERE product_id=$1', [p1])).rows[0].n, '9007199254740991');
    });
    const history = uuid(), snapshot = uuid();
    const historyInsert = 'INSERT INTO product_history(id,product_id,import_batch_id,legacy_event_index,event_type,original_payload) VALUES($1,$2,$3,0,\'SYNTHETIC\',\'{"synthetic":true}\')';
    await q(historyInsert, [history, p1, batch]);
    await reject('history import FK prevents wrong product', historyInsert, [uuid(), p2, batch], '23503');
    await reject('history retry unique index', historyInsert, [uuid(), p1, batch], '23505');
    await q('INSERT INTO stage_snapshots(id,product_id,source_label,snapshot,source_json_pointer,import_batch_id) VALUES($1,$2,\'SYNTHETIC\',\'{"synthetic":true}\',\'/stageData/SYNTHETIC\',$3)', [snapshot, p1, batch]);
    const refundInsert = 'INSERT INTO refunds(id,product_id,sample_round_id,end_round_id,eligibility) VALUES($1,$2,$3,$4,\'{}\')';
    await q(refundInsert, [uuid(), p1, sample, end]);
    await reject('refund cannot reference other product round', refundInsert, [uuid(), p2, sample, null], '23503');
    await reject('refund END cannot point to SAMPLE', refundInsert, [uuid(), p1, null, sample], '23503');
    await q('INSERT INTO product_images(id,product_id,legacy_reference) VALUES($1,$2,\'{"synthetic":true}\')', [uuid(), p1]);
    const payloadHash = sha('SYNTHETIC_REQUEST');
    const requestKey = 'SYNTHETIC_' + uuid();
    const requestInsert = 'INSERT INTO mutation_requests(id,idempotency_key,actor_id,action,payload_hash,outcome) VALUES($1,$2,$3,\'SYNTHETIC\',$4,\'{"synthetic":true,"result":"original"}\')';
    await q(requestInsert, [uuid(), requestKey, user, payloadHash]);
    await reject('idempotency retry cannot duplicate request', requestInsert, [uuid(), requestKey, user, payloadHash], '23505');
    await check('idempotency replay reads same outcome and rejects different payload hash', async () => {
      const existing = (await q('SELECT payload_hash,outcome FROM mutation_requests WHERE actor_id=$1 AND idempotency_key=$2', [user, requestKey])).rows[0];
      assert.equal(existing.payload_hash, payloadHash);
      assert.deepEqual(existing.outcome, { synthetic: true, result: 'original' });
      assert.notEqual(existing.payload_hash, sha('DIFFERENT_PAYLOAD'));
    });
    await check('parallel callers with same observed version get one CAS success and one conflict', async () => {
      const observed = await Promise.all([q('SELECT version FROM products WHERE id=$1', [p1]), q('SELECT version FROM products WHERE id=$1', [p1])]);
      const attempts = await Promise.all(observed.map(r => q('UPDATE products SET version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING version', [p1, r.rows[0].version])));
      assert.deepEqual(attempts.map(r => r.rowCount).sort(), [0, 1]);
      // Same transaction session: genuine SQL CAS, not a multi-session MVCC race.
    });
    await reject('positive product version constraint', 'UPDATE products SET version=0 WHERE id=$1', [p1], '23514');
    for (const [table, id] of [['source_archives', archive], ['legacy_records', record], ['legacy_values', valueRows[0]], ['product_history', history], ['stage_snapshots', snapshot]]) {
      await reject(`${table} immutable UPDATE`, `UPDATE "${table}" SET id=id WHERE id=$1`, [id], '55000');
      await reject(`${table} immutable DELETE`, `DELETE FROM "${table}" WHERE id=$1`, [id], '55000');
    }
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const savepoint = 'role_' + role;
      await q('SAVEPOINT ' + savepoint);
      await q(`SET LOCAL ROLE "${role}"`);
      assert.equal((await q('SELECT current_user AS name')).rows[0].name, role);
      for (const table of tables) await reject(`${role} SELECT denied on ${table}`, `SELECT 1 FROM "${table}" LIMIT 1`, [], '42501');
      await reject(`${role} INSERT denied`, 'INSERT INTO products(id,legacy_key,root_name,root_name_normalized,classification,source_field_states,updated_at) VALUES($1,\'SYNTHETIC_DENIED\',\'SYNTHETIC_DENIED\',\'SYNTHETIC_DENIED\',\'LEGACY_UNMATCHED\',\'{}\',now())', [uuid()], '42501');
      await q('ROLLBACK TO SAVEPOINT ' + savepoint);
      await q('RELEASE SAVEPOINT ' + savepoint);
    }
    await q('SAVEPOINT injected_failure');
    const failedProduct = uuid();
    await q('INSERT INTO products(id,legacy_key,root_name,root_name_normalized,classification,source_field_states,updated_at) VALUES($1,$2,$2,$2,\'LEGACY_UNMATCHED\',\'{}\',now())', [failedProduct, 'SYNTHETIC_FAILURE_' + failedProduct]);
    try { await q('SELECT 1/0'); } catch (error) { assert.equal(error.code, '22012'); }
    await q('ROLLBACK TO SAVEPOINT injected_failure');
    await check('transaction failure removes partially inserted synthetic product', async () => {
      assert.equal((await q('SELECT count(*)::int AS n FROM products WHERE id=$1', [failedProduct])).rows[0].n, 0);
    });
    await q('ROLLBACK');
    await q('BEGIN READ ONLY');
    report.afterCounts = await counts();
    await check('outer rollback leaves all 13 business tables empty', async () => {
      assert.deepEqual(report.afterCounts, report.beforeCounts);
      assert.ok(Object.values(report.afterCounts).every(n => n === 0));
    });
    await q('ROLLBACK');
    report.rollback = 'PASS';
    report.testStatus = 'PASS_WITH_CONCURRENCY_LIMITATION';
    // Do not certify the mandatory multi-session concurrent-edit acceptance from
    // same-session SQL CAS; no synthetic setup rows were committed to enable it.
    report.gate2 = 'BLOCKED_MULTI_SESSION_CONFLICT_TEST_NOT_VERIFIED';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    report.testStatus = 'FAIL';
    report.errorCategory = sanitizedDatabaseError(error);
    report.errorName = error.name;
    if (/^[A-Z0-9]{5}$/.test(error.code || '')) report.sqlState = error.code;
    report.afterFailureCounts = await counts().catch(() => null);
    report.gate2 = 'FAIL_OR_BLOCKED';
    process.exitCode = 1;
  } finally {
    await client.end();
    report.finishedAtUtc = new Date().toISOString();
    fs.writeFileSync(path.join(root, 'docs/phase2/INTEGRATION_LIVE_RESULT.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ migrationStatus: report.migrationStatus, testStatus: report.testStatus,
      testsPassed: report.tests.length, rollback: report.rollback, gate2: report.gate2, errorCategory: report.errorCategory }));
  }
}
main().catch(error => { console.error(JSON.stringify({ status: 'STOPPED', code: sanitizedDatabaseError(error) })); process.exitCode = 1; });
// truonglt real PostgreSQL synthetic rollback acceptance end
