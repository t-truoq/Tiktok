// truonglt gate1 remote evidence start
const fs = require('node:fs');
const { assertHealth } = require('./staging-contract.cjs');
const repo = 'https://api.github.com/repos/t-truoq/Tiktok';
const staging = 'https://tiktok-6kwu.onrender.com';
const headers = { 'User-Agent': 'TikTok-Gate-Verification', Accept: 'application/vnd.github+json' };

async function github(path) {
  const response = await fetch(repo + path, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error('GITHUB_EVIDENCE_UNAVAILABLE');
  return response.json();
}

async function health(endpoint, request = fetch) {
  const url = `${staging}/api/v1/health/${endpoint}`;
  const result = { url, endpoint, verifiedAtUtc: new Date().toISOString(), httpStatus: null,
    body: null, passed: false };
  try {
    const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(45000) });
    result.httpStatus = response.status;
    result.contentType = response.headers.get('content-type');
    const body = await response.json();
    // Record only the public health contract; never preserve arbitrary error stacks.
    result.body = Object.fromEntries(['status', 'database', 'tls', 'timezone', 'tlsScope',
      'tlsProtocol', 'postgresSessionTls'].filter(k => Object.hasOwn(body, k)).map(k => [k, body[k]]));
    // truonglt retain allowlisted remote configuration diagnostic start
    const codes = ['CA_FILE_NOT_FOUND', 'CA_FILE_UNREADABLE', 'TLS_CERTIFICATE_INVALID',
      'DATABASE_NOT_CONFIGURED', 'INVALID_DATABASE_CONFIGURATION', 'TLS_REQUIRED'];
    const reasons = ['CA_PEM_INVALID', 'CA_NOT_AUTHORITY', 'CA_CERTIFICATE_EXPIRED', 'CA_CERTIFICATE_NOT_YET_VALID'];
    if (codes.includes(body.code)) result.body.code = body.code;
    if (reasons.includes(body.reason)) result.body.reason = body.reason;
    // truonglt retain allowlisted remote configuration diagnostic end
    assertHealth(endpoint, response.status, body);
    result.passed = true;
  } catch (error) {
    result.errorCode = error.name === 'TimeoutError' ? 'TIMEOUT_NO_HTTP_EVIDENCE' : 'HEALTH_NOT_VERIFIED';
    const allowed = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
      'UND_ERR_CONNECT_TIMEOUT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED',
      'ERR_TLS_CERT_ALTNAME_INVALID', 'SELF_SIGNED_CERT_IN_CHAIN'];
    if (allowed.includes(error.cause?.code)) result.transportErrorCode = error.cause.code;
  }
  return result;
}

async function main() {
  const report = { capturedAtUtc: new Date().toISOString(), gate1: 'NOT_PASS', databaseWrites: false };
  const [http, ci] = await Promise.allSettled([
    Promise.all(['live', 'ready'].map(health)), github('/actions/runs?per_page=3')
  ]);
  report.staging = http.status === 'fulfilled' ? http.value : { status: 'EVIDENCE_UNAVAILABLE' };
  if (ci.status === 'fulfilled' && ci.value.workflow_runs.length) {
    const run = ci.value.workflow_runs[0];
    report.ci = { id: run.id, sha: run.head_sha, status: run.status, conclusion: run.conclusion, url: run.html_url };
    const jobs = await github(`/actions/runs/${run.id}/jobs`);
    report.ci.jobs = [];
    for (const job of jobs.jobs) {
      const evidence = { id: job.id, name: job.name, conclusion: job.conclusion,
        steps: job.steps.map(s => ({ name: s.name, conclusion: s.conclusion })) };
      if (job.conclusion === 'failure') {
        const annotations = await github(`/check-runs/${job.id}/annotations`);
        evidence.annotations = annotations.map(a => ({ level: a.annotation_level, message: a.message }));
      }
      report.ci.jobs.push(evidence);
    }
  } else report.ci = { status: 'EVIDENCE_UNAVAILABLE' };
  report.acceptanceMode = 'OWNER_CLI_RENDER_EXCEPTION';
  report.remoteHealthContractPass = Array.isArray(report.staging) && report.staging.every(r => r.passed);
  report.renderBuildEvidence = 'NOT_AVAILABLE';
  report.githubActions = report.ci.jobs?.some(j => j.annotations?.some(a =>
    a.message.includes('locked due to a billing issue'))) ? 'BLOCKED_BY_BILLING' : 'NOT_CERTIFIED';
  // A GET success alone cannot certify the separate Render build/revision requirement.
  fs.mkdirSync('docs/phase1', { recursive: true });
  fs.writeFileSync('docs/phase1/REMOTE_GATE1_EVIDENCE.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ gate1: report.gate1, ci: report.ci.conclusion,
    staging: Array.isArray(report.staging) ? report.staging.map(r => ({ endpoint: r.endpoint,
      httpStatus: r.httpStatus, passed: r.passed, errorCode: r.errorCode })) : report.staging }));
}
module.exports = { health };
if (require.main === module) main().catch(() => {
  console.error('GATE1_EVIDENCE_CAPTURE_FAILED'); process.exitCode = 1;
});
// truonglt gate1 remote evidence end
