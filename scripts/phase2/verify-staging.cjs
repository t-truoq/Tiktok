// truonglt phase2 preservation and staging start
const fs = require('node:fs');
const { assertHealth } = require('./staging-contract.cjs');
async function main() {
  const base = new URL(process.env.STAGING_BASE_URL);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash)
    throw Error('HTTPS_STAGING_URL_REQUIRED');
  const evidence = { verifiedAtUtc: new Date().toISOString(), runtime: 'REMOTE_STAGING', endpoints: [] };
  for (const endpoint of ['live', 'ready']) {
    const response = await fetch(new URL(`/api/v1/health/${endpoint}`, base), {
      redirect: 'error', signal: AbortSignal.timeout(45000), headers: { 'Cache-Control': 'no-cache' }
    });
    const body = await response.json();
    assertHealth(endpoint, response.status, body);
    evidence.endpoints.push({ endpoint, httpStatus: response.status, body });
  }
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/staging-health.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log('Remote staging liveness/readiness: PASS');
}
main().catch(() => { console.error('STAGING_VERIFICATION_FAILED'); process.exitCode = 1; });

// truonglt phase2 preservation and staging end
