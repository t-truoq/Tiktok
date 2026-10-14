// truonglt read-only TLS trust comparison start
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { X509Certificate } = require('node:crypto');
const { TLSSocket, checkServerIdentity } = require('node:tls');
const root = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(root, 'apps/api/.env'), quiet: true });
const { databaseConnectionOptions, sanitizedDatabaseError } = require('../../apps/api/dist/database');

async function main() {
  if (process.env.DB_ENVIRONMENT !== 'DEV') throw Error('DEV_REQUIRED');
  const config = databaseConnectionOptions(process.env.DATABASE_URL);
  const cert = new X509Certificate(config.ssl.ca);
  const result = { runtime: 'LOCAL_NODE_TRUST_COMPARISON', platform: process.platform,
    verifiedAtUtc: new Date().toISOString(), fingerprint256: cert.fingerprint256,
    sqlExecuted: false, databaseWrites: false, attempts: [] };
  for (const { configuredCA, wrongHostname } of [
    { configuredCA: false, wrongHostname: false },
    { configuredCA: true, wrongHostname: false },
    { configuredCA: true, wrongHostname: true }
  ]) {
    const client = new Client({ ...config, connectionTimeoutMillis: 5000,
      // pg sets SNI from the URL host. Negative test uses Node's standard verifier
      // against a deliberately wrong identity, without bypassing certificate checks.
      ssl: configuredCA ? { ...config.ssl, ...(wrongHostname ? {
        checkServerIdentity: (_hostname, certificate) => checkServerIdentity('unrelated.invalid', certificate)
      } : {}) } :
        { rejectUnauthorized: true, servername: config.ssl.servername } });
    client.on('error', () => {});
    try {
      await client.connect();
      const socket = client.connection.stream;
      result.attempts.push({ configuredCA, wrongHostname, status: 'PASS', encrypted: socket instanceof TLSSocket && socket.encrypted,
        authorized: socket instanceof TLSSocket && socket.authorized, protocol: socket.getProtocol() });
    } catch (error) {
      result.attempts.push({ configuredCA, wrongHostname, status: 'FAIL', category: sanitizedDatabaseError(error),
        ...(['SELF_SIGNED_CERT_IN_CHAIN', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(error.code) ? { driverCode: error.code } : {}) });
    } finally { await client.end(); }
  }
  if (result.attempts[1].status !== 'PASS' || !result.attempts[1].authorized) throw Error('CONFIGURED_CA_NOT_VERIFIED');
  if (result.attempts[2].driverCode !== 'ERR_TLS_CERT_ALTNAME_INVALID') throw Error('HOSTNAME_REJECTION_NOT_VERIFIED');
  fs.writeFileSync(path.join(root, 'docs/phase1/CA_TRUST_COMPARISON.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
main().catch(() => { console.error('CA_TRUST_COMPARISON_FAILED'); process.exitCode = 1; });
// truonglt read-only TLS trust comparison end
