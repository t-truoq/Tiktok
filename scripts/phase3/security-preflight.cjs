// truonglt Phase3.1 readonly catalog and security migration preflight start
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {Client}=require('pg');const root=path.resolve(__dirname,'../..');
require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
const {databaseConnectionOptions,sanitizedDatabaseError}=require('../../apps/api/dist/database');
const baseline=fs.readFileSync(path.join(root,'apps/api/prisma/migrations/20261014063000_preserve_source_baseline/migration.sql'),'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const report={verifiedAtUtc:new Date().toISOString(),project:'nqdaykgasfnsaixkhbya',status:'RUNNING',schemaWrites:false};
async function main(){
  assert.equal(hash(baseline),'148e77f65ba5c08720afddc569e3535512017b3257a1384ba39cdb7c5cb37c93');
  const u=new URL(process.env.DIRECT_URL);assert.equal(process.env.DB_ENVIRONMENT,'DEV');assert.equal(u.username,'postgres.nqdaykgasfnsaixkhbya');assert.equal(u.hostname,'aws-0-ap-northeast-2.pooler.supabase.com');assert.equal(u.port,'5432');assert.equal(u.pathname,'/postgres');
  const c=new Client({...databaseConnectionOptions(process.env.DIRECT_URL),connectionTimeoutMillis:10000});await c.connect();
  try{await c.query('BEGIN READ ONLY');
    for(const [key,sql] of Object.entries({
      server:"SELECT current_setting('server_version_num')::int version, current_setting('TimeZone') timezone",
      authorizedAuthIdentity:"SELECT id::text id FROM auth.users WHERE id='c918885f-c09c-40b0-a43a-4edcbdf69317'::uuid",
      roles:"SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolcanlogin FROM pg_roles WHERE rolname=current_user OR rolname IN ('tiktok_api_access','tiktok_api_runtime')",
      tables:"SELECT c.relname,c.relrowsecurity,pg_get_userbyid(c.relowner) owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname",
      columns:"SELECT table_name,column_name,data_type,udt_name,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
      constraints:"SELECT conname,contype,convalidated,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname",
      indexes:"SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
      triggers:"SELECT tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) ORDER BY tgname",
      enums:"SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace ORDER BY t.typname,e.enumsortorder",
      policies:"SELECT tablename,policyname,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname",
      migrations:"SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY started_at",
      sequences:"SELECT sequencename FROM pg_sequences WHERE schemaname='public'"
    }))report[key]=(await c.query(sql)).rows;
    const business=report.tables.filter(t=>t.relname!=='_prisma_migrations');assert.equal(business.length,13);assert(business.every(t=>t.relrowsecurity));assert.equal(report.triggers.length,10);
    const expected=[...new Set([...baseline.matchAll(/CONSTRAINT "([^"]+)"/g)].map(m=>m[1]))];assert(expected.every(n=>report.constraints.some(c=>c.conname===n&&c.convalidated)));
    assert([...baseline.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g)].every(m=>report.indexes.some(i=>i.indexname===m[1])));
    assert(report.migrations.some(m=>m.migration_name==='20261014063000_preserve_source_baseline'&&m.checksum===hash(baseline)&&m.finished_at&&!m.rolled_back_at));
    report.counts={};for(const t of business)report.counts[t.relname]=(await c.query('SELECT count(*)::int n FROM public."'+t.relname+'"')).rows[0].n;
    assert(Object.values(report.counts).every(x=>x===0));report.status='PASS';await c.query('ROLLBACK');
  }finally{await c.end();}
}
main().catch(e=>{report.status='FAIL';report.safeCode=sanitizedDatabaseError(e);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(root,'docs/phase3/SECURITY_PREFLIGHT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,tables:report.tables?.length,server:report.server,authorizedAuthIdentityExists:report.authorizedAuthIdentity?.length===1,roles:report.roles?.map(x=>({name:x.rolname,createRole:x.rolcreaterole})),sequences:report.sequences?.length,safeCode:report.safeCode}));});
// truonglt Phase3.1 readonly catalog and security migration preflight end
