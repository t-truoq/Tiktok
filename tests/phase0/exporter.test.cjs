// truonglt phase0 exporter tests start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '../..');
const exporter = fs.readFileSync(path.join(root, 'scripts/migration/legacy-export-readonly.gs'), 'utf8');
const source = fs.readFileSync(path.join(root,
  'TikTok_Affiliate_Phase0_References/references/Tiktok_Affiliate_V9.1_Original_Backup.gs'), 'utf8');
const hash = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const record = { name: 'Fixture', schemaVersion: '9.1', stageData: {}, history: [],
  purchaseState: { 'sample:1': { ordered: true, received: false, verified: true } },
  priceMau1: 10, currentProgress: 'Đặt mẫu 1' };

function blob(data) {
  const bytes = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.from(data) : Buffer.from(String(data));
  return { getBytes: () => [...bytes], getDataAsString: () => bytes.toString('utf8') };
}

function environment(properties = {}, custom = {}) {
  const reads = [];
  const writes = [];
  const forbidden = name => () => { writes.push(name); throw Error('FORBIDDEN_WRITE_' + name); };
  const data = JSON.parse(JSON.stringify(properties));
  const props = new Proxy({ getProperty: key => {
    reads.push(key);
    return Object.hasOwn(data, key) ? data[key] : null;
  } }, { get(target, name) { return target[name] || forbidden(String(name)); } });
  const rows = custom.rows || [Array(19).fill(''), Array(19).fill(''),
    ['Fixture', '', 1, 'Đặt mẫu 1', '', '', '', 10, '', '', '', '', '', '', '', 0, 10, 0, 'Đã nhận']];
  const range = () => ({
    getValues: () => rows.map(r => [...r]),
    getDisplayValues: () => rows.map(r => r.map(String)),
    getFormulas: () => rows.map(r => r.map(() => '')),
    getNotes: () => rows.map(r => r.map(() => '')),
    getNumberFormats: () => rows.map(r => r.map(() => 'General')),
  });
  const sheet = new Proxy({ getLastRow: () => rows.length, getLastColumn: () => 19,
    getRange: range, getImages: () => [], getName: () => 'Trang tính2', getSheetId: () => 1 },
    { get(target, name) { return target[name] || forbidden(String(name)); } });
  const ss = new Proxy({ getSheetByName: () => sheet, getSheets: () => [sheet],
    getName: () => 'Fixture workbook', getId: () => 'fixture-id', getSpreadsheetTimeZone: () => 'Asia/Ho_Chi_Minh' },
    { get(target, name) { return target[name] || forbidden(String(name)); } });
  let saved;
  const runtime = vm.createContext({ Date, Logger: { log: () => {} },
    Session: { getScriptTimeZone: () => 'Asia/Ho_Chi_Minh' },
    PropertiesService: { getDocumentProperties: () => props },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, ValueType: { IMAGE: 'IMAGE' } },
    LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    DriveApp: { createFile: b => {
      saved = JSON.parse(b.getDataAsString());
      return { getBlob: () => b, getId: () => 'new-export-file', getUrl: () => 'https://drive.google.com/file/d/fixture' };
    } },
    Utilities: { DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF-8' },
      computeDigest: (_, value) => [...crypto.createHash('sha256').update(value).digest()],
      newBlob: blob, base64Decode: text => [...Buffer.from(text, 'base64')],
      ungzip: b => blob(zlib.gunzipSync(Buffer.from(b.getBytes()))),
      formatDate: d => d.toISOString().slice(0, 19).replace('T', ' ') },
  });
  vm.runInContext(source, runtime);
  vm.runInContext(exporter, runtime);
  return { runtime, props, reads, writes, data, rows, saved: () => saved };
}

function compressed(json, chunkSize = 7300) {
  const encoded = zlib.gzipSync(Buffer.from(json)).toString('base64');
  const parts = encoded.match(new RegExp(`[\\s\\S]{1,${chunkSize}}`, 'g'));
  const key = 'AFF_PRODUCT_fixture';
  const version = '012345abcdef';
  return { [key]: `AFFZ91|${version}|${parts.length}|${encoded.length}`,
    ...Object.fromEntries(parts.map((value, index) => [`${key}__${version}_${index}`, value])) };
}

