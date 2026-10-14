// truonglt production CLI smoke verification start
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');

async function main() {
  assert.ok(fs.existsSync(path.join(root, 'apps/api/dist/main.js')), 'BUILD_REQUIRED');
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  assert.ok(fs.existsSync(npmCli), 'RUN_THROUGH_NPM_SCRIPT');
  const child = spawn(process.execPath, [npmCli, 'run', 'start:prod'], {
    cwd: root, windowsHide: true, detached: process.platform !== 'win32', stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production', HOST: '0.0.0.0', PORT: String(port) }
  });
  let failed = false;
  let evidence;
  child.on('error', () => { failed = true; });
  try {
    const deadline = Date.now() + 15000;
    let response;
    while (Date.now() < deadline && !failed && child.exitCode === null) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/api/v1/health/live`, {
          signal: AbortSignal.timeout(1000)
        });
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    assert.ok(response, 'START_PROD_DID_NOT_LISTEN');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepStrictEqual(body, { status: 'ok' });
    evidence = { status: 'PASS', verifiedAtUtc: new Date().toISOString(),
      command: 'npm run start:prod', entrypoint: 'apps/api/dist/main.js',
      environment: 'production', host: '0.0.0.0', portSource: 'process.env.PORT',
      testedPort: port, endpoint: '/api/v1/health/live', httpStatus: response.status, body,
      node: process.version, databaseWrites: false, runtime: 'LOCAL_COMPILED_PRODUCTION_CLI' };
  } finally {
    // Kill only the child process tree created above; never leave a background service.
    if (child.pid) {
      if (process.platform === 'win32') {
        const cleanup = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true, stdio: 'ignore'
        });
        if (cleanup.status !== 0 && child.exitCode === null) throw Error('TEST_PROCESS_CLEANUP_FAILED');
      } else {
        try { process.kill(-child.pid, 'SIGTERM'); } catch {}
      }
    }
  }
  evidence.processCleanup = 'PASS';
  fs.writeFileSync(path.join(root, 'docs/phase1/START_PROD_VERIFICATION.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
}
main().catch(() => { console.error('START_PROD_VERIFICATION_FAILED'); process.exitCode = 1; });
// truonglt production CLI smoke verification end
