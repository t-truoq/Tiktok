// truonglt Phase3 V9.1 finance engine start
import Decimal from 'decimal.js';
export type RecordData = { [key: string]: any };
const Money = Decimal.clone({ precision: 50 });
export function amount(value: unknown): Decimal | null {
  // Number is used only to reproduce the source acceptance predicate, never arithmetic.
  if (value === '' || value == null || typeof value === 'boolean' || !Number.isFinite(Number(value)) || Number(value) < 0) return null;
  const text = String(value).trim();
  return new Money(text === '' ? '0' : text);
}
export function parseStage(value: unknown) {
  const label = String(value || '').trim().replace(/\s+/g, ' ');
  if (!label) return null;
  if (/^done$/i.test(label)) return { done: true, label: 'Done' } as const;
  const match = /^(đặt|nhận)\s+(mẫu|sample|end)\s+([1-9]\d*)$/i.exec(label);
  if (!match || !Number.isSafeInteger(Number(match[3]))) throw new Error('INVALID_STAGE');
  const group = match[2].toLowerCase() === 'end' ? 'end' : 'sample';
  const index = Number(match[3]), received = match[1].toLowerCase() === 'nhận';
  return { done: false, group, index, received, key: `${group}:${index}`,
    label: `${received ? 'Nhận' : 'Đặt'} ${group === 'end' ? 'End' : 'mẫu'} ${index}` } as const;
}
function normalizedStage(value: unknown) { try { return parseStage(value)?.label || ''; } catch { return null; } }
export function configs(record: RecordData) {
  const keys = new Set<string>(Object.keys(record.purchaseState || {}));
  [...Object.keys(record.stageData || {}), ...(record.history || []).map((h: RecordData) => h.progress), record.currentProgress || '']
    .forEach(p => { try { const s = parseStage(p); if (s && !s.done) keys.add(s.key); } catch {} });
  Object.keys(record).forEach(k => { const m = /^price(Mau|End)([1-9]\d*)$/.exec(k);
    if (m && amount(record[k]) !== null) keys.add(`${m[1] === 'Mau' ? 'sample' : 'end'}:${Number(m[2])}`); });
  return [...keys].map(key => {
    const [group, n] = key.split(':'), index = Number(n);
    if (!['sample', 'end'].includes(group) || !Number.isSafeInteger(index) || index < 1) return null;
    return { key, group, index, label: `${group === 'sample' ? 'Mẫu' : 'End'} ${index}`,
      priceKey: `${group === 'sample' ? 'priceMau' : 'priceEnd'}${index}`, valueField: group === 'sample' ? 'price' : 'endPrice',
      ordered: `Đặt ${group === 'sample' ? 'mẫu' : 'End'} ${index}`, received: `Nhận ${group === 'sample' ? 'mẫu' : 'End'} ${index}` };
  }).filter((x): x is NonNullable<typeof x> => x !== null).sort((a, b) => a.group === b.group ? a.index - b.index : a.group === 'sample' ? -1 : 1);
}
/** Calculation copy only: never modifies the authoritative record. */
export function normalizeRecord(source: RecordData): RecordData {
  const record = structuredClone(source);
  record.stageData = record.stageData || {}; record.history = Array.isArray(record.history) ? record.history : [];
  record.purchaseState = record.purchaseState || {};
  if (record.schemaVersion === '9.1') return record;
  Object.entries(record.progressDates || {}).forEach(([p, date]) => { if (!record.stageData[p]) record.stageData[p] = { progress: p, date }; });
  let current: ReturnType<typeof parseStage> = null;
  try { current = parseStage(record.currentProgress); } catch {}
  for (const cfg of configs(record)) {
    const find = (label: string) => { const key = Object.keys(record.stageData).find(k => normalizedStage(k) === label); return key ? record.stageData[key] : null; };
    const order = find(cfg.ordered), receive = find(cfg.received);
    const hOrder = record.history.filter((h: RecordData) => normalizedStage(h.progress) === cfg.ordered && ['ENTER_STAGE', 'LEAVE_STAGE', 'PRICE_EDIT', 'END_BUY_PRICE_EDIT'].includes(h.type));
    const hReceive = record.history.some((h: RecordData) => normalizedStage(h.progress) === cfg.received && h.type === 'ENTER_STAGE');
    const active = !!current && !current.done && current.key === cfg.key;
    const latest = [...record.history].reverse().find(h => h && h.type === (cfg.group === 'end' ? 'END_BUY_PRICE_EDIT' : 'PRICE_EDIT') && normalizedStage(h.progress) === cfg.ordered);
    const lastValue = latest ? (latest.data || {})[cfg.valueField] : undefined;
    const received = !!receive || hReceive || (active && current && !current.done && current.received);
    const cleared = !!latest && (lastValue === '' || lastValue == null) && !received && !(active && current && !current.done && !current.received && amount(record[cfg.priceKey]) !== null);
    const ordered = (!!order || !!receive || hOrder.length > 0 || hReceive || active) && !cleared;
    let price: unknown = null;
    if (ordered) {
      if (latest) price = lastValue;
      else if (order && Object.hasOwn(order, cfg.valueField)) price = order[cfg.valueField];
      else if (receive && cfg.group === 'sample') price = receive[cfg.valueField];
      else if (active || cfg.group === 'sample') price = record[cfg.priceKey];
    }
    const cost = amount(price);
    // Preserve accepted raw representation; decimal calculations consume this projection.
    if (ordered) record[cfg.priceKey] = cost === null ? null : cost.toString();
    const conflict = active && current && !current.done && !current.received && received;
    record.purchaseState[cfg.key] = { ordered, received: !!(ordered && received && !conflict), cancelled: false, verified: false,
      issue: cleared ? 'Đã xóa giá tại bước Đặt: không tính công nợ' : ordered ? 'CẦN ĐỐI SOÁT V9' + (conflict ? ' | Đặt hiện tại khác lịch sử Nhận' : '') + (cost === null ? ' | THIẾU GIÁ ĐẶT' : '') : '' };
  }
  record.schemaVersion = '9.1'; return record;
}
export function calculateFinance(source: RecordData) {
  const r = normalizeRecord(source), details = configs(r).map(c => {
    const state = r.purchaseState[c.key] || {}, ordered = !!state.ordered && !state.cancelled, received = ordered && !!state.received;
    const cost = ordered ? amount(r[c.priceKey]) : new Money(0);
    return { key: c.key, group: c.group, index: c.index, label: c.label, ordered, received, amount: cost?.toString() ?? null,
      verified: state.verified === true, issue: state.issue || '', bucket: !ordered ? 'NOT_INCURRED' : cost === null ? 'MISSING_ORDER_PRICE' : received ? 'PAID' : 'UNPAID',
      status: !ordered ? 'CHƯA PHÁT SINH / ĐÃ HỦY' : cost === null ? 'THIẾU GIÁ ĐẶT' : received ? 'ĐÃ THANH TOÁN' : 'CHƯA THANH TOÁN' };
  });
  const totals = { paid: new Money(0), unpaid: new Money(0), incurred: new Money(0), sampleTotal: new Money(0), endTotal: new Money(0) };
  let missing = 0, review = 0, refundMissing = 0;
  let eligible = new Money(0), endRevenue = new Money(0), endQuantity = new Money(0);
  details.forEach(x => {
    if (x.ordered) { if (!x.verified) review++; if (x.amount === null) missing++; else {
      totals.incurred = totals.incurred.plus(x.amount); const group = x.group === 'sample' ? 'sampleTotal' : 'endTotal';
      totals[group] = totals[group].plus(x.amount); const bucket = x.received ? 'paid' : 'unpaid'; totals[bucket] = totals[bucket].plus(x.amount);
    } }
    if (x.group === 'end' && x.received) { const sample = details.find(s => s.group === 'sample' && s.index === x.index && s.ordered);
      if (sample && sample.amount !== null) eligible = eligible.plus(sample.amount); else refundMissing++; }
    if (x.group === 'end' && x.ordered) { const qty = amount(r[`qtySellEnd${x.index}`]) || new Money(0);
      endQuantity = endQuantity.plus(qty); endRevenue = endRevenue.plus((amount(r[`sellEnd${x.index}`]) || new Money(0)).times(qty)); }
  });
  // V9.1 qty uses signed Number coercion, unlike nonnegative monetary inputs.
  const qtyRaw = r.qty;
  const qtyText = typeof qtyRaw === 'boolean' ? (qtyRaw ? '1' : '0') : String(qtyRaw ?? '').trim() || '0';
  if (!Number.isNaN(Number(qtyRaw)) && !Number.isFinite(Number(qtyRaw))) throw new Error('NONFINITE_SOURCE_QUANTITY');
  const qty = Number.isFinite(Number(qtyRaw)) ? new Money(qtyText) : new Money(0);
  const projectedProfit = (amount(r.wholesale) || new Money(0)).times(qty).plus(endRevenue).minus(totals.endTotal);
  const paymentTotals = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v.toString()])) as Record<keyof typeof totals, string>;
  return { payment: { ...paymentTotals, missing, review, details },
    refund: { total: eligible.toString(), missing: refundMissing }, projectedProfit: projectedProfit.toString(), endRevenue: endRevenue.toString(), endQuantity: endQuantity.toString() };
}
export function calculateStatus(progress: unknown, date: Date | null, currentStatus: string, note: unknown, now: Date) {
  const s = parseStage(progress); if (!s) return currentStatus || ''; if (s.done) return 'Hoàn tất';
  const final = ['Đã hoàn', 'Chưa hoàn'].includes(currentStatus);
  const days = date ? (now.getTime() - date.getTime()) / 86400000 : NaN;
  if (s.group === 'sample' && s.received && /(^|[\s.,;:])hết hàng(?=$|[\s.,;:])/i.test(String(note || ''))) {
    if (final) return currentStatus; if (!date) return 'Hết hàng • chưa có ngày nhận';
    const remain = Math.ceil(30 - days); return remain <= 0 ? '⚠️ Cần check hoàn tiền' : `Hết hàng • còn ${remain} ngày hoàn`;
  }
  if (!s.received) return `Chờ nhận ${s.group === 'sample' ? 'mẫu' : 'End'} ${s.index}`;
  if (s.group === 'end') { if (final) return currentStatus; return date && days >= 15 ? '⚠️ Cần check hoàn tiền' : 'Chờ check hoàn'; }
  return date && days >= 1 ? 'Có thể đặt lượt tiếp theo' : 'Chờ đủ 1 ngày';
}
// truonglt Phase3 V9.1 finance engine end
