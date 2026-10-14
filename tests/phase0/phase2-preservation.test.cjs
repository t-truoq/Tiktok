// truonglt phase2 preservation and staging start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { sourcePath, sha } = require('../../scripts/phase0/source-baseline.cjs');
const { prepare, reconcile, restore, mapValue, roundKey, OfflineJournal } = require('../../scripts/phase2/preservation.cjs');
const plan = prepare();

test('persisted JSON plan restores original bytes, properties, raw records and all events', () => {
  const persisted = JSON.parse(JSON.stringify(plan));
  const bytes = restore(persisted);
  assert.deepStrictEqual(bytes, fs.readFileSync(sourcePath));
  assert.deepStrictEqual(JSON.parse(bytes), JSON.parse(fs.readFileSync(sourcePath)));
  assert.deepStrictEqual(reconcile(persisted), { records: 46, matched: 24, legacy: 22, history: 1224, snapshots: 133 });
});

for (const [name, change] of Object.entries({
  archive: p => { p.originalBase64 = Buffer.from('{}').toString('base64'); },
  removedRecord: p => p.records.pop(),
  removedEvent: p => p.records.find(r => r.history.length).history.pop(),
  changedSnapshot: p => { p.records.find(r => r.snapshots.length).snapshots[0].payload = null; },
  changedState: p => { p.records.find(r => r.rounds.length).rounds[0].payload.verified = true; },
  changedPrice: p => { p.records[0].finance.price = { state: 'NUMBER', decimal: '0.00', raw: 0 }; },
  changedProjection: p => { p.records[0].calculationProjection = {}; },
  duplicate: p => { p.records[0] = p.records[1]; }
})) test(`reconciliation rejects ${name} even if plan hash is recalculated`, () => {
  const p = structuredClone(plan); change(p);
  p.planSha256 = sha(JSON.stringify({ mappingVersion: p.mappingVersion, sourceSha256: p.sourceSha256, records: p.records }));
  assert.throws(() => restore(p));
});

test('Decimal mapping distinguishes missing/null/blank/zero/text and never rounds silently', () => {
  const o = { nil: null, blank: '', zero: 0, text: '0', negative: -12.25, fraction: 1.234 };
  assert.deepStrictEqual(mapValue(o, 'absent'), { state: 'MISSING', decimal: null });
  assert.equal(Object.hasOwn(mapValue(o, 'absent'), 'raw'), false);
  assert.deepStrictEqual(mapValue(o, 'nil'), { state: 'NULL', raw: null, decimal: null });
  assert.deepStrictEqual(mapValue(o, 'blank'), { state: 'BLANK', raw: '', decimal: null });
  assert.deepStrictEqual(mapValue(o, 'zero'), { state: 'NUMBER', raw: 0, decimal: '0.00' });
  assert.deepStrictEqual(mapValue(o, 'text'), { state: 'TEXT', raw: '0', decimal: null });
  assert.equal(mapValue(o, 'negative').decimal, '-12.25');
  assert.throws(() => mapValue(o, 'fraction'), /DECIMAL_REQUIRES_REVIEW/);
  assert.equal(mapValue(o, 'fraction', 3).decimal, '1.234');
  assert.throws(() => mapValue({ x: 1e16 }, 'x'));
  assert.throws(() => mapValue({ x: 1e15 }, 'x', 3));
});

test('dynamic rounds preserve arbitrary supported indexes without fixed round limit', () => {
  for (const i of ['1', '25', '1000', '9007199254740991'])
    assert.deepStrictEqual(roundKey(`end:${i}`), { group: 'END', index: i });
  for (const k of ['end:0', 'end:-1', 'end:01', 'end:9007199254740992', 'foo:2'])
    assert.throws(() => roundKey(k));
});

test('failure at every record leaves zero committed rows; retry and concurrent replay commit once', async () => {
  const journal = new OfflineJournal();
  for (let i = 0; i < 46; i++) {
    await assert.rejects(journal.apply(plan, i), /INJECTED_FAILURE/);
    assert.equal(journal.state.size, 0);
  }
  const results = await Promise.all(Array.from({ length: 8 }, () => journal.apply(plan)));
  assert.equal(results.filter(r => !r.replay).length, 1);
  assert.equal(journal.state.size, 1);
  const retained = [...journal.state.values()][0];
  assert.deepStrictEqual(restore(retained.archive), fs.readFileSync(sourcePath));
  retained.planSha256 = 'different';
  await assert.rejects(journal.apply(plan), /IDEMPOTENCY_CONFLICT/);
});

// truonglt phase2 preservation and staging end
