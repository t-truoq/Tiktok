// truonglt phase0 source oracle tests start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const referenceDir = path.join(root, 'TikTok_Affiliate_Phase0_References/references');
const versions = ['Tiktok_Affiliate_V9.1_Original_Backup.gs', 'Tiktok_Affiliate_V9.2_Optimized.gs'];

function context(version) {
  const forbidden = () => { throw Error('FORBIDDEN_SOURCE_WRITE'); };
  const runtime = vm.createContext({
    PropertiesService: new Proxy({}, { get: () => forbidden }),
    SpreadsheetApp: new Proxy({}, { get: () => forbidden }),
    Date, Utilities: { formatDate: date => date.toISOString().slice(0, 19).replace('T', ' ') },
    Session: { getScriptTimeZone: () => 'UTC' },
  });
  vm.runInContext(fs.readFileSync(path.join(referenceDir, version), 'utf8'), runtime);
  return runtime;
}

function base(extra = {}) {
  return { name: 'Synthetic regression fixture', schemaVersion: '9.1',
    purchaseState: {}, stageData: {}, history: [], ...extra };
}

function result(runtime, input) {
  const copy = () => JSON.parse(JSON.stringify(input));
  return JSON.parse(JSON.stringify({ summary: runtime.getPaymentSummaryForRecord(copy()),
    refund: runtime.getRefundEligible91(copy()), profit: runtime.calculateProjectedProfit(copy()) }));
}

