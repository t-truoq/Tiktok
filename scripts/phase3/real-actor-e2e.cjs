// truonglt Phase3.1 real JWT/JWKS HTTP + runtime Prisma rollback E2E start
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const{Client,Pool}=require('pg'),{PrismaPg}=require('@prisma/adapter-pg');const root=path.resolve(__dirname,'../..');require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
require('reflect-metadata');const{Module}=require('@nestjs/common'),{NestFactory}=require('@nestjs/core');
const{PrismaClient}=require('../../apps/api/dist/generated/prisma/client'),{databaseConnectionOptions,sanitizedDatabaseError}=require('../../apps/api/dist/database');
const{BusinessRepository}=require('../../apps/api/dist/business/repository'),{BusinessService}=require('../../apps/api/dist/business/service');
const{BusinessController}=require('../../apps/api/dist/business/controller'),{BusinessGuard,JwtVerifier}=require('../../apps/api/dist/business/security');
const subject='c918885f-c09c-40b0-a43a-4edcbdf69317',product=crypto.randomUUID(),prefix='__SYNTHETIC_REAL_E2E_'+crypto.randomUUID();
const report={startedAtUtc:new Date().toISOString(),status:'RUNNING',realJwt:false,realActor:subject,role:'ADMIN',tests:[],
  publicWritesEnabled:false,loopbackOnly:true,sourceImported:false,fixtureProductId:product,viewerHttpEvidence:'UNIT_SYNTHETIC_JWT_PLUS_LIVE_RLS_NOT_REAL_VIEWER_TOKEN'};
