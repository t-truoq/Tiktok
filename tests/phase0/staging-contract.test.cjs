// truonglt phase2 preservation and staging start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertHealth } = require('../../scripts/phase2/staging-contract.cjs');
const ready = { status: 'ready', database: 'ok', tls: true, timezone: 'UTC',
  tlsScope: 'client-to-endpoint', tlsProtocol: 'TLSv1.3', postgresSessionTls: false };
test('staging checks actual readiness contract and permits pooler backend TLS=false', () => {
  assertHealth('live', 200, { status: 'ok' });
  assertHealth('ready', 200, ready);
  assert.throws(() => assertHealth('ready', 503, ready));
  for (const change of [{ tls: false }, { timezone: 'Asia/Saigon' }, { tlsProtocol: 'TLSv1.1' },
    { status: 'ok' }, { database: 'error' }, { tlsScope: 'backend-only' }])
    assert.throws(() => assertHealth('ready', 200, { ...ready, ...change }));
});

// truonglt phase2 preservation and staging end
