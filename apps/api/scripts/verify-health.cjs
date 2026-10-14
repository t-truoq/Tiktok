// truonglt phase1 real health verification start
const { resolve } = require('node:path');
const { writeFileSync, mkdirSync } = require('node:fs');
require('dotenv').config({ path: resolve(__dirname, '../.env'), quiet: true });
const { createApp } = require('../dist/app');

async function main() {
  if (process.env.DB_ENVIRONMENT !== 'DEV' || !process.env.DATABASE_URL) {
    throw Error('DEV_CONFIG_REQUIRED');
  }
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const evidence = [];
    for (const endpoint of ['live', 'ready']) {
      const response = await fetch(base + '/api/v1/health/' + endpoint);
      const body = await response.json();
      if (response.status !== 200 || (endpoint === 'ready' &&
          (body.tls !== true || body.timezone !== 'UTC'))) throw Error('HEALTH_VERIFICATION_FAILED');
      evidence.push({ endpoint, httpStatus: response.status, body,
        verifiedAtUtc: new Date().toISOString(), runtime: 'LOCAL_NESTJS_REAL_DEV_DATABASE' });
    }
    const directory = resolve(__dirname, '../../../docs/phase1');
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, 'live-health-verification.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence));
  } finally {
    await app.close();
  }
}
main().catch(() => {
  console.error(JSON.stringify({ status: 'FAIL', code: 'HEALTH_VERIFICATION_FAILED' }));
  process.exitCode = 1;
});
// truonglt phase1 real health verification end
