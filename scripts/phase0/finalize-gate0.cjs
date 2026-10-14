// truonglt gate0 evidence finalization start
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { sha, PINNED_SHA256, sourcePath } = require('./source-baseline.cjs');
const root = path.resolve(__dirname, '../..');
const py = process.platform === 'win32' ? 'py' : 'python';
const run = (exe, args) => execFileSync(exe, args, { cwd: root, encoding: 'utf8' });
run(py, ['scripts/phase0/verify_baseline.py']);
const independent = JSON.parse(fs.readFileSync(path.join(root, 'docs/phase0/INDEPENDENT_VALIDATION.json'), 'utf8'));
if (independent.status !== 'PASS' || sha(fs.readFileSync(sourcePath)) !== PINNED_SHA256) throw Error('GATE0_VALIDATION_REQUIRED');
const tests = fs.readdirSync(path.join(root, 'tests/phase0')).filter(name => name.endsWith('.test.cjs'))
  .map(name => 'tests/phase0/' + name);
const tap = run(process.execPath, ['--test', '--test-reporter=tap', ...tests]);
const count = /# tests (\d+)/.exec(tap)?.[1];
if (!count || !/# fail 0\b/.test(tap)) throw Error('NODE_TESTS_REQUIRED');
run(py, ['-m', 'unittest', 'discover', '-s', 'tests/phase0', '-p', '*_test.py']);
const summaryPath = path.join(root, 'docs/phase0/SOURCE_BASELINE_VALIDATION.json');
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
for (const [file, key] of [['baseline-input.json', 'baselineInputSha256'], ['baseline-expected.json', 'baselineExpectedSha256']]) {
  if (sha(fs.readFileSync(path.join(root, 'tests/golden', file))) !== summary[key]) throw Error('FIXTURE_CHECKSUM_CHANGED');
}
summary.independentValidation = 'PASS';
summary.gate0Status = 'PASS_OWNER_CONFIRMED_SOURCE_BASELINE';
summary.sourceDecisionDate = '2026-10-14';
summary.nodeTestsPassed = Number(count);
summary.pythonTests = 'unittest discovery passed; detailed cases in tests/phase0/*_test.py';
summary.importApproved = false;
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'tests/golden/baseline-input.json'), 'utf8'));
const byKey = new Map(baseline.records.map(r => [r.key, r]));
const fields = ['kind', 'classification', 'name', 'key', 'round', 'origin', 'issue', 'resolution'];
const quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
const lines = [fields.map(quote).join(',')];
for (const finding of summary.findings) {
  const record = byKey.get(finding.key);
  const row = { ...finding, classification: record.classification, name: record.rawRecord.name };
  lines.push(fields.map(field => quote(row[field])).join(','));
}
fs.writeFileSync(path.join(root, 'docs/phase0/SOURCE_FINDINGS.csv'), '\uFEFF' + lines.join('\r\n') + '\r\n');
console.log(JSON.stringify({ gate0: summary.gate0Status, records: summary.records,
  historyEvents: summary.rawHistoryCount, snapshots: summary.rawSnapshotCount,
  nodeTestsPassed: summary.nodeTestsPassed, independent: 'PASS', findings: summary.findings.length,
  importApproved: false }));
// truonglt gate0 evidence finalization end
