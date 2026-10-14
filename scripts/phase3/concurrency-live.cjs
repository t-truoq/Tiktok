// truonglt Phase3.1 actual multi-session runtime races with guarded synthetic cleanup start
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const{Client,Pool}=require('pg'),{PrismaPg}=require('@prisma/adapter-pg');const root=path.resolve(__dirname,'../..');
require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
const{PrismaClient}=require('../../apps/api/dist/generated/prisma/client'),{databaseConnectionOptions,sanitizedDatabaseError}=require('../../apps/api/dist/database');
const{BusinessRepository}=require('../../apps/api/dist/business/repository'),{BusinessService,canonical}=require('../../apps/api/dist/business/service'),{mutationDto}=require('../../apps/api/dist/business/contracts');
const actor={id:'c918885f-c09c-40b0-a43a-4edcbdf69317',subject:'c918885f-c09c-40b0-a43a-4edcbdf69317',role:'ADMIN'};
const product=crypto.randomUUID(),request=crypto.randomUUID(),prefix='__SYNTHETIC_CONCURRENCY_'+crypto.randomUUID(),key='synthetic-race-'+crypto.randomUUID();
const report={startedAtUtc:new Date().toISOString(),status:'RUNNING',evidenceScope:'LIVE_POSTGRESQL_MULTIPLE_RUNTIME_SESSIONS_NOT_REAL_JWT_HTTP',tests:[],
  fixtureStrategy:'Temporary committed blank product/version and request metadata; financial service transactions rollback; exact UUID/prefix cleanup, no immutable history committed',productId:product,importsExecuted:false};
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function main(){
  assert.equal(process.env.DB_ENVIRONMENT,'DEV');assert.equal(new URL(process.env.RUNTIME_DATABASE_URL).username,'tiktok_api_runtime.nqdaykgasfnsaixkhbya');
  const owner=new Client(databaseConnectionOptions(process.env.DIRECT_URL)),a=new Client(databaseConnectionOptions(process.env.RUNTIME_DATABASE_URL));
  const pool=new Pool({...databaseConnectionOptions(process.env.RUNTIME_DATABASE_URL),max:2});const prisma=new PrismaClient({adapter:new PrismaPg(pool),log:[]});
  await owner.connect();await a.connect();
  const tables=['products','purchase_rounds','sales_details','product_history','stage_snapshots','mutation_requests'];
  const counts=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,(await owner.query('SELECT count(*)::int n FROM public."'+t+'"')).rows[0].n])));
  const ctx=()=>a.query("SELECT set_config('app.actor_id',$1,true),set_config('app.auth_subject',$1,true)",[actor.id]);
  let created=false;
  try{
    report.beforeCounts=await counts();
    await owner.query("INSERT INTO public.products(id,legacy_key,root_name,root_name_normalized,classification,source_field_states,updated_at) VALUES($1,$2,$2,$2,'LEGACY_UNMATCHED','{}',now())",[product,prefix]);created=true;
    const check=async(name,fn)=>{await fn();report.tests.push({name,status:'PASS'});};
    class VerificationRepository extends BusinessRepository{async db(){return prisma;}}
    const read=defer(),advance=defer();let bPid;
    class RaceRepository extends VerificationRepository{
      async transaction(actor,fn){return super.transaction(actor,async tx=>{
        bPid=(await tx.$queryRaw`SELECT pg_backend_pid() pid`)[0].pid;
        const wrapped=new Proxy(tx,{get(target,k){if(k==='product')return new Proxy(target.product,{get(model,m){
          if(m==='findUnique')return async args=>{const value=await model.findUnique(args);read.resolve();await advance.promise;return value;};return model[m];}});return target[k];}});
        return fn(wrapped);
      });}
    }
    await check('two sessions read stale version; committed competing version produces HTTP409 with all loser effects rolled back',async()=>{
      const service=new BusinessService(new RaceRepository());const pending=service.mutate(product,mutationDto({operation:'SET_STAGE',values:{progress:'Đặt mẫu 3'},expectedVersion:1}),actor,key+'-version')
        .then(value=>({value}),error=>({error}));
      await Promise.race([read.promise,new Promise((_,rej)=>setTimeout(()=>rej(Error('BARRIER_TIMEOUT')),10000))]);
      await a.query('BEGIN');await ctx();const aPid=(await a.query('SELECT pg_backend_pid() pid')).rows[0].pid;assert.notEqual(aPid,bPid);report.backendPids={a:aPid,b:bPid};
      assert.equal((await a.query('UPDATE public.products SET version=version+1 WHERE id=$1 AND version=1',[product])).rowCount,1);await a.query('COMMIT');advance.resolve();
      const result=await pending;assert.equal(result.error?.getStatus(),409);assert.equal(result.error.getResponse().code,'VERSION_CONFLICT');
      assert.equal((await owner.query('SELECT version FROM public.products WHERE id=$1',[product])).rows[0].version,2);
      for(const t of['purchase_rounds','product_history','stage_snapshots'])assert.equal((await owner.query('SELECT count(*)::int n FROM public."'+t+'" WHERE product_id=$1',[product])).rows[0].n,0);
    });
    await check('concurrent unique request lock returns identical stored outcome after loser transaction rollback',async()=>{
      const dto=mutationDto({operation:'SET_STAGE',values:{progress:'Đặt End 3'},expectedVersion:2});
      const hash=crypto.createHash('sha256').update(canonical({id:product,...dto})).digest('hex');const outcome={id:product,version:2,requestId:request,syntheticOutcome:true};
      await a.query('BEGIN');await ctx();await a.query('INSERT INTO public.mutation_requests(id,idempotency_key,actor_id,action,payload_hash,outcome) VALUES($1,$2,$3,$4,$5,$6)',[request,key,actor.id,dto.operation,hash,JSON.stringify(outcome)]);
      const beforeInsert=defer(),continueInsert=defer();
      class DuplicateRepository extends VerificationRepository{async transaction(actor,fn){return super.transaction(actor,tx=>fn(new Proxy(tx,{get(target,k){
        if(k==='mutationRequest')return new Proxy(target.mutationRequest,{get(model,m){if(m==='create')return async args=>{beforeInsert.resolve();await continueInsert.promise;return model.create(args);};return model[m];}});return target[k];
      }})));}}
      const service=new BusinessService(new DuplicateRepository());const pending=service.mutate(product,dto,actor,key).then(value=>({value}),error=>({error}));
      await Promise.race([beforeInsert.promise,new Promise((_,rej)=>setTimeout(()=>rej(Error('BARRIER_TIMEOUT')),10000))]);
      continueInsert.resolve();await new Promise(r=>setTimeout(r,100));await a.query('COMMIT');
      const result=await pending;if(result.error)throw result.error;assert.deepEqual(result.value,outcome);
      assert.equal((await owner.query('SELECT version FROM public.products WHERE id=$1',[product])).rows[0].version,2);
      for(const t of['purchase_rounds','product_history','stage_snapshots'])assert.equal((await owner.query('SELECT count(*)::int n FROM public."'+t+'" WHERE product_id=$1',[product])).rows[0].n,0);
      assert.equal((await owner.query('SELECT count(*)::int n FROM public.mutation_requests WHERE idempotency_key=$1',[key])).rows[0].n,1);
    });
    await check('different payload with replay key is HTTP409',async()=>{
      const service=new BusinessService(new VerificationRepository());await assert.rejects(()=>service.mutate(product,mutationDto({operation:'SET_STAGE',values:{progress:'Done'},expectedVersion:2}),actor,key),e=>e.getStatus()===409&&e.getResponse().code==='IDEMPOTENCY_CONFLICT');
    });
    report.status='PASS_MULTI_SESSION_CONFLICT_AND_REPLAY';
  }finally{
    try{await a.query('ROLLBACK');}catch{}
    await prisma.$disconnect();await pool.end();
    if(created){
      // No immutable financial/history rows were committed. Cleanup is exact synthetic metadata only.
      await owner.query('BEGIN');await owner.query('DELETE FROM public.mutation_requests WHERE id=$1 AND idempotency_key=$2 AND actor_id=$3',[request,key,actor.id]);
      const removed=await owner.query('DELETE FROM public.products WHERE id=$1 AND legacy_key=$2',[product,prefix]);assert.equal(removed.rowCount,1);await owner.query('COMMIT');
      report.afterCounts=await counts();assert.deepEqual(report.afterCounts,report.beforeCounts);report.cleanup='PASS_EXACT_FIXTURES_COUNTS_RESTORED';
    }
    await owner.end();await a.end();
  }
}
main().catch(e=>{report.status='FAIL';report.safeCode=sanitizedDatabaseError(e);process.exitCode=1;}).finally(()=>{report.finishedAtUtc=new Date().toISOString();fs.writeFileSync(path.join(root,'docs/phase3/CONCURRENCY_LIVE_RESULT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,tests:report.tests.length,cleanup:report.cleanup,safeCode:report.safeCode}));});
// truonglt Phase3.1 actual multi-session runtime races with guarded synthetic cleanup end