test('TXT matches V9.1 after LF/CRLF normalization; original bytes remain intact', () => {
  const normalized = file => fs.readFileSync(path.join(referenceDir, file), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(hashText(normalized(versions[0])), hashText(normalized('Pasted text(20261014-015629).txt')));
});

function hashText(text) {
  return require('node:crypto').createHash('sha256').update(text).digest('hex');
}

for (const version of versions) {
  const runtime = context(version);
  test(`${version}: parser dynamic N, aliases, invalid/empty/Done`, () => {
    assert.equal(runtime.parseAffiliateStage('  NHẬN  sample  37 ').key, 'sample:37');
    assert.equal(runtime.parseAffiliateStage('done').done, true);
    assert.equal(runtime.parseAffiliateStage(''), null);
    for (const invalid of ['Đặt mẫu 0', 'Đặt End -1', 'Đặt End 01', 'unexpected']) {
      assert.throws(() => runtime.parseAffiliateStage(invalid));
    }
  });
  test(`${version}: legacy Number conversion quirks are captured, not repaired`, () => {
    for (const value of ['', null, undefined, true, false, -1, '1,000', 'abc']) {
      assert.equal(runtime.amount91(value), null);
    }
    assert.equal(runtime.amount91('   '), 0);
    assert.equal(runtime.amount91('1e3'), 1000);
    assert.equal(runtime.amount91(0), 0);
  });
  test(`${version}: independent paid/unpaid, cancelled, missing, review, refund, profit`, () => {
    const input = base({ wholesale: 10, qty: 2, priceMau1: 100, priceMau3: 30,
      priceEnd1: 40, sellEnd1: 60, qtySellEnd1: 2, priceEnd2: 50, priceMau2: null,
      purchaseState: {
        'sample:1': { ordered: true, received: true, verified: true },
        'sample:2': { ordered: true, received: false, verified: false },
        'sample:3': { ordered: true, received: false, verified: true },
        'end:1': { ordered: true, received: true, verified: true },
        'end:2': { ordered: true, received: true, cancelled: true, verified: false },
      } });
    const before = JSON.stringify(input);
    const { summary, refund, profit } = result(runtime, input);
    assert.equal(summary.paid, 140);
    assert.equal(summary.unpaid, 30);
    assert.equal(summary.incurred, 170);
    assert.equal(summary.missing, 1);
    assert.equal(summary.review, 1);
    assert.deepEqual(refund, { total: 100, missing: 0 });
    assert.equal(profit, 100);
    assert.equal(JSON.stringify(input), before);
  });
  test(`${version}: unmatched End and nonreceived End eligibility`, () => {
    const received = base({ priceEnd9: 20, purchaseState: {
      'end:9': { ordered: true, received: true, verified: true } } });
    assert.deepEqual(result(runtime, received).refund, { total: 0, missing: 1 });
    received.purchaseState['end:9'].received = false;
    assert.deepEqual(result(runtime, received).refund, { total: 0, missing: 0 });
    assert.equal(result(runtime, received).summary.unpaid, 20);
  });
  test(`${version}: missing price differs from zero and negative projected profit`, () => {
    const input = base({ priceEnd1: null, purchaseState: {
      'end:1': { ordered: true, received: false, verified: true } } });
    assert.equal(result(runtime, input).summary.missing, 1);
    input.priceEnd1 = 0;
    assert.equal(result(runtime, input).summary.missing, 0);
    input.priceEnd1 = 123;
    assert.equal(result(runtime, input).profit, -123);
  });
  test(`${version}: legacy normalization retains history but changes computed clone`, () => {
    const input = { name: 'legacy', currentProgress: 'Đặt End 1', priceEnd1: 50,
      stageData: { 'Nhận End 1': { endPrice: 99 } }, history: [] };
    runtime.ensureRecord(input);
    assert.equal(input.schemaVersion, '9.1');
    assert.equal(input.purchaseState['end:1'].received, false);
    assert.equal(input.purchaseState['end:1'].verified, false);
    assert.match(input.purchaseState['end:1'].issue, /Đặt hiện tại khác lịch sử Nhận/);
    assert.equal(input.priceEnd1, 50);
    assert.equal(input.history.length, 0);
  });
  test(`${version}: blank buy edit has different behavior for pre-9.1 and 9.1`, () => {
    const input = { stageData: { 'Đặt mẫu 1': { price: 50 } },
      history: [{ type: 'PRICE_EDIT', progress: 'Đặt mẫu 1', data: { price: '' } }] };
    runtime.ensureRecord(input);
    assert.equal(input.purchaseState['sample:1'].ordered, false);
    const current = base({ priceMau1: null, purchaseState: {
      'sample:1': { ordered: true, received: false, verified: true } } });
    assert.equal(result(runtime, current).summary.missing, 1);
  });
  test(`${version}: sync resets received on an ORDER row, price slots remain independent`, () => {
    const input = base({ priceEnd1: 50, priceEnd2: 80, purchaseState: {
      'end:1': { ordered: true, received: true, verified: true } } });
    assert.equal(runtime.syncCurrentOrder91(input, { progress: 'Đặt End 1', endPrice: 50 }), true);
    assert.equal(input.purchaseState['end:1'].received, false);
    assert.equal(input.priceEnd2, 80);
    assert.equal(runtime.syncCurrentOrder91(input, { progress: 'Nhận End 1', endPrice: 999 }), false);
    assert.equal(input.priceEnd1, 50);
  });
  test(`${version}: 24h/15d/30d exact boundaries and final-status scope`, () => {
    const fixed = new Date('2026-10-14T00:00:00Z');
    class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [fixed])); } }
    runtime.Date = FixedDate;
    const ago = ms => new FixedDate(fixed.getTime() - ms);
    const day = 86400000;
    const status = (stage, date, current = '', note = '') => runtime.calculateStatus(stage, 1, date, current, note).status;
    assert.equal(status('Nhận mẫu 1', ago(day - 1)), 'Chờ đủ 1 ngày');
    assert.equal(status('Nhận mẫu 1', ago(day)), 'Có thể đặt lượt tiếp theo');
    assert.equal(status('Nhận End 1', ago(15 * day - 1)), 'Chờ check hoàn');
    assert.equal(status('Nhận End 1', ago(15 * day)), '⚠️ Cần check hoàn tiền');
    assert.equal(status('Nhận mẫu 3', ago(30 * day - 1), '', 'hết hàng'), 'Hết hàng • còn 1 ngày hoàn');
    assert.equal(status('Nhận mẫu 3', ago(30 * day), '', 'hết hàng'), '⚠️ Cần check hoàn tiền');
    assert.equal(status('Nhận End 1', ago(16 * day), 'Đã hoàn'), 'Đã hoàn');
    assert.equal(status('Nhận mẫu 1', ago(day), 'Đã hoàn'), 'Có thể đặt lượt tiếp theo');
    assert.equal(status('Done', ago(day), 'Chưa hoàn'), 'Hoàn tất');
    runtime.Date = Date;
  });
}

test('pure finance function outputs V9.1/V9.2 match on explicit synthetic regression inputs', () => {
  const a = context(versions[0]);
  const b = context(versions[1]);
  for (const price of [null, '', 0, 100, 0.1, -1]) {
    for (const received of [false, true]) {
      const input = base({ priceMau4: price, priceEnd4: 5, sellEnd4: 2, qtySellEnd4: 3,
        purchaseState: { 'sample:4': { ordered: true, received, verified: false },
          'end:4': { ordered: true, received, verified: true } } });
      assert.deepEqual(result(a, input), result(b, input));
    }
  }
});
// truonglt phase0 source oracle tests end
