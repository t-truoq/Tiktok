// truonglt Phase3 independent source parity tests start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Decimal = require('decimal.js');
const engine = require('../dist/finance/engine');
const root = path.resolve(__dirname, '../../..');
const { sourceRuntime, oracle } = require(path.join(root, 'scripts/phase0/source-baseline.cjs'));
const input = JSON.parse(fs.readFileSync(path.join(root, 'tests/golden/baseline-input.json')));
const expected = JSON.parse(fs.readFileSync(path.join(root, 'tests/golden/baseline-expected.json')));
const runtimes = expected.sourceAlgorithms.map(x => sourceRuntime(x.filename));
function compare(actual, reference) {
  for (const k of ['paid', 'unpaid', 'incurred', 'sampleTotal', 'endTotal']) assert(new Decimal(actual.payment[k]).eq(reference.payment[k]), k);
  for (const k of ['missing', 'review']) assert.equal(actual.payment[k], reference.payment[k]);
  assert.deepEqual(actual.refund, { total: String(reference.refund.total), missing: reference.refund.missing });
  assert(new Decimal(actual.projectedProfit).eq(reference.projectedProfit));
  assert.deepEqual(actual.payment.details, reference.payment.details.map(d => ({ ...d, amount: d.amount === null ? null : String(d.amount) })));
}
for (const [i, record] of input.records.entries()) test(`finance parity ${record.key}`, () => {
  const before = JSON.stringify(record.rawRecord), actual = engine.calculateFinance(record.rawRecord);
  compare(actual, expected.records[i].v91);
  for (const runtime of runtimes) compare(actual, oracle(runtime, record.rawRecord));
  assert.equal(JSON.stringify(record.rawRecord), before);
});
test('active 24 regression aggregates calculated, not hardcoded engine', () => {
  const totals = { paid: new Decimal(0), unpaid: new Decimal(0), refund: new Decimal(0), profit: new Decimal(0) };
  for (const item of input.records.filter(r => r.classification === 'XLSX_MATCHED')) {
    const result = engine.calculateFinance(item.rawRecord);
    totals.paid = totals.paid.plus(result.payment.paid); totals.unpaid = totals.unpaid.plus(result.payment.unpaid);
    totals.refund = totals.refund.plus(result.refund.total); totals.profit = totals.profit.plus(result.projectedProfit);
  }
  assert.deepEqual(Object.fromEntries(Object.entries(totals).map(([k,v]) => [k, v.toString()])), {
    paid: '144155159', unpaid: '25352082', refund: '53288699', profit: '33059918' });
});
test('dynamic rounds, precision, refund eligibility does not use actual cash refund', () => {
  const raw = { schemaVersion: '9.1', wholesale: '0.1', qty: '0.2', purchaseState: {
    'sample:3': { ordered: true, received: false, verified: false }, 'end:3': { ordered: true, received: true, verified: true } },
    priceMau3: '1.23', priceEnd3: '0.02', sellEnd3: '0.1', qtySellEnd3: '0.2', actualRefundData: { amount: '999' } };
  const result = engine.calculateFinance(raw);
  assert.equal(result.projectedProfit, '0.02'); assert.equal(result.refund.total, '1.23');
  assert.equal(result.payment.review, 1); assert.equal(result.payment.unpaid, '1.23');
});
test('missing/null/blank/zero preserve inputs and source ledger semantics', () => {
  for (const value of [undefined, null, '', 0, '0']) {
    const r = { schemaVersion: '9.1', purchaseState: { 'sample:1': { ordered: true } } };
    if (value !== undefined) r.priceMau1 = value;
    const before = structuredClone(r); const result = engine.calculateFinance(r); assert.deepEqual(r, before);
    assert.equal(result.payment.missing, value === 0 || value === '0' ? 0 : 1);
  }
});
test('stage parser safe integer, aliases and timing boundaries', () => {
  assert.equal(engine.parseStage(' Nhận Sample 3 ').label, 'Nhận mẫu 3');
  assert.equal(engine.parseStage('Đặt End 9007199254740991').index, Number.MAX_SAFE_INTEGER);
  assert.throws(() => engine.parseStage('Đặt End 9007199254740992'));
  const date = new Date('2026-01-01T00:00:00Z');
  assert.equal(engine.calculateStatus('Nhận mẫu 3', date, '', '', new Date(date.getTime()+86400000-1)), 'Chờ đủ 1 ngày');
  assert.equal(engine.calculateStatus('Nhận mẫu 3', date, '', '', new Date(date.getTime()+86400000)), 'Có thể đặt lượt tiếp theo');
  assert.equal(engine.calculateStatus('Nhận End 3', date, '', '', new Date(date.getTime()+15*86400000)), '⚠️ Cần check hoàn tiền');
  assert.equal(engine.calculateStatus('Nhận mẫu 3', date, 'Đã hoàn', 'hết hàng', date), 'Đã hoàn');
});
test('status parity both sources with injected clock at 24h/15d/30d boundaries', () => {
  for (const runtime of runtimes) {
    for (const offset of [0, 86400000-1, 86400000, 15*86400000-1, 15*86400000, 30*86400000-1, 30*86400000]) {
      const start = new Date('2026-01-01T00:00:00Z'), clock = new Date(start.getTime()+offset);
      class ReferenceDate extends Date { constructor(value) { super(value === undefined ? clock.getTime() : value); } }
      runtime.context.Date = ReferenceDate;
      for (const [stage,note,status] of [['Nhận mẫu 3','',''],['Nhận mẫu 3','hết hàng',''],['Nhận End 3','',''],['Nhận End 3','','Đã hoàn'],['Đặt End 3','',''],['Done','','']]) {
        const reference = runtime.context.calculateStatus(stage,null,new ReferenceDate(start.toISOString()),status,note).status;
        assert.equal(engine.calculateStatus(stage,start,status,note,clock),reference);
      }
    }
  }
});
// truonglt Phase3 independent source parity tests end
