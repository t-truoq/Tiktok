// truonglt phase1 health tests start
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { Module, Logger } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { HealthController, DATABASE } = require('../dist/health');
const { createDatabaseClient, probeDatabase, inspectDatabase, sanitizedDatabaseError } = require('../dist/database');
const verifyTransport = async () => ({ encrypted: true, authorized: true, protocol: 'TLSv1.3' });

async function withApp(database, callback) {
  class TestModule {}
  Module({ controllers: [HealthController], providers: [{ provide: DATABASE, useValue: database }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  try { await callback(await app.getUrl()); } finally { await app.close(); }
}

test('HTTP live 200 and ready 503 without DB configuration', async () => {
  await withApp(null, async url => {
    const live = await fetch(url + '/api/v1/health/live');
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { status: 'ok' });
    const ready = await fetch(url + '/api/v1/health/ready');
    assert.equal(ready.status, 503);
    assert.match(ready.headers.get('content-type'), /application\/problem\+json/);
    assert.equal(ready.headers.get('cache-control'), 'no-store');
    assert.equal((await ready.json()).status, 503);
  });
});

test('HTTP ready executes harmless query and checks TLS/UTC; mock is not real Supabase', async () => {
  let calls = 0;
  const database = { verifyTransport, $queryRaw: async strings => {
    calls++;
    assert.match(strings.join(''), /SELECT 1::integer/);
    assert.doesNotMatch(strings.join(''), /INSERT|UPDATE|DELETE|CREATE|ALTER/);
    return [{ ok: 1, timezone: 'UTC', tls: true }];
  } };
  await withApp(database, async url => {
    const response = await fetch(url + '/api/v1/health/ready');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ready', database: 'ok', tls: true, timezone: 'UTC',
      tlsScope: 'client-to-endpoint', tlsProtocol: 'TLSv1.3', postgresSessionTls: true });
    assert.equal(calls, 1);
  });
});

test('HTTP DB error sanitizes credentials in both response and logs', async () => {
  const logs = [];
  Logger.overrideLogger({ warn: value => logs.push(String(value)), log() {}, error() {}, debug() {}, verbose() {} });
  const database = { verifyTransport, $queryRaw: async () => {
    throw Object.assign(new Error('postgresql://postgres:SECRET@private-host/db'), { code: 'P1001' });
  } };
  await withApp(database, async url => {
    const response = await fetch(url + '/api/v1/health/ready');
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /SECRET|private-host|postgresql/);
  });
  assert.doesNotMatch(logs.join('\n'), /SECRET|private-host|postgresql/);
});

for (const [name, rows] of [
  ['missing result', []],
  ['wrong select result', [{ ok: 0, timezone: 'UTC', tls: true }]],
  ['wrong timezone', [{ ok: 1, timezone: 'Asia/Ho_Chi_Minh', tls: true }]],
  ['missing upstream TLS observation', [{ ok: 1, timezone: 'UTC', tls: null }]],
]) {
  test(`probe rejects ${name}`, async () => {
    await assert.rejects(probeDatabase({ verifyTransport, $queryRaw: async () => rows }), /DATABASE_VERIFICATION_FAILED/);
  });
}

test('TLS disabling URLs and malformed URLs rejected before connection', () => {
  assert.throws(() => createDatabaseClient('postgresql://user:pass@localhost/db?sslmode=disable'), /TLS_REQUIRED/);
  assert.throws(() => createDatabaseClient('https://user:pass@localhost/db'), /INVALID_DATABASE_CONFIGURATION/);
  assert.throws(() => createDatabaseClient('postgresql://localhost/db'), /INVALID_DATABASE_CONFIGURATION/);
  assert.equal(sanitizedDatabaseError({ code: 'SECRET_VALUE', message: 'password' }), 'DATABASE_UNAVAILABLE');
  assert.equal(sanitizedDatabaseError({ code: 'ECONNREFUSED' }), 'ECONNREFUSED');
  assert.equal(sanitizedDatabaseError({ code: 'P2010', meta: {
    driverAdapterError: { cause: { kind: 'DatabaseNotReachable', message: 'SECRET' } } } }),
    'DATABASE_NOT_REACHABLE');
});

test('pooler upstream pg_stat_ssl false is reported independently from verified client TLS', async () => {
  const result = await probeDatabase({ verifyTransport,
    $queryRaw: async () => [{ ok: 1, timezone: 'UTC', tls: false }] });
  assert.equal(result.tls, true);
  assert.equal(result.postgresSessionTls, false);
  assert.equal(result.tlsScope, 'client-to-endpoint');
});

test('reject unencrypted, unauthorized or obsolete transport before SQL', async () => {
  for (const transport of [
    { encrypted: false, authorized: true, protocol: 'TLSv1.3' },
    { encrypted: true, authorized: false, protocol: 'TLSv1.3' },
    { encrypted: true, authorized: true, protocol: 'TLSv1' },
  ]) {
    await assert.rejects(probeDatabase({ verifyTransport: async () => transport,
      $queryRaw: async () => { throw Error('SQL must not run'); } }), /DATABASE_TLS_VERIFICATION_FAILED/);
  }
});

test('schema inspection uses only SELECTs and reports public objects without DDL', async () => {
  let calls = 0;
  const answers = [[{ database: 'postgres', schema: 'public', readOnly: 'on' }],
    [{ name: 'public' }], [], [{ exists: false }]];
  const result = await inspectDatabase({ $queryRaw: async strings => {
    assert.match(strings.join('').trim(), /^SELECT/);
    assert.doesNotMatch(strings.join(''), /\b(?:CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b/i);
    return answers[calls++];
  } });
  assert.equal(calls, 4);
  assert.deepEqual(result.publicObjects, []);
  assert.equal(result.migrationsExecuted, false);
});

test('schema inspection refuses a session not protected by READ ONLY transaction', async () => {
  await assert.rejects(inspectDatabase({ $queryRaw: async () => [
    { database: 'postgres', schema: 'public', readOnly: 'off' },
  ] }), /READ_ONLY_INSPECTION_REQUIRED/);
});
// truonglt phase1 health tests end
