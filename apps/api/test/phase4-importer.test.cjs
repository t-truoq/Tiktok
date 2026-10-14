// truonglt Phase4 offline parser/Prisma writer preservation tests start
const{test}=require('node:test'),assert=require('node:assert/strict');const fs=require('node:fs');
const {buildPlan,reconcilePlan,importInTransaction,prismaData,models}=require('../../../scripts/phase4/importer.cjs');
const {sourcePath,sha,PINNED_SHA256}=require('../../../scripts/phase0/source-baseline.cjs');
const {Prisma}=require('../dist/generated/prisma/client');
const {hydrateProduct}=require('../dist/business/service');const{calculateFinance}=require('../dist/finance/engine');
const plan=buildPlan();
function memoryDatabase(){
  let data=Object.fromEntries(models.map(m=>[m,[]]));let failure;
  const tx={$queryRaw:async()=>[]};
  for(const model of models)tx[model]={
    createMany:async({data:rows})=>{if(failure===model)throw Error('INJECTED_TRANSACTION_FAILURE');
      for(const row of rows){assert(!data[model].some(x=>x.id===row.id),'DUPLICATE_ID');const x={...row};
        for(const k of Object.keys(x))if(x[k]===Prisma.DbNull||x[k]===Prisma.JsonNull)x[k]=null;
        data[model].push(x);}return{count:rows.length};},
    count:async()=>data[model].length,
    findUnique:async({where})=>data[model].find(row=>Object.entries(where).every(([key,val])=>key==='sourceArchiveId_mappingVersion'?row.sourceArchiveId===val.sourceArchiveId&&row.mappingVersion===val.mappingVersion:row[key]===val))||null,
    findMany:async({where,include})=>data[model].filter(row=>!where?.id?.in||where.id.in.includes(row.id)).map(row=>model==='product'&&include?
      {...row,legacyRecords:data.legacyRecord.filter(r=>r.productId===row.id),rounds:data.purchaseRound.filter(r=>r.productId===row.id)}:row)
  };
  return{tx,rows:()=>data,failAt:model=>failure=model,transaction:async fn=>{const prior=structuredClone(data);try{return await fn(tx);}catch(e){data=prior;throw e;}}};
}
test('HISTORY checksum and exact byte restore; all records/events/snapshots/properties survive mapping',()=>{
  const bytes=fs.readFileSync(sourcePath);assert.equal(sha(bytes),PINNED_SHA256);assert(Buffer.from(plan.rows.sourceArchive[0].originalBytesBase64,'base64').equals(bytes));
  const r=reconcilePlan(plan);assert.deepEqual([r.records,r.historyEvents,r.snapshots,r.properties,r.active,r.legacy],[46,1224,133,71,24,22]);
  assert.deepEqual(r.active24,{paid:'144155159',unpaid:'25352082',refundEligible:'53288699',projectedProfit:'33059918'});
  assert.equal(plan.rows.user.length,0);assert.equal(plan.rows.mutationRequest.length,0);
  assert.equal(plan.planSha256,buildPlan().planSha256);
});
test('mapper rejects wrong source checksum or altered history/decimal plan before writing',()=>{
  assert.throws(()=>buildPlan(Buffer.from('{}')),/SOURCE_CHECKSUM_MISMATCH/);
  const changed=structuredClone(plan);changed.rows.productHistory[0].originalPayload.timestamp='changed';assert.throws(()=>reconcilePlan(changed));
  const money=structuredClone(plan);money.rows.purchaseRound[0].orderPrice='999';assert.throws(()=>reconcilePlan(money),/PLAN_CHECKSUM_MISMATCH/);
});
test('Prisma NULL/DbNull/blank/zero, Decimal and BIGINT mappings retain distinct source states',()=>{
  assert.equal(prismaData('legacyValue',{state:'NULL',rawValue:null},Prisma).rawValue,Prisma.JsonNull);
  assert.equal(prismaData('legacyValue',{state:'MISSING'},Prisma).rawValue,Prisma.DbNull);
  assert.equal(prismaData('legacyValue',{state:'BLANK',rawValue:''},Prisma).rawValue,'');
  assert.equal(prismaData('legacyValue',{state:'NUMBER',rawValue:0,decimalValue:'0.000'},Prisma).decimalValue,'0.000');
  assert.equal(prismaData('purchaseRound',{roundIndex:'3',orderPrice:'0',orderPriceState:'NUMBER'},Prisma).roundIndex,3n);
  for(const r of plan.rows.purchaseRound)assert.equal(r.orderPrice!==null,r.orderPriceState==='NUMBER');
  for(const r of plan.rows.salesDetail){assert.equal(r.unitPrice!==null,r.unitPriceState==='NUMBER');assert.equal(r.soldQuantity!==null,r.quantityState==='NUMBER');}
  assert(plan.rows.purchaseRound.some(r=>BigInt(r.roundIndex)>=3n));
});
test('imported product hydration accepts both normalized record and old oracle envelope',()=>{
  for(const r of plan.rows.legacyRecord){const finance=calculateFinance(r.rawJson);assert.deepEqual(calculateFinance(hydrateProduct({legacyRecords:[r]})),finance);
    assert.deepEqual(calculateFinance(hydrateProduct({legacyRecords:[{...r,calculationProjection:{normalizedCopy:r.calculationProjection}}]})),finance);}
});
test('Prisma writer whole-source round-trip and idempotent replay are verified OFFLINE; no DB connection',async()=>{
  const memory=memoryDatabase();const result=await memory.transaction(tx=>importInTransaction(tx,plan,Prisma));assert.equal(result.replay,false);
  const counts=Object.fromEntries(models.map(m=>[m,memory.rows()[m].length]));const replay=await memory.transaction(tx=>importInTransaction(tx,plan,Prisma));assert.equal(replay.replay,true);
  assert.deepEqual(Object.fromEntries(models.map(m=>[m,memory.rows()[m].length])),counts);
  memory.rows().importBatch[0].planSha256='0'.repeat(64);await assert.rejects(memory.transaction(tx=>importInTransaction(tx,plan,Prisma)),/IDEMPOTENCY_CONFLICT/);
});
test('Prisma writer injected failure rolls back every model; duplicate existing product is never overwritten OFFLINE',async()=>{
  const memory=memoryDatabase();memory.failAt('productHistory');await assert.rejects(memory.transaction(tx=>importInTransaction(tx,plan,Prisma)),/INJECTED_TRANSACTION_FAILURE/);
  assert(models.every(m=>memory.rows()[m].length===0));memory.failAt(undefined);memory.rows().product.push({id:'existing'});
  await assert.rejects(memory.transaction(tx=>importInTransaction(tx,plan,Prisma)),/NONEMPTY_PRODUCTS_REQUIRE_OWNER_REVIEW/);assert.deepEqual(memory.rows().product,[{id:'existing'}]);
});
// truonglt Phase4 offline parser/Prisma writer preservation tests end
