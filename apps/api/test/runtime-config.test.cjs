// truonglt render runtime binding tests start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { listenHost } = require('../dist/runtime-config');
test('production binds Render interface; development and explicit host retain their intended bindings', () => {
  assert.equal(listenHost({ NODE_ENV: 'production' }), '0.0.0.0');
  assert.equal(listenHost({ NODE_ENV: 'development' }), '127.0.0.1');
  assert.equal(listenHost({}), '127.0.0.1');
  assert.equal(listenHost({ NODE_ENV: 'production', HOST: '127.0.0.2' }), '127.0.0.2');
});
// truonglt render runtime binding tests end
