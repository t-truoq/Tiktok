// truonglt phase2 preservation and staging start
const assert = require('node:assert/strict');
function assertHealth(endpoint, status, body) {
  assert.equal(status, 200);
  assert.equal(body.status, endpoint === 'live' ? 'ok' : 'ready');
  if (endpoint === 'ready') {
    assert.equal(body.database, 'ok');
    assert.equal(body.tls, true);
    assert.equal(body.timezone, 'UTC');
    assert.equal(body.tlsScope, 'client-to-endpoint');
    assert.ok(['TLSv1.2', 'TLSv1.3'].includes(body.tlsProtocol));
    assert.equal(typeof body.postgresSessionTls, 'boolean');
  }
}
module.exports = { assertHealth };

// truonglt phase2 preservation and staging end
