// truonglt Phase4 preservation-first HISTORY parser, mapping and transactional importer start
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const Decimal=require('decimal.js');
const {prepare,reconcile:preservationReconcile,mapValue}=require('../phase2/preservation.cjs');
const {sourcePath,sha,decodeProperties,PINNED_SHA256}=require('../phase0/source-baseline.cjs');
const {normalizeRecord,configs,parseStage,calculateFinance}=require('../../apps/api/dist/finance/engine');
const {sourceDateToInstant,SOURCE_TIMEZONE}=require('../../apps/api/dist/finance/source-time');
const {hydrateProduct,canonical}=require('../../apps/api/dist/business/service');
const VERSION='history-prisma-v1';
const models=['user','sourceArchive','importBatch','product','legacyRecord','legacyValue','purchaseRound','salesDetail','stageSnapshot','productHistory','refund','productImage','mutationRequest'];
const uuid=key=>{const b=crypto.createHash('sha256').update(VERSION+':'+key).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;return [b.subarray(0,4),b.subarray(4,6),b.subarray(6,8),b.subarray(8,10),b.subarray(10)].map(x=>x.toString('hex')).join('-');};
const pointer=s=>s.replace(/~/g,'~0').replace(/\//g,'~1');
const text=v=>v===undefined||v===null?null:typeof v==='string'?v:String(v);
function buildPlan(bytes=fs.readFileSync(sourcePath)) {
  const preserved=prepare(bytes);preservationReconcile(preserved);
  const envelope=JSON.parse(bytes),decoded=decodeProperties(envelope),archiveId=uuid('archive:'+sha(bytes)),batchId=uuid('batch:'+sha(bytes));
  const findings=[];const rows=Object.fromEntries(models.map(m=>[m,[]]));
  const instant=(v,key)=>{try{return sourceDateToInstant(v)?.toISOString()??null;}catch(e){findings.push({key,code:e.code||'INVALID_SOURCE_DATE',raw:v});return null;}};
  const normalizedSlot=(r,k,scale)=>{
    const raw=mapValue(r,k,scale);let decimal=raw.decimal;
    // Calculation normalization may contain numeric strings; preserve the raw type separately.
    if(raw.state==='TEXT'&&raw.raw.trim()!==''&&Number.isFinite(Number(raw.raw))&&Number(raw.raw)>=0){
      const d=new Decimal(raw.raw.trim());if(d.decimalPlaces()>scale||d.abs().gte(new Decimal(10).pow(18-scale)))throw Error('DECIMAL_REQUIRES_REVIEW');decimal=d.toString();
    }
    return {decimal,state:decimal===null?raw.state:'NUMBER',raw};
  };
  rows.sourceArchive.push({id:archiveId,filename:path.basename(sourcePath),sha256:sha(bytes),originalBytesBase64:bytes.toString('base64'),
    metadata:Object.fromEntries(Object.entries(envelope).filter(([k])=>k!=='properties')),otherProperties:Object.fromEntries(decoded.otherProperties)});
  const perRecord=[];
  for(const source of preserved.records){
    const raw=source.rawRecord,r=normalizeRecord(raw),id=uuid('product:'+source.key),legacyId=uuid('legacy:'+source.key);
    const stage=parseStage(r.currentProgress);const money=normalizedSlot(r,'wholesale',2),qty=normalizedSlot(r,'qty',3),refundQty=normalizedSlot(r,'refundQty',3);
    rows.product.push({id,legacyKey:source.key,rootName:raw.name,rootNameNormalized:raw.name.trim().toLowerCase().replace(/\s+/g,' '),classification:source.classification,
      currentStageLabel:text(r.currentProgress),currentStageGroup:stage&&!stage.done?stage.group.toUpperCase():null,currentStageIndex:stage&&!stage.done?String(stage.index):null,
      currentStatus:text(r.status),currentDateText:text(r.currentDate),wholesale:money.decimal,sampleSalesQuantity:qty.decimal,refundQuantity:refundQty.decimal,
      note:text(r.note),pic:text(r.pic),sourceFieldStates:{rawValueTypes:source.valueTypes,financialSlots:{wholesale:money.raw,qty:qty.raw,refundQty:refundQty.raw}},version:1,archived:false});
    rows.legacyRecord.push({id:legacyId,productId:id,sourceArchiveId:archiveId,importBatchId:batchId,legacyKey:source.key,manifest:source.manifest,chunks:source.chunks,
      rawJsonText:source.decodedJson,rawJson:raw,decodedSha256:source.decodedSha256,fieldTypes:source.valueTypes,schemaVersionText:text(raw.schemaVersion),
      calculationProjection:r,sourceTimezone:SOURCE_TIMEZONE});
    const values=new Map();
    function walk(v,p='') {const state=v===null?'NULL':v===''?'BLANK':Array.isArray(v)?'ARRAY':({number:'NUMBER',string:'TEXT',boolean:'BOOLEAN',object:'OBJECT'})[typeof v];
      values.set(p,{state,rawValue:v});if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))walk(x,p+'/'+pointer(k));}
    walk(raw);
    // Explicit missing slots are distinct from JSON null and blank; the entire raw record also survives.
    for(const k of ['wholesale','qty','refundQty','price','endPrice'])if(!Object.hasOwn(raw,k))values.set('/'+k,{state:'MISSING'});
    for(const slot of source.financialSlots){const existing=values.get(slot.pointer);if(existing&&slot.state==='NUMBER')existing.decimalValue=slot.decimal;}
    for(const[p,v]of values)rows.legacyValue.push({id:uuid('value:'+source.key+p),legacyRecordId:legacyId,jsonPointer:p,...v});
    const roundIds=new Map();
    for(const cfg of configs(r)){
      const roundId=uuid('round:'+source.key+cfg.key);roundIds.set(cfg.key,roundId);const state=r.purchaseState[cfg.key]||{},price=normalizedSlot(r,cfg.priceKey,2);
      const orderDate=r.stageData?.[cfg.ordered]?.date,receiveDate=r.stageData?.[cfg.received]?.date;
      rows.purchaseRound.push({id:roundId,productId:id,group:cfg.group.toUpperCase(),roundIndex:String(cfg.index),ordered:typeof state.ordered==='boolean'?state.ordered:null,
        received:typeof state.received==='boolean'?state.received:null,cancelled:typeof state.cancelled==='boolean'?state.cancelled:null,verified:typeof state.verified==='boolean'?state.verified:null,
        issue:text(state.issue),orderPrice:price.decimal,orderPriceState:price.state,orderedAtText:text(orderDate),receivedAtText:text(receiveDate),
        orderedAtUtc:instant(orderDate,source.key+'/'+cfg.key+'/ordered'),receivedAtUtc:instant(receiveDate,source.key+'/'+cfg.key+'/received'),
        ...(Object.hasOwn(raw.purchaseState||{},cfg.key)?{rawState:raw.purchaseState[cfg.key]}:{}),sourceFieldStates:{rawPrice:mapValue(raw,cfg.priceKey),projectionPrice:price.raw,projectionState:state},version:1});
      if(cfg.group==='end') {const pkey=`sellEnd${cfg.index}`,qkey=`qtySellEnd${cfg.index}`,unit=normalizedSlot(r,pkey,2),quantity=normalizedSlot(r,qkey,3);
        rows.salesDetail.push({id:uuid('sales:'+roundId),roundId,unitPrice:unit.decimal,unitPriceState:unit.state,soldQuantity:quantity.decimal,quantityState:quantity.state,
          rawFields:{unitPrice:mapValue(raw,pkey),quantity:mapValue(raw,qkey),projectionUnit:unit.raw,projectionQuantity:quantity.raw}});}
    }
    for(const h of source.history)rows.productHistory.push({id:uuid(h.key),productId:id,importBatchId:batchId,legacyEventIndex:h.index,eventType:text(h.payload.type)||'SOURCE_EVENT_TYPE_MISSING',
      stageLabel:text(h.payload.progress),sourceTimestampText:text(h.payload.timestamp),occurredAtUtc:instant(h.payload.timestamp,h.key),originalPayload:h.payload,actorId:null});
    for(const s of source.snapshots)rows.stageSnapshot.push({id:uuid(s.key),productId:id,sourceLabel:s.label,snapshot:s.payload,sourceDateText:text(s.payload.date),
      effectiveAtUtc:instant(s.payload.date,s.key),sourceJsonPointer:'/stageData/'+pointer(s.label),importBatchId:batchId});
    const finance=calculateFinance(r),expected=source.calculationProjection;
    for(const field of ['paid','unpaid','incurred','sampleTotal','endTotal'])assert(new Decimal(finance.payment[field]).eq(expected.payment[field]),source.key+':'+field);
    assert(new Decimal(finance.refund.total).eq(expected.refund.total),source.key+':refund');assert(new Decimal(finance.projectedProfit).eq(expected.projectedProfit),source.key+':profit');
    assert.equal(finance.payment.missing,expected.payment.missing);assert.equal(finance.payment.review,expected.payment.review);
    assert.equal(canonical(finance),canonical(calculateFinance(raw)),'RAW_PROJECTION_PER_ROUND_PARITY');
    assert.deepEqual(finance.payment.details,expected.payment.details.map(d=>({...d,amount:d.amount==null?d.amount:String(d.amount)})),'V91_PER_ROUND_PARITY');
    // Immutable raw values are separate from V9.1 calculation projection; no invented actual-cash refund.
    rows.refund.push({id:uuid('refund:'+source.key),productId:id,eligibility:{...finance.refund,derivedBy:'V9.1',actualCashNotInferred:true},
      reviewFields:{paymentMissing:finance.payment.missing,paymentReview:finance.payment.review,refundQty:mapValue(raw,'refundQty'),sourceStatus:mapValue(raw,'status')}});
    if(Object.hasOwn(raw,'image')||Object.hasOwn(raw,'pic'))rows.productImage.push({id:uuid('image:'+source.key),productId:id,
      legacyReference:{image:mapValue(raw,'image'),pic:mapValue(raw,'pic'),picMau1:mapValue(raw,'picMau1'),picMau2:mapValue(raw,'picMau2')},uploadMetadata:{sourceOnly:true,storageUpload:false}});
    const product=rows.product.at(-1),hydrated=hydrateProduct({...product,legacyRecords:[rows.legacyRecord.at(-1)]});
    assert.equal(canonical(calculateFinance(hydrated)),canonical(finance),'HYDRATION_PARITY');
    perRecord.push({key:source.key,classification:source.classification,finance,rawSha256:source.decodedSha256,rounds:configs(r).map(c=>c.key)});
  }
  rows.importBatch.push({id:batchId,sourceArchiveId:archiveId,mappingVersion:VERSION,planSha256:'',status:'COMMITTED',importedCount:rows.product.length,failedCount:0});
  const body={mappingVersion:VERSION,sourceSha256:sha(bytes),propertyCount:Object.keys(envelope.properties).length,rows,findings,perRecord};
  body.planSha256=sha(canonical(body));rows.importBatch[0].planSha256=body.planSha256;
  reconcilePlan(body);return body;
}
function reconcilePlan(plan) {
  assert.equal(plan.sourceSha256,PINNED_SHA256);const bytes=Buffer.from(plan.rows.sourceArchive[0].originalBytesBase64,'base64');assert.equal(sha(bytes),plan.sourceSha256);
  const decoded=decodeProperties(JSON.parse(bytes));const records=new Map(decoded.records.map(r=>[r.key,r]));
  assert.equal(plan.propertyCount,71);assert.equal(plan.rows.product.length,46);assert.equal(plan.rows.productHistory.length,1224);assert.equal(plan.rows.stageSnapshot.length,133);
  for(const legacy of plan.rows.legacyRecord){const r=records.get(legacy.legacyKey);assert(r);assert.equal(legacy.rawJsonText,r.decodedJson);assert.deepEqual(legacy.rawJson,r.rawRecord);
    assert.equal(sha(legacy.rawJsonText),legacy.decodedSha256);assert.equal(legacy.manifest,r.manifest);assert.deepEqual(legacy.chunks,r.chunks);
    const h=plan.rows.productHistory.filter(h=>h.productId===legacy.productId).sort((a,b)=>a.legacyEventIndex-b.legacyEventIndex);assert.deepEqual(h.map(h=>h.originalPayload),r.rawRecord.history||[]);
    const s=plan.rows.stageSnapshot.filter(s=>s.productId===legacy.productId);assert.deepEqual(Object.fromEntries(s.map(s=>[s.sourceLabel,s.snapshot])),r.rawRecord.stageData||{});
  }
  const copy=structuredClone(plan);delete copy.planSha256;copy.rows.importBatch[0].planSha256='';assert.equal(sha(canonical(copy)),plan.planSha256,'PLAN_CHECKSUM_MISMATCH');
  const active=plan.perRecord.filter(r=>r.classification==='XLSX_MATCHED');const totals={paid:new Decimal(0),unpaid:new Decimal(0),refundEligible:new Decimal(0),projectedProfit:new Decimal(0)};
  const sourceFindings=require('../../docs/phase0/SOURCE_BASELINE_VALIDATION.json').findings;
  for(const r of active){totals.paid=totals.paid.plus(r.finance.payment.paid);totals.unpaid=totals.unpaid.plus(r.finance.payment.unpaid);totals.refundEligible=totals.refundEligible.plus(r.finance.refund.total);totals.projectedProfit=totals.projectedProfit.plus(r.finance.projectedProfit);}
  return {records:46,historyEvents:1224,snapshots:133,properties:71,active:active.length,legacy:plan.perRecord.length-active.length,
    modelCounts:Object.fromEntries(models.map(m=>[m,plan.rows[m].length])),active24:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v.toString()])),
    financialParity:'PASS_46_RECORDS_PER_ROUND',originalBytesRestorable:true,dateMappingFindings:plan.findings,
    sourceBusinessFindingCounts:sourceFindings.reduce((counts,f)=>({...counts,[f.kind]:(counts[f.kind]||0)+1}),{}),sourceBusinessFindingsPreserved:true,
    sourceFindingEvidence:'docs/phase0/SOURCE_BASELINE_VALIDATION.json'};
}
function prismaData(model,row,Prisma) {
  const data={...row};if(model==='sourceArchive'){data.originalBytes=Buffer.from(data.originalBytesBase64,'base64');delete data.originalBytesBase64;}
  for(const field of ['currentStageIndex','roundIndex'])if(data[field]!=null)data[field]=BigInt(data[field]);
  for(const field of ['occurredAtUtc','effectiveAtUtc','orderedAtUtc','receivedAtUtc'])if(data[field]!=null)data[field]=new Date(data[field]);
  const jsonFields={legacyValue:['rawValue'],purchaseRound:['rawState'],productHistory:['originalPayload'],stageSnapshot:['snapshot']};
  for(const k of jsonFields[model]||[])if(data[k]===null)data[k]=Prisma.JsonNull;
  if(model==='legacyValue'&&data.state==='MISSING')data.rawValue=Prisma.DbNull;
  return data;
}
async function importInTransaction(tx,plan,Prisma) {
  const summary=reconcilePlan(plan),batch=plan.rows.importBatch[0];
  // Transaction lock serializes retries before unique reservation; no repairs or upserts of existing products.
  // PostgreSQL lock returns void; cast to text so Prisma can deserialize it safely.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${plan.sourceSha256+':'+VERSION},0))::text AS acquired`;
  const existing=await tx.importBatch.findUnique({where:{sourceArchiveId_mappingVersion:{sourceArchiveId:batch.sourceArchiveId,mappingVersion:VERSION}}});
  if(existing){assert.equal(existing.planSha256,plan.planSha256,'IDEMPOTENCY_CONFLICT');assert.equal(existing.status,'COMMITTED','IMPORT_BATCH_NOT_COMMITTED');
    await verifyImported(tx,plan);return {replay:true,...summary};}
  if(await tx.product.count())throw Error('NONEMPTY_PRODUCTS_REQUIRE_OWNER_REVIEW');
  if(await tx.sourceArchive.findUnique({where:{sha256:plan.sourceSha256}}))throw Error('ARCHIVE_EXISTS_WITHOUT_MATCHING_BATCH');
  for(const model of ['sourceArchive','importBatch','product','legacyRecord','legacyValue','purchaseRound','salesDetail','stageSnapshot','productHistory','refund','productImage']){
    const rows=plan.rows[model];for(let i=0;i<rows.length;i+=500)await tx[model].createMany({data:rows.slice(i,i+500).map(r=>prismaData(model,r,Prisma))});
  }
  // users and mutation_requests have no source counterparts: retain existing identities; never invent actors.
  await verifyImported(tx,plan);return {replay:false,...summary};
}
async function verifyImported(tx,plan) {
  const archive=await tx.sourceArchive.findUnique({where:{id:plan.rows.sourceArchive[0].id}});
  assert(archive);assert.equal(sha(Buffer.from(archive.originalBytes)),plan.sourceSha256);assert.deepEqual(archive.otherProperties,plan.rows.sourceArchive[0].otherProperties);
  for(const model of models.filter(m=>!['user','mutationRequest'].includes(m))){const expected=plan.rows[model];
    const actual=await tx[model].findMany({where:{id:{in:expected.map(r=>r.id)}}});assert.equal(actual.length,expected.length,'DATABASE_COUNT_'+model);
    const byId=new Map(actual.map(r=>[r.id,r]));for(const row of expected){const got=byId.get(row.id);
      for(const[k,v]of Object.entries(row)){if(k==='originalBytesBase64')continue;
        if(['currentStageIndex','roundIndex'].includes(k)&&v!=null)assert.equal(String(got[k]),v);
        else if(['occurredAtUtc','effectiveAtUtc','orderedAtUtc','receivedAtUtc'].includes(k)&&v!=null)assert.equal(got[k].toISOString(),v);
        else if(['wholesale','sampleSalesQuantity','refundQuantity','orderPrice','unitPrice','soldQuantity','decimalValue'].includes(k)&&v!=null)assert(new Decimal(got[k].toString()).eq(v));
        else assert.equal(canonical(got[k]),canonical(v),'DATABASE_ROUND_TRIP_'+model+'.'+k);
      }
      if(model==='legacyValue'&&row.state==='MISSING')assert.equal(got.rawValue,null);
    }
  }
  const products=await tx.product.findMany({where:{id:{in:plan.rows.product.map(p=>p.id)}},include:{legacyRecords:true,rounds:{include:{sales:true}}}});
  for(const record of plan.perRecord){const product=products.find(p=>p.id===uuid('product:'+record.key));assert(product);
    assert.equal(canonical(calculateFinance(hydrateProduct(product))),canonical(record.finance),'DATABASE_FINANCE_PARITY');}
}
module.exports={buildPlan,reconcilePlan,prismaData,importInTransaction,verifyImported,models,VERSION,uuid};
// truonglt Phase4 preservation-first HISTORY parser, mapping and transactional importer end
