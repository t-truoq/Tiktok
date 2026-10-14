// truonglt phase2 preservation and staging start
// Offline only: no database client, SQL execution, or import entry point.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const Decimal = require('decimal.js');
const { sha, sourcePath, PINNED_SHA256, decodeProperties } = require('../phase0/source-baseline.cjs');
const baseline = require('../../tests/golden/baseline-input.json');
const golden = require('../../tests/golden/baseline-expected.json');
const own = (o, k) => Object.hasOwn(o, k);

function mapValue(o, key, scale = 2, precision = 18) {
  if (!own(o, key)) return { state: 'MISSING', decimal: null };
  const raw = o[key];
  const state = raw === null ? 'NULL' : raw === '' ? 'BLANK' : Array.isArray(raw) ? 'ARRAY' :
    ({ number: 'NUMBER', string: 'TEXT', boolean: 'BOOLEAN', object: 'OBJECT' })[typeof raw];
  let decimal = null;
  // Numeric strings remain TEXT, never silently coerced into financial values.
  if (state === 'NUMBER') {
    if (!Number.isFinite(raw)) throw Error('NON_FINITE_NUMBER');
    if (Number.isInteger(raw) && !Number.isSafeInteger(raw)) throw Error('UNSAFE_NUMBER');
    const d = new Decimal(String(raw));
    if (d.decimalPlaces() > scale || d.abs().gte(new Decimal(10).pow(precision - scale)))
      throw Error('DECIMAL_REQUIRES_REVIEW');
    decimal = d.toFixed(scale);
  }
  return { state, raw, decimal };
}

