// truonglt Phase3.1 actual role/RLS/catalog rollback tests start
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Client,Pool}=require('pg');const root=path.resolve(__dirname,'../..');require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
const {databaseConnectionOptions,sanitizedDatabaseError}=require('../../apps/api/dist/database');
const subject='c918885f-c09c-40b0-a43a-4edcbdf69317',uuid=()=>crypto.randomUUID();
const report={startedAtUtc:new Date().toISOString(),status:'RUNNING',evidenceScope:'LIVE_POSTGRESQL_RLS_NOT_REAL_JWT_HTTP',tests:[],authUsersCreated:false,importsExecuted:false};
async function main(){
  assert.equal(process.env.DB_ENVIRONMENT,'DEV');assert.equal(new URL(process.env.DIRECT_URL).username,'postgres.nqdaykgasfnsaixkhbya');
  assert.equal(new URL(process.env.RUNTIME_DATABASE_URL).username,'tiktok_api_runtime.nqdaykgasfnsaixkhbya');
  const owner=new Client(databaseConnectionOptions(process.env.DIRECT_URL)),runtime=new Client(databaseConnectionOptions(process.env.RUNTIME_DATABASE_URL));
  await owner.connect();await runtime.connect();let sequence=0;
  const q=(sql,args)=>owner.query(sql,args);const check=async(name,fn)=>{await fn();report.tests.push({name,status:'PASS'});};
  async function denied(client,name,sql,args){const save='denied_'+(++sequence);await client.query('SAVEPOINT '+save);let code;
    try{await client.query(sql,args);}catch(e){code=e.code;}await client.query('ROLLBACK TO SAVEPOINT '+save);await client.query('RELEASE SAVEPOINT '+save);
    assert.equal(code,'42501',name);report.tests.push({name,status:'PASS',sqlState:code});}
  const prefix='__SYNTHETIC_RLS_'+uuid(),product=uuid(),round=uuid();
  try{
    report.roles=(await q("SELECT rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolcanlogin,rolinherit FROM pg_roles WHERE rolname IN ('tiktok_api_runtime','tiktok_api_access') ORDER BY rolname")).rows;
    report.membership=(await q("SELECT m.inherit_option,m.set_option,m.admin_option FROM pg_auth_members m JOIN pg_roles a ON a.oid=m.roleid JOIN pg_roles b ON b.oid=m.member WHERE a.rolname='tiktok_api_access' AND b.rolname='tiktok_api_runtime'")).rows;
    assert.equal(report.membership.length,1);assert(report.membership[0].inherit_option&&!report.membership[0].set_option&&!report.membership[0].admin_option);
    report.policies=(await q("SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname")).rows;assert.equal(report.policies.length,22);
    const migrations=(await q('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY started_at')).rows;
    assert.equal(migrations.length,2);assert(migrations.every(m=>m.finished_at&&!m.rolled_back_at));assert.equal(migrations[1].checksum,'3916a0baca77cd2be19531165d24315d251aae732b54df3437a7a13e561f3a0b');report.migrations=migrations;
    const preflight=JSON.parse(fs.readFileSync(path.join(root,'docs/phase3/SECURITY_PREFLIGHT.json')));
    report.catalogDiff={};
    for(const[key,sql]of Object.entries({columns:"SELECT table_name,column_name,data_type,udt_name,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
      constraints:"SELECT conname,contype,convalidated,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname",
      indexes:"SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
      triggers:"SELECT tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) ORDER BY tgname"})){
      const current=(await q(sql)).rows;assert.deepEqual(current,preflight[key]);report.catalogDiff[key]='UNCHANGED';
    }
    report.runtimePrivileges=(await runtime.query("SELECT current_user role,has_schema_privilege(current_user,'public','CREATE') ddl,has_database_privilege(current_user,'postgres','CREATE') db_create,(SELECT count(*)::int FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) owned")).rows[0];
    assert.equal(report.runtimePrivileges.role,'tiktok_api_runtime');assert(!report.runtimePrivileges.ddl&&!report.runtimePrivileges.db_create&&report.runtimePrivileges.owned===0);
    const tableNames=preflight.tables.filter(t=>t.relname!=='_prisma_migrations').map(t=>t.relname);
    const counts=async()=>Object.fromEntries(await Promise.all(tableNames.map(async t=>[t,(await q('SELECT count(*)::int n FROM public."'+t+'"')).rows[0].n])));
    report.beforeCounts=await counts();
    await q('BEGIN');await q('GRANT tiktok_api_runtime TO postgres WITH SET TRUE');
    await q("INSERT INTO public.products(id,legacy_key,root_name,root_name_normalized,classification,source_field_states,updated_at) VALUES($1,$2,$2,$2,'LEGACY_UNMATCHED','{}',now())",[product,prefix]);
    const role=async()=>{await q('SET LOCAL ROLE tiktok_api_runtime');assert.equal((await q('SELECT current_user role')).rows[0].role,'tiktok_api_runtime');};
    const context=async(actor,sub)=>q("SELECT set_config('app.actor_id',$1,true),set_config('app.auth_subject',$2,true)",[actor,sub]);
    await role();
    await check('unbound runtime cannot read users or synthetic product',async()=>{await context('','');assert.equal((await q('SELECT id FROM public.users')).rowCount,0);assert.equal((await q('SELECT id FROM public.products WHERE id=$1',[product])).rowCount,0);});
    await check('actor_id mismatch denied even with valid subject',async()=>{await context(uuid(),subject);assert.equal((await q('SELECT id FROM public.products WHERE id=$1',[product])).rowCount,0);});
    await check('subject mismatch denied even with valid actor_id',async()=>{await context(subject,uuid());assert.equal((await q('SELECT id FROM public.products WHERE id=$1',[product])).rowCount,0);});
    await context(subject,subject);
    await check('bound ADMIN reads and updates mutable product column',async()=>{assert.equal((await q('SELECT id FROM public.products WHERE id=$1',[product])).rowCount,1);assert.equal((await q("UPDATE public.products SET note='synthetic' WHERE id=$1",[product])).rowCount,1);});
    await check('bound ADMIN inserts round, history and snapshot',async()=>{
      await q("INSERT INTO public.purchase_rounds(id,product_id,\"group\",round_index,order_price,order_price_state,source_field_states) VALUES($1,$2,'SAMPLE',3,12.34,'NUMBER','{}')",[round,product]);
      await q("INSERT INTO public.product_history(id,product_id,event_type,actor_id,original_payload) VALUES($1,$2,'SYNTHETIC_ROLLBACK',$3,'{}')",[uuid(),product,subject]);
      await q("INSERT INTO public.stage_snapshots(id,product_id,source_label,snapshot) VALUES($1,$2,'Đặt mẫu 3','{}')",[uuid(),product]);
    });
    await denied(owner,'product identity/classification/archive columns cannot be changed',"UPDATE public.products SET root_name='forbidden' WHERE id=$1",[product]);
    await denied(owner,'round identity cannot be reassigned','UPDATE public.purchase_rounds SET round_index=4 WHERE id=$1',[round]);
    await denied(owner,'runtime cannot edit users',"UPDATE public.users SET role='VIEWER' WHERE id=$1",[subject]);
    await denied(owner,'runtime cannot read archive bytes','SELECT original_bytes FROM public.source_archives');
    await denied(owner,'runtime cannot insert source archives',"INSERT INTO public.source_archives(id,filename,sha256,original_bytes,metadata,other_properties) VALUES($1,'synthetic',repeat('0',64),'','{}','{}')",[uuid()]);
    await denied(owner,'runtime cannot update immutable history',"UPDATE public.product_history SET event_type='forbidden' WHERE product_id=$1",[product]);
    await denied(owner,'runtime cannot delete history','DELETE FROM public.product_history WHERE product_id=$1',[product]);
    await denied(owner,'runtime cannot append history as another actor',"INSERT INTO public.product_history(id,product_id,event_type,actor_id) VALUES($1,$2,'forbidden',$3)",[uuid(),product,uuid()]);
    await denied(owner,'runtime cannot append imported snapshots',"INSERT INTO public.stage_snapshots(id,product_id,source_label,snapshot,source_json_pointer) VALUES($1,$2,'forbidden','{}','/source')",[uuid(),product]);
    report.tableDeleteTruncateDenial=[];
    for(const t of tableNames){const privileges=(await q("SELECT has_table_privilege(current_user,$1,'DELETE') d,has_table_privilege(current_user,$1,'TRUNCATE') t",['public.'+t])).rows[0];assert(!privileges.d&&!privileges.t);report.tableDeleteTruncateDenial.push({table:t,delete:false,truncate:false});}
    await q('RESET ROLE');await q("UPDATE public.users SET role='VIEWER' WHERE id=$1",[subject]);await role();await context(subject,subject);
    await check('VIEWER sees data but row policy filters updates',async()=>{assert.equal((await q('SELECT id FROM public.products WHERE id=$1',[product])).rowCount,1);assert.equal((await q("UPDATE public.products SET note='forbidden' WHERE id=$1",[product])).rowCount,0);});
    await denied(owner,'VIEWER cannot insert financial round',"INSERT INTO public.purchase_rounds(id,product_id,\"group\",round_index,order_price_state,source_field_states) VALUES($1,$2,'END',3,'NULL','{}')",[uuid(),product]);
    await q('RESET ROLE');await q("UPDATE public.users SET role='EDITOR' WHERE id=$1",[subject]);await role();await context(subject,subject);
    await check('EDITOR financial updates allowed',async()=>{assert.equal((await q('UPDATE public.purchase_rounds SET received=true WHERE id=$1',[round])).rowCount,1);});
    await q('ROLLBACK');report.afterCounts=await counts();assert.deepEqual(report.afterCounts,report.beforeCounts);
    assert.equal((await q('SELECT role FROM public.users WHERE id=$1',[subject])).rows[0].role,'ADMIN');report.rollback='PASS_COUNTS_AND_REAL_ADMIN_RESTORED';
    await runtime.query('BEGIN');
    await denied(runtime,'LOGIN role cannot SET ROLE postgres','SET LOCAL ROLE postgres');
    await denied(runtime,'LOGIN role cannot SET ROLE privilege role','SET LOCAL ROLE tiktok_api_access');
    await denied(runtime,'LOGIN role cannot create roles','CREATE ROLE phase3_forbidden_role');
    await runtime.query('ROLLBACK');
    const pool=new Pool({...databaseConnectionOptions(process.env.RUNTIME_DATABASE_URL),max:1});
    try{
      const a=await pool.connect();await a.query('BEGIN READ ONLY');await a.query("SELECT set_config('app.actor_id',$1,true),set_config('app.auth_subject',$1,true)",[subject]);await a.query('COMMIT');a.release();
      const b=await pool.connect();const settings=(await b.query("SELECT coalesce(current_setting('app.actor_id',true),'') actor,coalesce(current_setting('app.auth_subject',true),'') subject")).rows[0];
      assert.deepEqual(settings,{actor:'',subject:''});assert.equal((await b.query('SELECT id FROM public.users')).rowCount,0);b.release();
      report.tests.push({name:'transaction-local context does not leak to next pooled borrower',status:'PASS'});
    }finally{await pool.end();}
    report.status='PASS_DATABASE_SECURITY_REAL_ACTOR_HTTP_PENDING';
  }finally{try{await owner.query('ROLLBACK');}catch{}await owner.end();await runtime.end();}
}
main().catch(e=>{report.status='FAIL';report.safeCode=sanitizedDatabaseError(e);process.exitCode=1;}).finally(()=>{report.finishedAtUtc=new Date().toISOString();fs.writeFileSync(path.join(root,'docs/phase3/RLS_LIVE_RESULT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,tests:report.tests.length,rollback:report.rollback,safeCode:report.safeCode}));});
// truonglt Phase3.1 actual role/RLS/catalog rollback tests end
