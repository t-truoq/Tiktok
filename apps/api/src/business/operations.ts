// truonglt Phase3 source traced domain operations start
import { amount, calculateFinance, calculateStatus, configs, normalizeRecord, parseStage, RecordData } from '../finance/engine';
import { fail, keys, MutationDto } from './contracts';
import { formatSourceTimestamp, sourceDateToInstant, SourceDateError } from '../finance/source-time';
export function applyOperation(source: RecordData, dto: MutationDto, now: Date, view?: { profit: unknown }):
  { record: RecordData; finance: ReturnType<typeof calculateFinance>; events: { type: string; stage: string; data: RecordData; before?: RecordData; after?: RecordData }[]; view: { profit: unknown } } {
  // truonglt automatic N and per-round controls preserve the original call chain start
  if (dto.operation === 'ROUND_ACTION') {
    keys(dto.values, ['action', 'group', 'roundIndex', 'value', 'unitPrice', 'quantity']);
    const v = dto.values, action = String(v.action), group = v.group === 'SAMPLE' ? 'sample' : v.group === 'END' ? 'end' : null;
    if (!group || !['ORDER_NEXT', 'RECEIVE', 'EDIT_BUY', 'EDIT_SALES', 'VERIFY_STAGE', 'CORRECT_UNRECEIVED', 'CANCEL_STAGE', 'RESTORE_STAGE'].includes(action)) fail('INVALID_ROUND_ACTION');
    const r = normalizeRecord(source), known = configs(r).filter(c => c.group === group);
    const index = action === 'ORDER_NEXT' ? Math.max(0, ...known.map(c => c.index)) + 1 : Number(v.roundIndex);
    if (!Number.isSafeInteger(index) || index < 1) fail('INVALID_ROUND_INDEX');
    if (action !== 'ORDER_NEXT' && (!/^[1-9]\d*$/.test(String(v.roundIndex)) || !known.some(c => c.index === index))) fail('ROUND_NOT_FOUND', 404);
    if (action === 'ORDER_NEXT' && v.roundIndex !== undefined) fail('AUTO_ROUND_INDEX_REQUIRED');
    if (['ORDER_NEXT', 'EDIT_BUY'].includes(action)) keys(v, action === 'ORDER_NEXT' ? ['action','group','value'] : ['action','group','roundIndex','value']);
    else if (action === 'EDIT_SALES') keys(v, ['action','group','roundIndex','unitPrice','quantity']);
    else keys(v, ['action','group','roundIndex']);
    const state = r.purchaseState[`${group}:${index}`];
    if (action === 'RECEIVE' && (!state?.ordered || state.received || state.cancelled)) fail('ROUND_NOT_PENDING');
    if (action === 'EDIT_BUY' && state?.received) fail('BUY_REQUIRES_ORDER_STAGE');
    if (action === 'EDIT_SALES' && group !== 'end') fail('SALES_REQUIRES_END_STAGE');
    if (state?.cancelled && action !== 'RESTORE_STAGE') fail('ROUND_CANCELLED');
    const received = action === 'RECEIVE' || (action !== 'ORDER_NEXT' && state?.received === true);
    const progress = `${received ? 'Nhận' : 'Đặt'} ${group === 'sample' ? 'mẫu' : 'End'} ${index}`;
    let result = { record: source, finance: calculateFinance(source), events: [] as any[], view: view || { profit: source.profit ?? '' } };
    const steps: MutationDto[] = [];
    if (r.currentProgress !== progress || action === 'ORDER_NEXT' || action === 'RECEIVE') steps.push({ ...dto, operation:'SET_STAGE', values:{ progress } });
    if (action === 'ORDER_NEXT' && Object.hasOwn(v,'value')) steps.push({ ...dto, operation:'EDIT_BUY', values:{value:v.value} });
    if (!['ORDER_NEXT','RECEIVE'].includes(action)) steps.push({ ...dto, operation:action as MutationDto['operation'],
      values:action === 'EDIT_BUY' ? {value:v.value} : action === 'EDIT_SALES' ? Object.fromEntries(['unitPrice','quantity'].filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]])) : {} });
    let currentView = view;
    for (const step of steps) {
      const before = result.record, next = applyOperation(before, step, now, currentView);
      currentView = next.view;
      result = { ...next, events:[...result.events, ...next.events.map(e=>({...e,before:e.before||structuredClone(before),after:e.after||structuredClone(next.record)}))] };
    }
    return result;
  }
  // truonglt automatic N and per-round controls preserve the original call chain end
  // Grouped API edits compose original single-column handlers in source column
  // order. Canonical payload hashing therefore cannot hide order-dependent results.
  if (['EDIT_FIELDS', 'EDIT_SALES'].includes(dto.operation) && Object.keys(dto.values).length > 1) {
    const order = dto.operation === 'EDIT_FIELDS' ? ['refundQty', 'pic', 'date', 'status', 'wholesale', 'qty', 'note'] : ['unitPrice', 'quantity'];
    keys(dto.values, order); let current = source, currentView = view;
    const grouped: { type: string; stage: string; data: RecordData; before?: RecordData; after?: RecordData }[] = [];
    for (const field of order) if (Object.hasOwn(dto.values, field)) {
      const result = applyOperation(current, { ...dto, values: { [field]: dto.values[field] } }, now, currentView);
      grouped.push(...result.events.map(event => ({ ...event, before: structuredClone(current), after: structuredClone(result.record) })));
      current = result.record; currentView = result.view;
    }
    return { record: current, finance: calculateFinance(current), events: grouped, view: currentView! };
  }
  const r = normalizeRecord(source), events: { type: string; stage: string; data: RecordData; before?: RecordData; after?: RecordData }[] = [];
  const initialFinance = calculateFinance(source);
  const hasMoney = (record: RecordData, finance: ReturnType<typeof calculateFinance>) => amount(record.wholesale) !== null || amount(record.qty) !== null ||
    finance.payment.details.some(x => x.ordered && x.amount !== null) || amount(finance.endQuantity)!.gt(0);
  const priorVisibleProfit = view ? view.profit : hasMoney(source, initialFinance) ? initialFinance.projectedProfit : '';
  const values = dto.values; let s = parseStage(r.currentProgress);
  const add = (type: string, stage = r.currentProgress || '', data = values) => events.push({ type, stage, data });
  if (dto.operation === 'SET_STAGE') {
    keys(values, ['progress']); if (typeof values.progress !== 'string') fail('INVALID_STAGE');
    let next; try { next = parseStage(values.progress); } catch { fail('INVALID_STAGE'); }
    const label = next?.label || '', old = r.currentProgress || '';
    if (old && old !== label) add('LEAVE_STAGE', old, { progress: old });
    if (next && !next.done) {
      const st = r.purchaseState[next.key] || { ordered: false, received: false, cancelled: false, verified: true, issue: '' };
      if (next.received) { if (!st.ordered) { st.ordered = true; st.verified = false; st.issue = 'Nhận khi chưa ghi nhận Đặt'; } st.received = true; }
      else { st.ordered = true; st.cancelled = false; }
      r.purchaseState[next.key] = st;
      r.currentDate = r.stageData[label]?.date || formatSourceTimestamp(now);
      r.pic = r[`${next.group === 'end' ? 'picEnd' : 'picMau'}${next.index}`] || r.stageData[label]?.pic || '';
    }
    r.currentProgress = label; if (!label) r.currentDate = '';
    s = next; if (label) add('ENTER_STAGE', label);
  } else if (dto.operation === 'EDIT_BUY') {
    keys(values, ['value']); if (!Object.hasOwn(values, 'value')) fail('MISSING_VALUE');
    if (!s || s.done || s.received) fail('BUY_REQUIRES_ORDER_STAGE');
    // Apps Script accepts blank clear, rejects null/negative/non-numeric user edits.
    if (values.value !== '' && amount(values.value) === null) fail('INVALID_MONEY');
    const key = `${s.group === 'sample' ? 'priceMau' : 'priceEnd'}${s.index}`;
    r[key] = amount(values.value)?.toString() ?? null;
    const state = r.purchaseState[s.key] || { ordered: true, received: false, cancelled: false, verified: true, issue: '' };
    state.ordered = true; state.cancelled = false; r.purchaseState[s.key] = state;
    r.stageData[s.label] = { ...(r.stageData[s.label] || {}), [s.group === 'sample' ? 'price' : 'endPrice']: r[key] };
    add(s.group === 'sample' ? 'PRICE_EDIT' : 'END_BUY_PRICE_EDIT');
  } else if (dto.operation === 'EDIT_SALES') {
    keys(values, ['unitPrice', 'quantity']); if (!Object.keys(values).length) fail('MISSING_VALUE');
    if (!s || s.done || s.group !== 'end') fail('SALES_REQUIRES_END_STAGE');
    for (const [field, key, type] of [['unitPrice', `sellEnd${s.index}`, 'END_SELL_PRICE_EDIT'], ['quantity', `qtySellEnd${s.index}`, 'END_SELL_QTY_EDIT']]) {
      if (Object.hasOwn(values, field)) { r[key] = amount(values[field])?.toString() ?? null; add(type); }
    }
  } else if (dto.operation === 'EDIT_FIELDS') {
    keys(values, ['wholesale', 'qty', 'refundQty', 'note', 'status', 'date', 'pic']); if (!Object.keys(values).length) fail('MISSING_VALUE');
    for (const [field, value] of Object.entries(values)) {
      if (['note', 'status', 'pic', 'date'].includes(field) && (typeof value !== 'string' || value.length > 4000)) fail('INVALID_TEXT');
      // truonglt local date input uses the single owner-confirmed IANA parser start
      const localDateInput = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value + ':00' : value;
      const date = field === 'date' ? sourceDateToInstant(localDateInput) : null;
      r[field === 'date' ? 'currentDate' : field] = field === 'date' ? (date ? formatSourceTimestamp(date) : '') : ['wholesale', 'qty'].includes(field) ? amount(value)?.toString() ?? null : ['note', 'status', 'pic'].includes(field) ? String(value).trim() : value;
      // truonglt local date input uses the single owner-confirmed IANA parser end
      if (field === 'pic' && s && !s.done) r[`${s.group === 'end' ? 'picEnd' : 'picMau'}${s.index}`] = String(value).trim();
      add(({ refundQty: 'REFUND_QTY_EDIT', note: 'NOTE_EDIT', status: 'STATUS_EDIT', date: 'DATE_EDIT', pic: 'PIC_EDIT' } as RecordData)[field] || 'FIELD_EDIT');
    }
  } else {
    keys(values, []); if (!s || s.done) fail('ROUND_STAGE_REQUIRED');
    const state = r.purchaseState[s.key]; if (!state) fail('ROUND_NOT_FOUND', 404);
    if (dto.operation === 'VERIFY_STAGE') { if (!state.ordered || amount(r[`${s.group === 'sample' ? 'priceMau' : 'priceEnd'}${s.index}`]) === null) fail('MISSING_ORDER_PRICE'); state.verified = true; state.issue = ''; }
    if (dto.operation === 'CORRECT_UNRECEIVED') { state.received = false; state.verified = true; state.issue = ''; }
    if (dto.operation === 'CANCEL_STAGE') state.cancelled = true;
    if (dto.operation === 'RESTORE_STAGE') state.cancelled = false;
    add(dto.operation);
  }
  // Source refresh runs on stage, date, note and refund quantity; manual status is preserved on other edits.
  if (dto.operation === 'SET_STAGE' || (dto.operation === 'EDIT_FIELDS' && ['note', 'date', 'refundQty'].some(k => Object.hasOwn(values, k)))) {
    let date: Date | null;
    try { date = sourceDateToInstant(r.currentDate); } catch (error) { fail(error instanceof SourceDateError ? error.code : 'INVALID_SOURCE_DATE'); }
    const oldStatus = r.status || '';
    r.status = calculateStatus(r.currentProgress, date, oldStatus, r.note, now);
    // refreshStatusForRow saves AUTO_STATUS before finalizeUserEdit for these
    // onEdit branches; stage transitions explicitly pass saveHistory=false.
    if (dto.operation === 'EDIT_FIELDS' && r.status !== oldStatus) events.unshift({ type: 'AUTO_STATUS', stage: r.currentProgress || '', data: values });
  }
  // onEdit/updateHeaderTotals call syncCurrentOrder91 after these actions. This is
  // distinct from handleProgressChange itself, which preserves the received flag.
  const refreshHeader = dto.operation !== 'EDIT_FIELDS' || ['wholesale', 'qty'].some(k => Object.hasOwn(values, k));
  if (refreshHeader && s && !s.done && !s.received) {
    const cost = amount(r[`${s.group === 'sample' ? 'priceMau' : 'priceEnd'}${s.index}`]);
    if (cost !== null) {
      const state = r.purchaseState[s.key];
      if (!state || !state.ordered || state.cancelled || state.received) {
        const next = { ...(state || {}), ordered: true, received: false, cancelled: false };
        if (!state || !state.verified) { next.verified = false; next.issue = next.issue || 'Đồng bộ lượt Đặt từ Sheet; cần đối soát'; }
        r.purchaseState[s.key] = next;
      }
    }
  }
  const finance = calculateFinance(r);
  const stageAction = ['VERIFY_STAGE', 'CORRECT_UNRECEIVED', 'CANCEL_STAGE', 'RESTORE_STAGE'].includes(dto.operation);
  const updatesRowProfit = dto.operation === 'SET_STAGE' || dto.operation === 'EDIT_SALES' ||
    dto.operation === 'EDIT_BUY' && s && !s.done && s.group === 'end' ||
    dto.operation === 'EDIT_FIELDS' && ['refundQty', 'wholesale', 'qty'].some(k => Object.hasOwn(values, k));
  let visibleProfit = priorVisibleProfit;
  if (!stageAction) r.profit = finance.projectedProfit; // saveCurrentRow
  if (updatesRowProfit) { r.profit = hasMoney(r, finance) ? finance.projectedProfit : null; visibleProfit = r.profit ?? ''; }
  if (s && !['VERIFY_STAGE', 'CORRECT_UNRECEIVED', 'CANCEL_STAGE', 'RESTORE_STAGE'].includes(dto.operation)) {
    const oldStage = parseStage(source.currentProgress);
    const visible = s.done ? oldStage : s;
    const sheetNumber = (value: unknown) => amount(value)?.toString() ?? '';
    const sample = visible && !visible.done && visible.group === 'sample';
    const end = visible && !visible.done && visible.group === 'end';
    const index = visible && !visible.done ? visible.index : null;
    // Done leaves sheet monetary columns visible; non-Done initializes/clears
    // unrelated columns. Snapshot blanks differ from nullable accounting slots.
    const previous = source.stageData?.[source.currentProgress] || {};
    r.stageData[s.label] = { progress: s.label, pic: r.pic || '', date: r.currentDate || '',
      price: sample ? sheetNumber(r[`priceMau${index}`]) : s.done ? previous.price ?? '' : '',
      endPrice: end ? sheetNumber(r[`priceEnd${index}`]) : s.done ? previous.endPrice ?? '' : '',
      sellEnd: end ? sheetNumber(r[`sellEnd${index}`]) : s.done ? previous.sellEnd ?? '' : '',
      sellEndQty: end ? sheetNumber(r[`qtySellEnd${index}`]) : s.done ? previous.sellEndQty ?? '' : '',
      refundQty: r.refundQty ?? '', status: r.status ?? '', wholesale: sheetNumber(r.wholesale), qty: sheetNumber(r.qty),
      // Source captures the visible prior profit before updateProfitForRow. Keep
      // this historical observation distinct from newly calculated record.profit.
      profit: priorVisibleProfit, note: r.note || '', capturedAt: formatSourceTimestamp(now) };
    if (!s.done) r[`${s.group === 'end' ? 'picEnd' : 'picMau'}${s.index}`] = r.stageData[s.label].pic || '';
    events.forEach(event => { if (event.type !== 'LEAVE_STAGE') event.data = r.stageData[s!.label]; });
  }
  return { record: r, finance, events, view: { profit: visibleProfit } };
}
// truonglt Phase3 source traced domain operations end
