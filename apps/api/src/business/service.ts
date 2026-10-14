// truonglt Phase3 atomic business services start
import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { calculateFinance, calculateStatus, configs, normalizeRecord, parseStage, RecordData } from '../finance/engine';
import { Actor, fail, keys, MutationDto, pagination, uuid } from './contracts';
import { applyOperation } from './operations';
import { BusinessRepository } from './repository';
import { formatSourceTimestamp, sourceDateToInstant } from '../finance/source-time';
const clean = (value: any) => JSON.parse(JSON.stringify(value));
export function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function decimalSlot(value: unknown, scale: number) {
  const state = value === undefined ? 'MISSING' : value === null ? 'NULL' : value === '' ? 'BLANK' : typeof value === 'number' ? 'NUMBER' : typeof value === 'string' ? 'TEXT' : 'INVALID';
  if (state === 'INVALID') fail('INVALID_FINANCIAL_VALUE');
  if (['MISSING', 'NULL', 'BLANK'].includes(state)) return { decimal: null, state };
  let d: Decimal; try { d = new Decimal(String(value)); } catch { fail('INVALID_FINANCIAL_VALUE'); }
  if (!d.isFinite() || d.isNegative() || d.decimalPlaces() > scale || d.abs().gte(new Decimal(10).pow(18 - scale))) fail('DECIMAL_NOT_REPRESENTABLE');
  return { decimal: d.toString(), state };
}
export function hydrateProduct(product: any): RecordData {
  const fields = product.sourceFieldStates || {};
  if (fields.runtimeRecord) return structuredClone(fields.runtimeRecord);
  const legacy = product.legacyRecords?.[0];
  // truonglt Phase4 tolerate archived oracle envelope without losing its record start
  if (legacy) return normalizeRecord(legacy.calculationProjection?.normalizedCopy || legacy.calculationProjection || legacy.rawJson);
  // truonglt Phase4 tolerate archived oracle envelope without losing its record end
  const r: RecordData = { name: product.rootName, schemaVersion: '9.1', history: [], stageData: {}, purchaseState: {}, currentProgress: product.currentStageLabel || '',
    currentDate: product.currentDateText || '', status: product.currentStatus || '', note: product.note || '', pic: product.pic || '',
    wholesale: product.wholesale?.toString() ?? null, qty: product.sampleSalesQuantity?.toString() ?? null, refundQty: product.refundQuantity?.toString() ?? null };
  for (const round of product.rounds || []) {
    const group = round.group === 'SAMPLE' ? 'sample' : 'end', n = String(round.roundIndex), key = `${group}:${n}`;
    r.purchaseState[key] = { ordered: round.ordered, received: round.received, cancelled: round.cancelled, verified: round.verified, issue: round.issue || '' };
    const priceKey = `${group === 'sample' ? 'priceMau' : 'priceEnd'}${n}`;
    if (round.orderPriceState !== 'MISSING') r[priceKey] = round.orderPriceState === 'BLANK' ? '' : round.orderPrice?.toString() ?? null;
    if (round.sales) { r[`sellEnd${n}`] = round.sales.unitPrice?.toString() ?? null; r[`qtySellEnd${n}`] = round.sales.soldQuantity?.toString() ?? null; }
  }
  return r;
}
const include = { rounds: { include: { sales: true } }, legacyRecords: { orderBy: { createdAt: 'desc' }, take: 1 } };
// truonglt Phase5 list finance stays authoritative on backend start
function publicFinancialProduct(product: any, now = new Date()) {
  const { legacyRecords, ...visible } = product;
  const r = hydrateProduct(product);
  const finance = calculateFinance(r), stage = parseStage(r.currentProgress);
  let computedStatus = product.currentStatus || '', dateIssue: string | null = null;
  try { computedStatus = calculateStatus(r.currentProgress, sourceDateToInstant(r.currentDate), product.currentStatus || '', r.note, now); }
  catch (error) { dateIssue = error instanceof Error ? error.message : 'INVALID_SOURCE_DATE'; }
  const receivedLabel = stage && !stage.done ? `Nhận ${stage.group === 'end' ? 'End' : 'mẫu'} ${stage.index}` : null;
  const historyConflict = !!(stage && !stage.done && !stage.received && receivedLabel &&
    (r.stageData?.[receivedLabel] || (r.history || []).some((h: any) => h.progress === receivedLabel && h.type === 'ENTER_STAGE')));
  return { ...visible, finance, computedStatus, attention: { missingPrices: finance.payment.missing, unverified: finance.payment.review,
    refundDue: /Cần check hoàn tiền/i.test(computedStatus), historyConflict, dateIssue }, sourceView: { sampleBuy: r.price, endBuy: r.endPrice,
    wholesale: r.wholesale, qty: r.qty, refundQty: r.refundQty,
    endSell: stage && !stage.done && stage.group === 'end' ? r[`sellEnd${stage.index}`] : r.sellEnd,
    endSellQty: stage && !stage.done && stage.group === 'end' ? r[`qtySellEnd${stage.index}`] : r.sellEndQty, imageReference: r.image } };
}
// truonglt Phase5 list finance stays authoritative on backend end
@Injectable()
export class BusinessService {
  constructor(private readonly repository: BusinessRepository) {}
  list(query: Record<string, unknown>, actor: Actor) {
    const { page, ...args } = pagination(query);
    return this.repository.read(async tx => ({ page, limit: args.take, total: await tx.product.count({ where: args.where }),
      // truonglt Phase5 grid receives per-record ledger/profit without browser calculation start
      items: (await tx.product.findMany({ ...args, include })).map((p: any) => publicFinancialProduct(p)) }), actor);
      // truonglt Phase5 grid receives per-record ledger/profit without browser calculation end
  }
  detail(id: string, actor: Actor) { return this.repository.read(async tx => {
    const product = await tx.product.findUnique({ where: { id }, include }); if (!product) fail('PRODUCT_NOT_FOUND', 404);
    // truonglt Phase5 consistent list/detail finance contract start
    return publicFinancialProduct(product);
    // truonglt Phase5 consistent list/detail finance contract end
  }, actor); }
  summary(query: Record<string, unknown>, actor: Actor) {
    const { where } = pagination(query);
    return this.repository.read(async tx => {
      const totals: Record<string, Decimal> = Object.fromEntries(['paid', 'unpaid', 'incurred', 'sampleTotal', 'endTotal', 'refundEligible', 'projectedProfit'].map(k => [k, new Decimal(0)]));
      let count = 0, missing = 0, review = 0, cursor: string | undefined;
      while (true) {
        const items = await tx.product.findMany({ where, include, take: 100, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        if (!items.length) break;
        for (const product of items) { const f = calculateFinance(hydrateProduct(product)); count++;
          for (const key of ['paid', 'unpaid', 'incurred', 'sampleTotal', 'endTotal'] as const) totals[key] = totals[key].plus(f.payment[key]);
          totals.refundEligible = totals.refundEligible.plus(f.refund.total); totals.projectedProfit = totals.projectedProfit.plus(f.projectedProfit);
          missing += f.payment.missing; review += f.payment.review;
        }
        cursor = items.at(-1).id;
      }
      return { count, missing, review, ...Object.fromEntries(Object.entries(totals).map(([k,v]) => [k,v.toString()])) };
    }, actor);
  }
  // truonglt Phase5 server-side review filters and paginated global history start
  review(query: Record<string, unknown>, actor: Actor) {
    keys(query, ['page', 'limit', 'classification', 'kind']);
    const kind = String(query.kind || 'all'); if (!['all', 'missing', 'unverified', 'refund', 'conflict'].includes(kind)) fail('INVALID_FILTER');
    const { page, skip, take, where } = pagination({ page: query.page, limit: query.limit, classification: query.classification });
    return this.repository.read(async tx => {
      const matches: any[] = []; let cursor: string | undefined; const now = new Date();
      while (true) {
        const products = await tx.product.findMany({ where, include, take: 100, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        if (!products.length) break;
        for (const p of products) {
          const item = publicFinancialProduct(p, now), a = item.attention;
          if (kind === 'missing' ? a.missingPrices > 0 : kind === 'unverified' ? a.unverified > 0 : kind === 'refund' ? a.refundDue : kind === 'conflict' ? a.historyConflict :
            a.missingPrices > 0 || a.unverified > 0 || a.refundDue || a.historyConflict || a.dateIssue) matches.push(item);
        }
        cursor = products.at(-1).id;
      }
      return { page, limit: take, total: matches.length, items: matches.slice(skip, skip + take) };
    }, actor);
  }
  globalHistory(query: Record<string, unknown>, actor: Actor) {
    keys(query, ['page', 'limit', 'classification', 'productId', 'eventType', 'stageLabel']);
    const { page, skip, take, where: productWhere } = pagination({ page: query.page, limit: query.limit, classification: query.classification });
    const where: any = { product: productWhere };
    if (query.productId) where.productId = uuid(String(query.productId));
    for (const field of ['eventType', 'stageLabel']) if (query[field] !== undefined) {
      if (typeof query[field] !== 'string' || query[field].length > 200) fail('INVALID_FILTER'); where[field] = query[field];
    }
    return this.repository.read(async tx => ({ page, limit: take, total: await tx.productHistory.count({ where }),
      items: await tx.productHistory.findMany({ where, skip, take, orderBy: [{ occurredAtUtc: { sort: 'desc', nulls: 'last' } }, { recordedAt: 'desc' }, { id: 'asc' }],
        include: { product: { select: { id: true, rootName: true } } } }) }), actor);
  }
  // truonglt Phase5 server-side review filters and paginated global history end
  resource(id: string, resource: string, query: Record<string, unknown>, actor: Actor) {
    // truonglt Phase4 frontend resource aliases and sales query start
    if (resource === 'stages') resource = 'snapshots';
    const map: Record<string, string> = { rounds: 'purchaseRound', sales: 'salesDetail', snapshots: 'stageSnapshot', history: 'productHistory', refunds: 'refund', images: 'productImage', legacy: 'legacyRecord' };
    // truonglt Phase4 frontend resource aliases and sales query end
    if (!map[resource]) fail('RESOURCE_NOT_FOUND', 404);
    const filters: Record<string, string[]> = { rounds: ['group', 'roundIndex', 'ordered', 'received', 'cancelled', 'verified'],
      sales: [], history: ['eventType', 'stageLabel'], snapshots: ['sourceLabel'], legacy: ['importBatchId'], refunds: [], images: [] };
    const sorts: Record<string, string[]> = { rounds: ['roundIndex', 'group'], history: ['recordedAt', 'legacyEventIndex'],
      sales: ['id'], snapshots: ['createdAt', 'sourceLabel'], legacy: ['createdAt'], refunds: ['createdAt'], images: ['createdAt'] };
    keys(query, ['page', 'limit', 'sort', 'direction', ...filters[resource]]);
    const { skip, take, page } = pagination({ page: query.page, limit: query.limit });
    const sort = String(query.sort ?? sorts[resource][0]), direction = String(query.direction ?? 'asc');
    if (!sorts[resource].includes(sort) || !['asc', 'desc'].includes(direction)) fail('INVALID_SORT');
    // truonglt Phase4 sales belongs to product through its purchase round start
    const where: any = resource === 'sales' ? { round: { productId: id } } : { productId: id };
    // truonglt Phase4 sales belongs to product through its purchase round end
    for (const field of filters[resource]) if (query[field] !== undefined) {
      const value = String(query[field]);
      if (['ordered', 'received', 'cancelled', 'verified'].includes(field)) { if (!['true','false'].includes(value)) fail('INVALID_FILTER'); where[field] = value === 'true'; }
      else if (field === 'group') { if (!['SAMPLE','END'].includes(value)) fail('INVALID_FILTER'); where[field] = value; }
      else if (field === 'roundIndex') { if (!/^[1-9]\d*$/.test(value) || BigInt(value) > 9007199254740991n) fail('INVALID_FILTER'); where[field] = BigInt(value); }
      else if (field === 'importBatchId') where[field] = uuid(value);
      else { if (typeof query[field] !== 'string' || value.length > 200) fail('INVALID_FILTER'); where[field] = value; }
    }
    return this.repository.read(async tx => {
      if (!await tx.product.findUnique({ where: { id }, select: { id: true } })) fail('PRODUCT_NOT_FOUND', 404);
      const model = tx[map[resource]];
      return { page, limit: take, total: await model.count({ where }), items: await model.findMany({ where, skip, take,
        orderBy: [{ [sort]: direction }, { id: 'asc' }],
        ...(resource === 'rounds' ? { include: { sales: true } } : resource === 'sales' ? { include: { round: { select: { group: true, roundIndex: true } } } } : {}) }) };
    }, actor);
  }
  metadata(resource: 'sourceArchive' | 'importBatch', query: Record<string, unknown>, actor: Actor) {
    const allowed = resource === 'sourceArchive' ? ['filename', 'sha256'] : ['status', 'sourceArchiveId'];
    keys(query, ['page', 'limit', 'direction', ...allowed]);
    const { skip, take, page } = pagination({ page: query.page, limit: query.limit });
    const direction = String(query.direction ?? 'asc'); if (!['asc','desc'].includes(direction)) fail('INVALID_SORT');
    const where: any = {};
    for (const field of allowed) if (query[field] !== undefined) {
      if (typeof query[field] !== 'string' || (query[field] as string).length > 200) fail('INVALID_FILTER');
      where[field] = field === 'sourceArchiveId' ? uuid(query[field] as string) : query[field];
    }
    return this.repository.read(async tx => ({ page, limit: take, total: await tx[resource].count({ where }), items: await tx[resource].findMany({ where, skip, take, orderBy: { id: direction },
      select: resource === 'sourceArchive' ? { id: true, filename: true, sha256: true, receivedAt: true, metadata: true } :
        { id: true, sourceArchiveId: true, mappingVersion: true, planSha256: true, status: true, importedCount: true, failedCount: true, reconciliation: true, createdAt: true,
          _count: { select: { records: true, history: true, snapshots: true } } } }) }), actor);
  }
  // truonglt Phase5 finance preview uses the same domain operation as commit start
  preview(id: string, dto: MutationDto, actor: Actor) {
    return this.repository.read(async tx => {
      const product = await tx.product.findUnique({ where: { id }, include }); if (!product) fail('PRODUCT_NOT_FOUND', 404);
      if (product.classification === 'LEGACY_UNMATCHED' || product.archived) fail('ARCHIVAL_RECORD_READ_ONLY', 403);
      if (product.version !== dto.expectedVersion) fail('VERSION_CONFLICT', 409);
      const before = hydrateProduct(product), result = applyOperation(before, dto, new Date(), product.sourceFieldStates?.businessView);
      return { expectedVersion: product.version, beforeFinance: calculateFinance(before), afterFinance: result.finance,
        stage: result.record.currentProgress, eventTypes: result.events.map(e => e.type), writesExecuted: false };
    }, actor);
  }
  // truonglt Phase5 finance preview uses the same domain operation as commit end
  async mutate(id: string, dto: MutationDto, actor: Actor, key: string) {
    if (!['ADMIN', 'EDITOR'].includes(actor.role)) fail('FORBIDDEN', 403);
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) fail('INVALID_IDEMPOTENCY_KEY');
    const hash = createHash('sha256').update(canonical({ id, ...dto })).digest('hex');
    const perform = async (tx: any) => {
      const existing = await tx.mutationRequest.findUnique({ where: { actorId_idempotencyKey: { actorId: actor.id, idempotencyKey: key } } });
      if (existing) { if (existing.payloadHash !== hash) fail('IDEMPOTENCY_CONFLICT', 409); if (!existing.outcome) fail('IDEMPOTENCY_IN_PROGRESS', 409); return existing.outcome; }
      // Recheck database role inside the same transaction as the write.
      const user = await tx.user.findUnique({ where: { id: actor.id } }); if (!user || !['ADMIN', 'EDITOR'].includes(user.role) || user.authSubject !== actor.subject) fail('FORBIDDEN', 403);
      const product = await tx.product.findUnique({ where: { id }, include }); if (!product) fail('PRODUCT_NOT_FOUND', 404);
      // truonglt Phase5 imported legacy and archived products remain read-only start
      if (product.classification === 'LEGACY_UNMATCHED' || product.archived) fail('ARCHIVAL_RECORD_READ_ONLY', 403);
      // truonglt Phase5 imported legacy and archived products remain read-only end
      if (product.version !== dto.expectedVersion) fail('VERSION_CONFLICT', 409);
      const before = hydrateProduct(product), now = new Date(), result = applyOperation(before, dto, now, product.sourceFieldStates?.businessView), r = result.record;
      const stage = parseStage(r.currentProgress), requestId = randomUUID();
      const fields: any = { currentStageLabel: r.currentProgress || null, currentStageGroup: stage && !stage.done ? (stage.group === 'sample' ? 'SAMPLE' : 'END') : null,
        currentStageIndex: stage && !stage.done ? BigInt(stage.index) : null, currentStatus: r.status || null, currentDateText: r.currentDate || null,
        note: r.note || '', pic: r.pic || '', wholesale: decimalSlot(r.wholesale, 2).decimal, sampleSalesQuantity: decimalSlot(r.qty, 3).decimal,
        refundQuantity: decimalSlot(r.refundQty, 3).decimal, sourceFieldStates: clean({ ...product.sourceFieldStates, runtimeRecord: r, businessView: result.view }), version: { increment: 1 } };
      const updated = await tx.product.updateMany({ where: { id, version: dto.expectedVersion }, data: fields }); if (updated.count !== 1) fail('VERSION_CONFLICT', 409);
      await tx.mutationRequest.create({ data: { id: requestId, actorId: actor.id, idempotencyKey: key, action: dto.operation, payloadHash: hash } });
      for (const cfg of configs(r)) {
        const state = r.purchaseState[cfg.key] || {}, price = decimalSlot(r[cfg.priceKey], 2), group = cfg.group === 'sample' ? 'SAMPLE' : 'END';
        const round = await tx.purchaseRound.upsert({ where: { productId_group_roundIndex: { productId: id, group, roundIndex: BigInt(cfg.index) } },
          create: { productId: id, group, roundIndex: BigInt(cfg.index), orderPrice: price.decimal,
            orderPriceState: price.decimal === null ? price.state : 'NUMBER', sourceFieldStates: {} },
          update: { version: { increment: 1 } } });
        await tx.purchaseRound.update({ where: { id: round.id }, data: { ordered: !!state.ordered, received: !!state.received, cancelled: !!state.cancelled,
          verified: state.verified === true, issue: state.issue || '', rawState: clean(state), orderPrice: price.decimal,
          orderPriceState: price.decimal === null ? price.state : 'NUMBER',
          sourceFieldStates: clean({ value: r[cfg.priceKey], state: price.state }) } });
        const dates: any = {};
        for (const [label, textKey, utcKey] of [[cfg.ordered, 'orderedAtText', 'orderedAtUtc'], [cfg.received, 'receivedAtText', 'receivedAtUtc']]) {
          const snapshot = r.stageData[label];
          if (snapshot && Object.hasOwn(snapshot, 'date')) { dates[textKey] = snapshot.date; dates[utcKey] = sourceDateToInstant(snapshot.date); }
        }
        if (Object.keys(dates).length) await tx.purchaseRound.update({ where: { id: round.id }, data: dates });
        if (group === 'END') { const unit = decimalSlot(r[`sellEnd${cfg.index}`], 2), qty = decimalSlot(r[`qtySellEnd${cfg.index}`], 3);
          const sales = { unitPrice: unit.decimal, unitPriceState: unit.decimal === null ? unit.state : 'NUMBER',
            soldQuantity: qty.decimal, quantityState: qty.decimal === null ? qty.state : 'NUMBER',
            rawFields: clean({ unitPrice: r[`sellEnd${cfg.index}`], quantity: r[`qtySellEnd${cfg.index}`],
              unitPriceRawState: unit.state, quantityRawState: qty.state }) };
          await tx.salesDetail.upsert({ where: { roundId: round.id }, create: { roundId: round.id, ...sales }, update: sales });
        }
      }
      if (stage && r.stageData[stage.label] && !['VERIFY_STAGE', 'CORRECT_UNRECEIVED', 'CANCEL_STAGE', 'RESTORE_STAGE'].includes(dto.operation))
        await tx.stageSnapshot.create({ data: { productId: id, sourceLabel: stage.label, snapshot: clean(r.stageData[stage.label]), sourceDateText: r.currentDate || null,
          effectiveAtUtc: sourceDateToInstant(r.currentDate) } });
      for (const event of result.events) await tx.productHistory.create({ data: { productId: id, eventType: event.type, stageLabel: event.stage || null,
        occurredAtUtc: now, sourceTimestampText: formatSourceTimestamp(now),
        originalPayload: clean({ source: 'BUSINESS_API_V91', operation: dto.operation, values: event.data, requestValues: dto.values }),
        beforeJson: clean(event.before || before), afterJson: clean(event.after || r),
        actorId: actor.id, requestId, reason: dto.reason || null } });
      const outcome = clean({ id, version: dto.expectedVersion + 1, requestId, finance: result.finance });
      await tx.mutationRequest.update({ where: { id: requestId }, data: { outcome } }); return outcome;
    };
    try { return await this.repository.transaction(actor, perform); }
    catch (error) {
      const code = (error as any)?.code;
      if (code === 'P2034') fail('VERSION_CONFLICT', 409);
      if (code === 'P2002') {
        const saved = await this.repository.read(async tx => tx.mutationRequest.findUnique({ where: { actorId_idempotencyKey: { actorId: actor.id, idempotencyKey: key } } }), actor);
        if (saved && saved.payloadHash === hash && saved.outcome) return saved.outcome;
        fail('IDEMPOTENCY_CONFLICT', 409);
      }
      throw error;
    }
  }
}
// truonglt Phase3 atomic business services end
