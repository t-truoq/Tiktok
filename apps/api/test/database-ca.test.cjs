// truonglt CA trust and safe categories tests start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tls = require('node:tls');
const { X509Certificate } = require('node:crypto');
const { Client } = require('pg');
const { databaseTlsOptions, databaseConnectionOptions, sanitizedDatabaseError } = require('../dist/database');
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';

test('Supabase missing or nonexistent CA produces safe configuration category', () => {
  assert.throws(() => databaseTlsOptions(host, ''), /CA_FILE_NOT_FOUND/);
  assert.throws(() => databaseTlsOptions(host, path.join(os.tmpdir(), 'nonexistent-tiktok-ca', 'ca.crt')), /CA_FILE_NOT_FOUND/);
  assert.equal(sanitizedDatabaseError(Error('CA_FILE_NOT_FOUND')), 'CA_FILE_NOT_FOUND');
});

test('valid PEM is passed to pg TLS with hostname and verification enforced', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-ca-test-'));
  try {
    const cert = tls.rootCertificates.find(pem => {
      const c = new X509Certificate(pem);
      return c.ca && Date.parse(c.validFrom) < Date.now() && Date.parse(c.validTo) > Date.now();
    });
    assert.ok(cert);
    const file = path.join(folder, 'ca.crt');
    fs.writeFileSync(file, cert);
    const options = databaseTlsOptions(host, file);
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.servername, host);
    assert.equal(options.ca, cert);
    assert.equal(options.checkServerIdentity, undefined); // Node default verification remains active.
    const connection = databaseConnectionOptions(`postgresql://test:synthetic@${host}/postgres?ssl=true&sslmode=require&sslnegotiation=direct&uselibpqcompat=true`, file);
    const client = new Client(connection); // No connect: inspect pg's effective config.
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
    assert.equal(client.connectionParameters.ssl.ca, cert);
    assert.equal(client.connectionParameters.ssl.servername, host);
    assert.throws(() => databaseConnectionOptions(`postgresql://test:synthetic@${host}/postgres?ssl=0`, file), /TLS_REQUIRED/);
    fs.writeFileSync(file, 'invalid PEM SYNTHETIC_SECRET');
    assert.throws(() => databaseTlsOptions(host, file), /TLS_CERTIFICATE_INVALID/);
  } finally {
    // Remove only the temporary files created by this test, not source data.
    fs.unlinkSync(path.join(folder, 'ca.crt'));
    fs.rmdirSync(folder);
  }
});

test('driver chain/hostname and adapter TLS failures map to safe category without raw message', () => {
  for (const code of ['SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID']) {
    assert.equal(sanitizedDatabaseError({ code, message: 'SYNTHETIC_SECRET' }), 'TLS_CERTIFICATE_INVALID');
  }
  assert.equal(sanitizedDatabaseError({ meta: { driverAdapterError: {
    cause: { kind: 'TlsConnectionError', message: 'SYNTHETIC_SECRET' }
  } } }), 'TLS_CERTIFICATE_INVALID');
});
// truonglt CA trust and safe categories tests end