function roundKey(key) {
  const m = /^(sample|end):([1-9]\d*)$/.exec(key);
  if (!m || BigInt(m[2]) > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('INVALID_DYNAMIC_ROUND');
  return { group: m[1].toUpperCase(), index: BigInt(m[2]).toString() };
}

function financialSlots(raw, pointer = '') {
  const slots = [];
  if (!raw || typeof raw !== 'object') return slots;
  for (const [key, value] of Object.entries(raw)) {
    const p = pointer + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
    if (/^(?:wholesale|price|endPrice|legacyPrice|profit|priceMau\d+|priceEnd\d+|qty|refundQty|qtySellEnd\d+|sellEndQty|sellEnd\d*|soldQty\d*|sellPrice\d*)$/.test(key))
      slots.push({ pointer: p, ...mapValue(raw, key, /qty/i.test(key) ? 3 : 2) });
    slots.push(...financialSlots(value, p));
  }
  return slots;
}

function prepare(bytes = fs.readFileSync(sourcePath)) {
  if (sha(bytes) !== PINNED_SHA256) throw Error('SOURCE_CHECKSUM_MISMATCH');
  const envelope = JSON.parse(bytes.toString('utf8'));
  const decoded = decodeProperties(envelope);
  const records = baseline.records.map(b => {
    const r = decoded.records.find(r => r.key === b.key);
    assert.deepStrictEqual(r.rawRecord, b.rawRecord);
    assert.equal(r.decodedJson, b.decodedJson);
    const raw = r.rawRecord;
    const expected = golden.records.find(e => e.key === b.key);
    return { key: b.key, classification: b.classification, manifest: r.manifest,
      chunks: r.chunks, decodedJson: r.decodedJson, decodedSha256: sha(r.decodedJson),
      rawRecord: raw, valueTypes: b.valueTypes,
      history: (raw.history || []).map((payload, index) => ({ key: `${b.key}/history/${index}`, index, payload })),
      snapshots: Object.entries(raw.stageData || {}).map(([label, payload]) => ({
        key: `${b.key}/stageData/${label}`, label, payload })),
      rounds: Object.entries(raw.purchaseState || {}).map(([key, payload]) => ({ key, ...roundKey(key), payload })),
      finance: Object.fromEntries(['wholesale', 'price', 'endPrice', 'qty', 'refundQty'].map(k =>
        [k, mapValue(raw, k, ['qty', 'refundQty'].includes(k) ? 3 : 2)])),
      financialSlots: financialSlots(raw),
      calculationProjection: expected.v91 };
  });
  const body = { mappingVersion: 'preservation-v1', sourceSha256: sha(bytes), records };
  const plan = { ...body, planSha256: sha(JSON.stringify(body)), originalBase64: bytes.toString('base64') };
  reconcile(plan);
  return plan;
}

function reconcile(plan) {
  const { mappingVersion, sourceSha256, records } = plan;
  assert.equal(sha(JSON.stringify({ mappingVersion, sourceSha256, records })), plan.planSha256, 'PLAN_CHECKSUM');
  const bytes = Buffer.from(plan.originalBase64, 'base64');
  assert.equal(sha(bytes), PINNED_SHA256, 'ARCHIVE_CHECKSUM');
  assert.equal(sourceSha256, PINNED_SHA256);
  const decoded = decodeProperties(JSON.parse(bytes.toString('utf8')));
  assert.equal(records.length, 46);
  assert.equal(new Set(records.map(r => r.key)).size, 46);
  for (const b of baseline.records) {
    const r = records.find(r => r.key === b.key);
    const source = decoded.records.find(r => r.key === b.key);
    assert.ok(r, 'MISSING_PRODUCT');
    assert.deepStrictEqual(r.rawRecord, b.rawRecord);
    assert.deepStrictEqual(r.rawRecord, source.rawRecord);
    assert.equal(r.decodedJson, source.decodedJson);
    assert.equal(r.decodedSha256, sha(source.decodedJson));
    assert.equal(r.manifest, source.manifest);
    assert.deepStrictEqual(r.chunks, source.chunks);
    assert.equal(r.classification, b.classification);
    assert.deepStrictEqual(r.valueTypes, b.valueTypes);
    assert.deepStrictEqual(r.history, (source.rawRecord.history || []).map((payload, index) =>
      ({ key: `${b.key}/history/${index}`, index, payload })));
    assert.deepStrictEqual(r.snapshots, Object.entries(source.rawRecord.stageData || {}).map(([label, payload]) =>
      ({ key: `${b.key}/stageData/${label}`, label, payload })));
    assert.deepStrictEqual(r.rounds, Object.entries(source.rawRecord.purchaseState || {}).map(([key, payload]) =>
      ({ key, ...roundKey(key), payload })));
    assert.deepStrictEqual(r.calculationProjection, golden.records.find(e => e.key === b.key).v91);
    assert.deepStrictEqual(r.finance, Object.fromEntries(['wholesale', 'price', 'endPrice', 'qty', 'refundQty'].map(k =>
      [k, mapValue(source.rawRecord, k, ['qty', 'refundQty'].includes(k) ? 3 : 2)])));
    assert.deepStrictEqual(r.financialSlots, financialSlots(source.rawRecord));
  }
  const result = { records: records.length, matched: records.filter(r => r.classification === 'XLSX_MATCHED').length,
    legacy: records.filter(r => r.classification === 'LEGACY_UNMATCHED').length,
    history: records.reduce((n, r) => n + r.history.length, 0), snapshots: records.reduce((n, r) => n + r.snapshots.length, 0) };
  assert.deepStrictEqual(result, { records: 46, matched: 24, legacy: 22, history: 1224, snapshots: 133 });
  return result;
}

function restore(plan) {
  reconcile(plan);
  return Buffer.from(plan.originalBase64, 'base64');
}

// Transaction reference contract for future DB adapter. Memory simulation only.
// Reserve batch + write all rows + reconcile + commit in ONE transaction.
// A failed transaction restores its prior state; committed immutable archives are retained.
class OfflineJournal {
  constructor() { this.state = new Map(); this.tail = Promise.resolve(); }
  apply(plan, failAt = Infinity) {
    const run = this.tail.then(() => {
      reconcile(plan);
      const key = `${plan.sourceSha256}:${plan.mappingVersion}`;
      const existing = this.state.get(key);
      if (existing) {
        if (existing.planSha256 !== plan.planSha256) throw Error('IDEMPOTENCY_CONFLICT');
        return { replay: true, ...existing.summary };
      }
      const candidate = { ...structuredClone(plan), records: [] };
      // Build transaction-local rows incrementally; an exception discards all of them.
      for (let i = 0; i < plan.records.length; i++) {
        candidate.records.push(structuredClone(plan.records[i]));
        if (i === failAt) throw Error('INJECTED_FAILURE');
      }
      const summary = reconcile(candidate);
      this.state.set(key, { planSha256: candidate.planSha256, summary, archive: candidate });
      return { replay: false, ...summary };
    });
    this.tail = run.catch(() => {});
    return run;
  }
}
module.exports = { mapValue, roundKey, prepare, reconcile, restore, OfflineJournal };
if (require.main === module) {
  const plan = prepare();
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/preservation-plan.json', JSON.stringify(plan));
  const slots = plan.records.flatMap(r => r.financialSlots);
  const report = { status: 'OFFLINE_PASS', ...reconcile(plan), sourceSha256: plan.sourceSha256,
    planSha256: plan.planSha256, financialSlotsChecked: slots.length,
    numericFinancialSlotsChecked: slots.filter(s => s.state === 'NUMBER').length,
    restoredByteLength: restore(plan).length, databaseExecuted: false, importApproved: false };
  fs.writeFileSync('docs/phase2/OFFLINE_VALIDATION.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}

// truonglt phase2 preservation and staging end
