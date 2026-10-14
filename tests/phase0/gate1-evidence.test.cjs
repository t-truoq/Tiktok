// truonglt gate1 evidence error tests start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { health } = require('../../scripts/phase2/capture-gate1.cjs');
test('evidence mock preserves HTTP failure/timeout and strips arbitrary secret error fields', async () => {
  const failure = await health('ready', async () => Response.json({ status: 503, password: 'SYNTHETIC_SECRET' }, { status: 503 }));
  assert.equal(failure.httpStatus, 503);
  assert.equal(failure.passed, false);
  assert.equal(JSON.stringify(failure).includes('SYNTHETIC_SECRET'), false);
  const timeout = await health('live', async () => { throw new DOMException('SYNTHETIC_SECRET', 'TimeoutError'); });
  assert.equal(timeout.httpStatus, null);
  assert.equal(timeout.errorCode, 'TIMEOUT_NO_HTTP_EVIDENCE');
  assert.equal(JSON.stringify(timeout).includes('SYNTHETIC_SECRET'), false);
  const success = await health('live', async () => Response.json({ status: 'ok' }));
  assert.equal(success.passed, true);
});
// truonglt gate1 evidence error tests end