async function main(){
  // truonglt Phase4 opt-in applies only to the loopback rollback test process start
  process.env.BUSINESS_WRITE_ENABLED='true';
  // truonglt Phase4 opt-in applies only to the loopback rollback test process end
  const tokenFile=path.join(root,'artifacts/phase3-real-actor.jwt');if(!fs.existsSync(tokenFile)){report.status='BLOCKED_REAL_ACTOR_E2E';return;}
  const token=fs.readFileSync(tokenFile,'utf8').trim();assert.equal(await new JwtVerifier().verify(token),subject);report.realJwt=true;
  assert.equal(process.env.BUSINESS_API_ENABLED,'false');assert.equal(process.env.DB_ENVIRONMENT,'DEV');assert.equal(new URL(process.env.RUNTIME_DATABASE_URL).username,'tiktok_api_runtime.nqdaykgasfnsaixkhbya');
  const owner=new Client(databaseConnectionOptions(process.env.DIRECT_URL)),pool=new Pool({...databaseConnectionOptions(process.env.RUNTIME_DATABASE_URL),max:3});
  const prisma=new PrismaClient({adapter:new PrismaPg(pool),log:[]});await owner.connect();let created=false;
  const tables=['products','purchase_rounds','sales_details','stage_snapshots','product_history','mutation_requests'];
  const counts=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,(await owner.query('SELECT count(*)::int n FROM public."'+t+'"')).rows[0].n])));
  const rollback=Symbol('rollback');
  try{
    report.beforeCounts=await counts();assert.equal((await owner.query('SELECT role FROM public.users WHERE auth_subject=$1',[subject])).rows[0]?.role,'ADMIN');
    await owner.query("INSERT INTO public.products(id,legacy_key,root_name,root_name_normalized,classification,source_field_states,updated_at) VALUES($1,$2,$2,$2,'LEGACY_UNMATCHED','{}',now())",[product,prefix]);created=true;
    try{await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT set_config('app.auth_subject',${subject},true),set_config('app.actor_id',${subject},true)`;
      report.databaseRole=(await tx.$queryRaw`SELECT current_user role`)[0].role;assert.equal(report.databaseRole,'tiktok_api_runtime');let sequence=0,inject=false;
      class RollbackRepository extends BusinessRepository{
        async db(){return prisma;}
        async read(fn,actor){assert.equal(actor.subject,subject);assert.equal(actor.id,subject);return fn(tx);}
        async transaction(actor,fn){assert.equal(actor.subject,subject);assert.equal(actor.id,subject);
          const save='http_mutation_'+(++sequence);await tx.$executeRawUnsafe('SAVEPOINT '+save);
          const wrapped=inject?new Proxy(tx,{get(target,k){if(k==='productHistory')return{create:async()=>{throw Error('SYNTHETIC_FAILURE');}};return target[k];}}):tx;
          try{const value=await fn(wrapped);await tx.$executeRawUnsafe('RELEASE SAVEPOINT '+save);return value;}
          catch(e){await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT '+save);await tx.$executeRawUnsafe('RELEASE SAVEPOINT '+save);throw e;}
        }
      }
      class E2EModule{};Module({controllers:[BusinessController],providers:[BusinessService,BusinessGuard,{provide:BusinessRepository,useValue:new RollbackRepository()}]})(E2EModule);
      const app=await NestFactory.create(E2EModule,{logger:false});app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const url=await app.getUrl();
      const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
      const call=async(route,options={})=>{const response=await fetch(url+'/api/v1'+route,{...options,headers:options.headers||headers});const body=await response.json();return{httpStatus:response.status,body};};
      const mutation=async(operation,values,version,key)=>call('/products/'+product+'/mutations',{method:'POST',headers:{...headers,'Idempotency-Key':key},body:JSON.stringify({operation,values,expectedVersion:version})});
      const check=async(name,fn)=>{await fn();report.tests.push({name,status:'PASS'});};
      try{
        await check('real signed JWT resolves owner ADMIN from database and lists scoped synthetic product',async()=>{const r=await call('/products');assert.equal(r.httpStatus,200);assert(r.body.items.some(p=>p.id===product));});
        await check('anonymous mutation denied with no writes',async()=>{const r=await call('/products/'+product+'/mutations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.httpStatus,401);});
        await check('tampered real JWT subject denied',async()=>{const parts=token.split('.');const payload=JSON.parse(Buffer.from(parts[1],'base64url'));payload.sub=crypto.randomUUID();parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');const r=await call('/products',{headers:{Authorization:'Bearer '+parts.join('.')}});assert.equal(r.httpStatus,401);});
        await check('request body actor_id cannot spoof verified JWT identity',async()=>{const r=await call('/products/'+product+'/mutations',{method:'POST',headers:{...headers,'Idempotency-Key':'synthetic-e2e-spoof'},body:JSON.stringify({operation:'SET_STAGE',expectedVersion:1,values:{progress:'Đặt mẫu 3'},actor_id:crypto.randomUUID()})});assert.equal(r.httpStatus,400);assert.equal(r.body.code,'UNKNOWN_FIELD');});
        let stage;
        await check('real JWT authenticated stage mutation passes RLS and appends actor audit',async()=>{stage=await mutation('SET_STAGE',{progress:'Đặt mẫu 3'},1,'synthetic-e2e-stage');assert.equal(stage.httpStatus,201);assert.equal(stage.body.version,2);
          const h=await tx.productHistory.findFirst({where:{productId:product}});assert.equal(h.actorId,subject);assert.equal(h.originalPayload.source,'BUSINESS_API_V91');});
        await check('identical HTTP retry replays stored outcome and does not duplicate history',async()=>{const r=await mutation('SET_STAGE',{progress:'Đặt mẫu 3'},1,'synthetic-e2e-stage');assert.deepEqual(r.body,stage.body);assert.equal(await tx.productHistory.count({where:{productId:product}}),1);});
        await check('real HTTP version/key conflicts are409',async()=>{assert.equal((await mutation('EDIT_BUY',{value:'1'},1,'synthetic-e2e-stale')).httpStatus,409);assert.equal((await mutation('SET_STAGE',{progress:'Done'},1,'synthetic-e2e-stage')).httpStatus,409);});
        await check('round3 buy/receive/End sale/refund workflow keeps Decimal and history atomic',async()=>{
          assert.equal((await mutation('EDIT_BUY',{value:'12.34'},2,'synthetic-e2e-price')).body.finance.payment.unpaid,'12.34');
          assert.equal((await mutation('SET_STAGE',{progress:'Nhận mẫu 3'},3,'synthetic-e2e-receive')).body.finance.payment.paid,'12.34');
          assert.equal((await mutation('EDIT_BUY',{value:'1'},4,'synthetic-e2e-deny-received')).httpStatus,400);
          assert.equal((await mutation('SET_STAGE',{progress:'Đặt End 3'},4,'synthetic-e2e-end')).body.version,5);
          assert.equal((await mutation('EDIT_BUY',{value:'0.02'},5,'synthetic-e2e-end-price')).body.version,6);
          assert.equal((await mutation('EDIT_SALES',{unitPrice:'0.1',quantity:'0.2'},6,'synthetic-e2e-sales')).body.finance.projectedProfit,'0');
          const received=await mutation('SET_STAGE',{progress:'Nhận End 3'},7,'synthetic-e2e-end-receive');assert.equal(received.body.finance.refund.total,'12.34');assert.equal(received.body.version,8);
          const round=await tx.purchaseRound.findFirst({where:{productId:product,group:'END'},include:{sales:true}});assert.equal(round.sales.unitPrice.toString(),'0.1');assert(round.orderedAtUtc&&round.receivedAtUtc);
        });
        await check('Decimal/BIGINT HTTP serialization and read-only resources are accessible to real actor',async()=>{
          const r=await call('/products/'+product+'/rounds?group=END&roundIndex=3');assert.equal(r.httpStatus,200);assert.equal(r.body.items[0].roundIndex,'3');assert.equal(r.body.items[0].orderPrice,'0.02');
          for(const route of['/source-archives','/import-batches','/finance/summary',...['history','snapshots','refunds','images','legacy'].map(x=>'/products/'+product+'/'+x)])assert.equal((await call(route)).httpStatus,200);
        });
        await check('HTTP injected failure after writes rolls back version/round/snapshot/history/request',async()=>{
          const before=await tx.product.findUnique({where:{id:product}}),events=await tx.productHistory.count({where:{productId:product}}),requests=await tx.mutationRequest.count({where:{actorId:subject}});
          inject=true;const response=await mutation('EDIT_FIELDS',{note:'test'},8,'synthetic-e2e-failure');inject=false;assert.equal(response.httpStatus,503);assert.deepEqual(await tx.product.findUnique({where:{id:product}}),before);
          assert.equal(await tx.productHistory.count({where:{productId:product}}),events);assert.equal(await tx.mutationRequest.count({where:{actorId:subject}}),requests);
        });
        await check('Done snapshot/history through real JWT HTTP',async()=>{const done=await mutation('SET_STAGE',{progress:'Done'},8,'synthetic-e2e-done');assert.equal(done.body.version,9);assert.equal((await tx.stageSnapshot.findFirst({where:{productId:product,sourceLabel:'Done'}})).snapshot.status,'Hoàn tất');});
      }finally{await app.close();}
      throw rollback;
    },{timeout:90000,maxWait:10000,isolationLevel:'Serializable'});}catch(e){if(e!==rollback)throw e;}
    assert.equal((await owner.query('SELECT version FROM public.products WHERE id=$1',[product])).rows[0].version,1);
    for(const t of['product_history','stage_snapshots','purchase_rounds'])assert.equal((await owner.query('SELECT count(*)::int n FROM public."'+t+'" WHERE product_id=$1',[product])).rows[0].n,0);
    report.transactionRollback='PASS';report.status='PASS_REAL_ADMIN_JWT_HTTP_RUNTIME_RLS';
  }finally{
    await prisma.$disconnect();await pool.end();
    if(created){const removed=await owner.query('DELETE FROM public.products WHERE id=$1 AND legacy_key=$2',[product,prefix]);assert.equal(removed.rowCount,1);report.afterCounts=await counts();assert.deepEqual(report.afterCounts,report.beforeCounts);report.cleanup='PASS_EXACT_FIXTURE_COUNTS_RESTORED';}
    await owner.end();
  }
}
main().catch(e=>{report.status='FAIL';report.safeCode=sanitizedDatabaseError(e);process.exitCode=1;}).finally(()=>{report.finishedAtUtc=new Date().toISOString();fs.writeFileSync(path.join(root,'docs/phase3/REAL_ACTOR_E2E_RESULT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,realJwt:report.realJwt,role:report.databaseRole,tests:report.tests.length,cleanup:report.cleanup,safeCode:report.safeCode}));});
// truonglt Phase3.1 real JWT/JWKS HTTP + runtime Prisma rollback E2E end
