// truonglt source of truth tests start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { decodeProperties, sourceRuntime, oracle, valueTypes, sha, PINNED_SHA256, sourcePath } =
  require('../../scripts/phase0/source-baseline.cjs');
const root = path.resolve(__dirname, '../..');
const bytes = fs.readFileSync(sourcePath);
const source = JSON.parse(bytes.toString('utf8'));
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'tests/golden/baseline-input.json'), 'utf8'));
const expected = JSON.parse(fs.readFileSync(path.join(root, 'tests/golden/baseline-expected.json'), 'utf8'));
const a = sourceRuntime('Tiktok_Affiliate_V9.1_Original_Backup.gs');
const b = sourceRuntime('Tiktok_Affiliate_V9.2_Optimized.gs');

test('owner-approved exact source checksum, all 71 properties and 46 roots accounted', () => {
  assert.equal(sha(bytes), PINNED_SHA256);
  assert.equal(a.sha256, expected.sourceAlgorithms.find(s => s.filename === a.filename).sha256);
  assert.equal(b.sha256, expected.sourceAlgorithms.find(s => s.filename === b.filename).sha256);
  const decoded = decodeProperties(source);
  assert.equal(decoded.records.length, 46);
  assert.equal(decoded.records.reduce((n, r) => n + 1 + r.chunks.length, 0) + decoded.otherProperties.length, 71);
  assert.deepEqual(decoded.otherProperties, baseline.otherProperties);
  assert.equal(baseline.records.filter(r => r.classification === 'XLSX_MATCHED').length, 24);
  assert.equal(baseline.records.filter(r => r.classification === 'LEGACY_UNMATCHED').length, 22);
});

for (const item of baseline.records) {
  test(`preserve source, all history/state/snapshots/types and V91/V92 oracle: ${item.key}`, () => {
    const decoded = decodeProperties(source).records.find(r => r.key === item.key);
    const golden = expected.records.find(r => r.key === item.key);
    assert.equal(decoded.decodedJson, item.decodedJson);
    assert.equal(decoded.manifest, item.manifest);
    assert.equal(sha(decoded.manifest), item.manifestSha256);
    assert.deepEqual(decoded.chunks, item.chunks);
    assert.equal(sha(decoded.decodedJson), item.decodedSha256);
    assert.deepEqual(decoded.rawRecord, item.rawRecord);
    assert.deepEqual(valueTypes(item.rawRecord), item.valueTypes);
    const before = JSON.stringify(item.rawRecord);
    assert.deepEqual(oracle(a, item.rawRecord), golden.v91);
    assert.deepEqual(oracle(b, item.rawRecord), golden.v91);
    assert.equal(JSON.stringify(item.rawRecord), before);
    assert.equal((item.rawRecord.history || []).length, golden.rawHistoryCount);
    assert.equal(sha(JSON.stringify(item.rawRecord.history || [])), golden.historySha256);
    assert.equal(sha(JSON.stringify(item.rawRecord.stageData || {})), golden.snapshotsSha256);
    assert.equal(Object.hasOwn(item.rawRecord, 'purchaseState'), golden.rawStatePresence);
    assert.equal(Object.hasOwn(item.rawRecord, 'purchaseState') ? sha(JSON.stringify(item.rawRecord.purchaseState)) : null,
      golden.rawStateSha256);
  });
}

test('null, blank, zero, numeric text and missing are distinct; baseline is not import approval', () => {
  assert.deepEqual(valueTypes({ a: null, b: '', c: 0, d: '0' }).map(x => x.type), ['null', 'blank', 'zero', 'string']);
  assert.equal(valueTypes({}).length, 0);
  assert.equal(expected.importApproved, false);
});

for (const [name, mutate] of [
  ['missing chunk', props => { delete props[Object.keys(props).find(k => /__[a-f0-9]{12}_0$/.test(k))]; }],
  ['bad encoded size', props => { const k = Object.keys(props).find(k => props[k].startsWith('AFFZ91|'));
    props[k] = props[k].replace(/\|\d+$/, '|1'); }],
  ['invalid gzip', props => { const k = Object.keys(props).find(k => props[k].startsWith('AFFZ91|'));
    const version = props[k].split('|')[1]; props[k] = `AFFZ91|${version}|1|4`; props[k + '__' + version + '_0'] = 'AAAA'; }],
  ['orphan product chunk', props => { props.AFF_PRODUCT_orphan__abcdefabcdef_0 = 'AAAA'; }],
]) {
  test(`reject corruption: ${name}`, () => {
    const altered = structuredClone(source);
    mutate(altered.properties);
    assert.throws(() => decodeProperties(altered));
  });
}
// truonglt source of truth tests end