test('exporter has no source mutation or destructive legacy calls', () => {
  assert.doesNotMatch(exporter, /\.(?:setProperty|setProperties|deleteProperty|deleteAllProperties|setValue|setValues|clearContent|insertSheet|deleteTrigger)\s*\(/);
  assert.doesNotMatch(exporter, /\b(?:loadRecord|saveRecord|setupAffiliateAutomation|repairAffiliateFinancialData|syncCurrentOrder91|auditPaymentSummary)\s*\(/);
});

test('raw JSON bytes, full history, extra S column and original state survive export', () => {
  const json = JSON.stringify(record, null, 2);
  const env = environment({ AFF_PRODUCT_fixture: json, AFF_PRODUCT_stale: 'do not read', SECRET: 'do not read' });
  const before = JSON.stringify(env.data);
  const summary = env.runtime.exportAffiliatePhase0ReadOnly();
  const envelope = env.saved();
  assert.equal(envelope.payloadSha256, hash(envelope.payloadJson));
  const payload = JSON.parse(envelope.payloadJson);
  assert.equal(payload.records[0].decodedJson, json);
  assert.deepEqual(payload.records[0].rawRecord, record);
  assert.equal(payload.records[0].decodedSha256, hash(json));
  assert.equal(payload.records[0].rows[0].values[18].value, 'Đã nhận');
  assert.equal(payload.records[0].oracle.summary.unpaid, 10);
  assert.equal(payload.reconciliationStatus, 'NOT_RUN');
  assert.equal(summary.exportComplete, true);
  assert.equal(JSON.stringify(env.data), before);
  assert.deepEqual(env.writes, []);
  assert.ok(env.reads.every(key => key === 'AFF_PRODUCT_fixture'));
});

test('gzip/base64 multiple chunks decode exact original JSON without normalization', () => {
  const json = JSON.stringify({ ...record, history: [{ data: crypto.randomBytes(16000).toString('hex') }] });
  const env = environment(compressed(json));
  const decoded = env.runtime.affExportP0ReadRecord(env.props, 'AFF_PRODUCT_fixture', new Map());
  assert.equal(decoded.decodedJson, json);
  assert.ok(decoded.chunks.length > 1);
  assert.equal(decoded.decodedSha256, hash(json));
  assert.deepEqual(env.writes, []);
});

for (const [name, properties, expected] of [
  ['missing record', {}, 'MISSING_RECORD'],
  ['zero count', { AFF_PRODUCT_fixture: 'AFFZ91|012345abcdef|0|8' }, 'INVALID_MANIFEST'],
  ['too many chunks', { AFF_PRODUCT_fixture: 'AFFZ91|012345abcdef|151|8' }, 'INVALID_MANIFEST'],
  ['invalid version', { AFF_PRODUCT_fixture: 'AFFZ91|../../unsafe|1|8' }, 'INVALID_MANIFEST'],
  ['extra manifest field', { AFF_PRODUCT_fixture: 'AFFZ91|012345abcdef|1|8|extra' }, 'INVALID_MANIFEST'],
  ['missing chunk', { AFF_PRODUCT_fixture: 'AFFZ91|012345abcdef|1|8' }, 'MISSING_CHUNK_0'],
  ['wrong size', { AFF_PRODUCT_fixture: 'AFFZ91|012345abcdef|1|8', AFF_PRODUCT_fixture__012345abcdef_0: 'AAAA' }, 'BASE64_SIZE_MISMATCH'],
  ['invalid base64', { AFF_PRODUCT_fixture: 'AFFZ91|012345abcdef|1|4', AFF_PRODUCT_fixture__012345abcdef_0: '!!!!' }, 'INVALID_BASE64'],
  ['invalid gzip', { AFF_PRODUCT_fixture: 'AFFZ91|012345abcdef|1|4', AFF_PRODUCT_fixture__012345abcdef_0: 'AAAA' }, 'GZIP_DECODE_FAILED'],
  ['invalid JSON', { AFF_PRODUCT_fixture: '{broken' }, 'JSON'],
]) {
  test(`${name} blocks complete export and preserves source`, () => {
    const env = environment(properties);
    const before = JSON.stringify(env.data);
    const summary = env.runtime.exportAffiliatePhase0ReadOnly();
    const payload = JSON.parse(env.saved().payloadJson);
    assert.equal(summary.exportComplete, false);
    assert.equal(payload.problems[0].code, 'RECORD_EXPORT_FAILED');
    assert.match(payload.problems[0].message, new RegExp(expected));
    assert.equal(JSON.stringify(env.data), before);
    assert.deepEqual(env.writes, []);
  });
}

test('duplicate normalized names are captured as rows and block exportComplete', () => {
  const rows = [Array(19).fill(''), Array(19).fill(''),
    ['Fixture', '', 1, 'Đặt mẫu 1', '', '', '', 10, '', '', '', '', '', '', '', 0, 10, 0, ''],
    ['  FIXTURE ', '', 1, 'Đặt mẫu 1', '', '', '', 10, '', '', '', '', '', '', '', 0, 10, 0, '']];
  const env = environment({ AFF_PRODUCT_fixture: JSON.stringify(record) }, { rows });
  env.runtime.exportAffiliatePhase0ReadOnly();
  const payload = JSON.parse(env.saved().payloadJson);
  assert.equal(payload.records.length, 1);
  assert.equal(payload.records[0].rows.length, 2);
  assert.equal(payload.exportComplete, false);
  assert.ok(payload.problems.some(p => p.code === 'DUPLICATE_ROOT_NAME'));
});

test('change during read invalidates snapshot without writing source', () => {
  const env = environment({ AFF_PRODUCT_fixture: JSON.stringify(record) });
  const original = env.props.getProperty;
  let calls = 0;
  env.props.getProperty = key => { calls++; return calls === 2 ? '{}' : original(key); };
  env.runtime.exportAffiliatePhase0ReadOnly();
  const payload = JSON.parse(env.saved().payloadJson);
  assert.equal(payload.sourceReadStable, false);
  assert.equal(payload.exportComplete, false);
  assert.deepEqual(env.writes, []);
});
// truonglt phase0 exporter tests end
