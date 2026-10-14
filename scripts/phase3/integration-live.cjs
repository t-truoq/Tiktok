// truonglt Phase3 Prisma business service synthetic rollback integration start
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const root = path.resolve(__dirname, '../..');
require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
const { PrismaClient } = require('../../apps/api/dist/generated/prisma/client');
const { databaseConnectionOptions, sanitizedDatabaseError } = require('../../apps/api/dist/database');
const { BusinessService } = require('../../apps/api/dist/business/service');
const { mutationDto } = require('../../apps/api/dist/business/contracts');
const report = { startedAtUtc:new Date().toISOString(), syntheticOnly:true, importsExecuted:false, schemaChangesExecuted:false,
  tests:[], runtimeRoleVerification:'PENDING', multiSessionRace:'NOT_EXECUTED', status:'RUNNING' };
const tables = ['users','sourceArchive','importBatch','product','legacyRecord','legacyValue','purchaseRound','salesDetail','stageSnapshot','productHistory','refund','productImage','mutationRequest'];
tables[0]='user';
async function main(){
  assert.equal(process.env.DB_ENVIRONMENT,'DEV');
  const u=new URL(process.env.DIRECT_URL);
  assert.equal(u.username,'postgres.nqdaykgasfnsaixkhbya'); assert.equal(u.hostname,'aws-0-ap-northeast-2.pooler.supabase.com'); assert.equal(u.port,'5432'); assert.equal(u.pathname,'/postgres');
  const pool=new Pool({...databaseConnectionOptions(process.env.DIRECT_URL),max:1,connectionTimeoutMillis:10000});
  const prisma=new PrismaClient({adapter:new PrismaPg(pool),log:[]});
  const counts=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,await prisma[t].count()])));
  const rollback=Symbol('outer-rollback'); let before;
  try{
    before=await counts(); report.beforeCounts=before;
    const roles=await prisma.$queryRaw`SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='tiktok_api_runtime'`;
    report.runtimeRoleVerification=roles.length?'PRESENT_REQUIRES_POLICIES_AND_LOGIN_TEST':'BLOCKED_ROLE_NOT_PROVISIONED';
    report.runtimePolicies=await prisma.$queryRaw`SELECT tablename,policyname,cmd FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`;
    try{
      await prisma.$transaction(async tx=>{
        const id=crypto.randomUUID(),actorId=crypto.randomUUID(),subject='phase3-synthetic-'+crypto.randomUUID();
        await tx.user.create({data:{id:actorId,authSubject:subject,role:'EDITOR'}});
        await tx.product.create({data:{id,legacyKey:'SYNTHETIC_PHASE3_'+id,rootName:'Synthetic only '+id,rootNameNormalized:'synthetic '+id,
          classification:'LEGACY_UNMATCHED',sourceFieldStates:{},currentStageLabel:null}});
        let seq=0, injectFailure=false;
        const repository={read:fn=>fn(tx),transaction:async(_actor,fn)=>{
          const savepoint='synthetic_mutation_'+(++seq); await tx.$executeRawUnsafe('SAVEPOINT '+savepoint);
          const wrapped=injectFailure?new Proxy(tx,{get(target,key){if(key==='productHistory')return{create:async()=>{throw Error('SYNTHETIC_INJECTED_FAILURE');}};return target[key];}}):tx;
          try{const outcome=await fn(wrapped);await tx.$executeRawUnsafe('RELEASE SAVEPOINT '+savepoint);return outcome;}
          catch(error){await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT '+savepoint);await tx.$executeRawUnsafe('RELEASE SAVEPOINT '+savepoint);throw error;}
        }};
        const service=new BusinessService(repository),actor={id:actorId,subject,role:'EDITOR'};
        const mutate=(operation,values,version,key)=>service.mutate(id,mutationDto({operation,values,expectedVersion:version}),actor,key);
        const check=async(name,fn)=>{await fn();report.tests.push({name,status:'PASS'});};
        let outcome;
        await check('stage transition commits projection, round, snapshot, audit and request together inside rollback transaction',async()=>{
          outcome=await mutate('SET_STAGE',{progress:'Đặt mẫu 3'},1,'synthetic-stage-3');
          assert.equal(outcome.version,2);assert.equal(await tx.purchaseRound.count({where:{productId:id}}),1);
          assert.equal(await tx.stageSnapshot.count({where:{productId:id}}),1);assert.equal(await tx.productHistory.count({where:{productId:id}}),1);
        });
        await check('exact replay returns stored outcome with no second event',async()=>{
          const replay=await mutate('SET_STAGE',{progress:'Đặt mẫu 3'},1,'synthetic-stage-3');assert.deepEqual(replay,outcome);
          assert.equal(await tx.productHistory.count({where:{productId:id}}),1);
        });
        await check('same idempotency key with different payload is HTTP 409',async()=>{
          await assert.rejects(()=>mutate('SET_STAGE',{progress:'Đặt End 3'},1,'synthetic-stage-3'),e=>e.getStatus()===409&&e.getResponse().code==='IDEMPOTENCY_CONFLICT');
        });
        await check('stale version is HTTP 409 with no history append',async()=>{
          await assert.rejects(()=>mutate('EDIT_BUY',{value:'1.23'},1,'synthetic-stale-3'),e=>e.getStatus()===409&&e.getResponse().code==='VERSION_CONFLICT');
        });
        await check('Decimal 12.34 stored exactly and finance recomputed',async()=>{
          outcome=await mutate('EDIT_BUY',{value:'12.34'},2,'synthetic-price-3');assert.equal(outcome.finance.payment.unpaid,'12.34');
          const round=await tx.purchaseRound.findFirst({where:{productId:id}});assert.equal(round.orderPrice.toString(),'12.34');
        });
        await check('VIEWER denied and transaction role downgrade cannot write',async()=>{
          await assert.rejects(()=>service.mutate(id,mutationDto({operation:'CANCEL_STAGE',values:{},expectedVersion:3}),{...actor,role:'VIEWER'},'synthetic-viewer'),e=>e.getStatus()===403);
          await tx.user.update({where:{id:actorId},data:{role:'VIEWER'}});
          await assert.rejects(()=>mutate('CANCEL_STAGE',{},3,'synthetic-downgrade'),e=>e.getStatus()===403);
          await tx.user.update({where:{id:actorId},data:{role:'EDITOR'}});
        });
        await check('failure after product/round/request writes rolls back all effects',async()=>{
          const countsBefore={round:await tx.purchaseRound.findFirst({where:{productId:id}}),product:await tx.product.findUnique({where:{id}}),
            history:await tx.productHistory.count({where:{productId:id}}),requests:await tx.mutationRequest.count({where:{actorId}}),snapshots:await tx.stageSnapshot.count({where:{productId:id}})};
          injectFailure=true;await assert.rejects(()=>mutate('EDIT_BUY',{value:'99'},3,'synthetic-failure'),/SYNTHETIC_INJECTED_FAILURE/);injectFailure=false;
          assert.deepEqual(await tx.product.findUnique({where:{id}}),countsBefore.product);
          assert.deepEqual(await tx.purchaseRound.findFirst({where:{productId:id}}),countsBefore.round);
          assert.equal(await tx.productHistory.count({where:{productId:id}}),countsBefore.history);
          assert.equal(await tx.mutationRequest.count({where:{actorId}}),countsBefore.requests);
          assert.equal(await tx.stageSnapshot.count({where:{productId:id}}),countsBefore.snapshots);
        });
        await check('current priced order cancel follows source header reactivation, preserving price and audit',async()=>{
          const cancelled=await mutate('CANCEL_STAGE',{},3,'synthetic-cancel');assert.equal(cancelled.finance.payment.unpaid,'12.34');
          outcome=await mutate('RESTORE_STAGE',{},4,'synthetic-restore');assert.equal(outcome.finance.payment.unpaid,'12.34');
        });
        await check('received End matches Sample round refund eligibility and Decimal sales',async()=>{
          outcome=await mutate('SET_STAGE',{progress:'Đặt End 3'},5,'synthetic-end-order');
          outcome=await mutate('EDIT_BUY',{value:'0.02'},6,'synthetic-end-buy');
          outcome=await mutate('EDIT_SALES',{unitPrice:'0.1',quantity:'0.2'},7,'synthetic-end-sale');
          assert.equal(outcome.finance.projectedProfit,'0');
          outcome=await mutate('SET_STAGE',{progress:'Nhận End 3'},8,'synthetic-end-receive');
          assert.equal(outcome.finance.refund.total,'12.34');assert.equal(outcome.finance.payment.paid,'0.02');
          const round=await tx.purchaseRound.findFirst({where:{productId:id,group:'END'},include:{sales:true}});
          assert.equal(round.sales.unitPrice.toString(),'0.1');assert.equal(round.sales.soldQuantity.toString(),'0.2');
          assert.equal(round.sales.unitPriceState,'NUMBER');assert.equal(round.sales.rawFields.unitPriceRawState,'TEXT');
        });
        await check('clearing order price distinguishes missing price from zero without deleting audit',async()=>{
          outcome=await mutate('SET_STAGE',{progress:'Đặt mẫu 3'},9,'synthetic-back-order');
          outcome=await mutate('EDIT_BUY',{value:''},10,'synthetic-clear-price');assert.equal(outcome.finance.payment.missing,1);
          const round=await tx.purchaseRound.findFirst({where:{productId:id,group:'SAMPLE'}});assert.equal(round.orderPriceState,'NULL');assert.equal(round.orderPrice,null);
          outcome=await mutate('EDIT_BUY',{value:'0'},11,'synthetic-zero-price');assert.equal(outcome.finance.payment.missing,0);
          assert.equal((await tx.purchaseRound.findFirst({where:{productId:id,group:'SAMPLE'}})).orderPrice.toString(),'0');
        });
        await check('Done appends snapshot and sequenced immutable leave/enter history',async()=>{
          outcome=await mutate('SET_STAGE',{progress:'Done'},12,'synthetic-done');assert.equal(outcome.version,13);
          const snapshot=await tx.stageSnapshot.findFirst({where:{productId:id,sourceLabel:'Done'}});
          assert.equal(snapshot.snapshot.progress,'Done');assert.equal(snapshot.snapshot.status,'Hoàn tất');
          assert.equal((await tx.product.findUnique({where:{id}})).currentStageIndex,null);
          assert.equal(await tx.productHistory.count({where:{productId:id,eventType:'ENTER_STAGE',stageLabel:'Done'}}),1);
        });
        await check('history database update rejected',async()=>{
          await tx.$executeRawUnsafe('SAVEPOINT immutable_test');let failed=false;
          try{await tx.productHistory.updateMany({where:{productId:id},data:{eventType:'INVALID'}});}catch{failed=true;}
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT immutable_test');await tx.$executeRawUnsafe('RELEASE SAVEPOINT immutable_test');assert(failed);
        });
        throw rollback;
      },{timeout:60000,maxWait:10000});
    }catch(error){if(error!==rollback){report.afterFailureCounts=await counts();assert.deepEqual(report.afterFailureCounts,before);report.rollback='PASS_AFTER_FAILURE';throw error;}}
    report.afterCounts=await counts();assert.deepEqual(report.afterCounts,before);report.rollback='PASS';
    report.tests.push({name:'outer rollback restores all 13 table counts',status:'PASS'});
    report.status='SYNTHETIC_SERVICE_PASS_SECURITY_BLOCKED';
  }finally{await prisma.$disconnect();await pool.end();}
}
main().catch(error=>{report.status='FAIL';report.safeCode=sanitizedDatabaseError(error);process.exitCode=1;}).finally(()=>{
  report.finishedAtUtc=new Date().toISOString();fs.writeFileSync(path.join(root,'docs/phase3/INTEGRATION_LIVE_RESULT.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,tests:report.tests.length,rollback:report.rollback,runtimeRoleVerification:report.runtimeRoleVerification,safeCode:report.safeCode}));
});
// truonglt Phase3 Prisma business service synthetic rollback integration end
