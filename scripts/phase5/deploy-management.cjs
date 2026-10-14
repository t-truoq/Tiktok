// truonglt owner-approved management migration deployment start
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{Client}=require('pg');
const root=path.resolve(__dirname,'../..');require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
const {databaseConnectionOptions,sanitizedDatabaseError}=require('../../apps/api/dist/database');
const pins={'20261014063000_preserve_source_baseline':'148e77f65ba5c08720afddc569e3535512017b3257a1384ba39cdb7c5cb37c93','20261014083000_runtime_security':'3916a0baca77cd2be19531165d24315d251aae732b54df3437a7a13e561f3a0b','20261015010000_manual_product_origin':'3869a7bd46007521f28f74d8bce06495330807ca9d85e017989d6e5c4dbb95d1','20261015010100_manual_product_image_permissions':'0779fa7c42f0f091389865c47d07e7d4b6d233e84bf31be8b5b5832f716c1451'};
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const output=path.join(root,'docs/phase5/MANAGEMENT_MIGRATION_RESULT.json');
const report={project:'nqdaykgasfnsaixkhbya',startedAtUtc:new Date().toISOString(),status:'NOT_APPLIED',checksums:pins,managedSchemasChanged:false};
async function inspect(){const c=new Client({...databaseConnectionOptions(process.env.DIRECT_URL),connectionTimeoutMillis:10000});await c.connect();try{
  await c.query('BEGIN READ ONLY');const migrations=(await c.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY started_at')).rows;
  assert(migrations.every(m=>m.finished_at&&!m.rolled_back_at&&pins[m.migration_name]===m.checksum));
  const counts=(await c.query('SELECT (SELECT count(*)::int FROM products) products,(SELECT count(*)::int FROM product_history WHERE import_batch_id IS NOT NULL) source_events,(SELECT count(*)::int FROM stage_snapshots WHERE import_batch_id IS NOT NULL) source_snapshots')).rows[0];
  assert.equal(counts.products,46);assert.equal(counts.source_events,1224);assert.equal(counts.source_snapshots,133);
  const roles=(await c.query("SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname='tiktok_api_runtime'")).rows;assert.equal(roles.length,1);assert(!roles[0].rolsuper&&!roles[0].rolbypassrls&&!roles[0].rolcreaterole&&!roles[0].rolcreatedb);
  const policies=(await c.query("SELECT policyname,tablename,cmd FROM pg_policies WHERE schemaname='public' AND policyname IN ('runtime_manual_product_create','runtime_product_image_append') ORDER BY policyname")).rows;
  const privileges=(await c.query("SELECT has_table_privilege('tiktok_api_runtime','public.products','INSERT') product_insert,has_table_privilege('tiktok_api_runtime','public.product_images','INSERT') image_insert,has_table_privilege('tiktok_api_runtime','public.product_images','DELETE') image_delete,has_table_privilege('tiktok_api_runtime','public.products','DELETE') product_delete,has_schema_privilege('tiktok_api_runtime','public','CREATE') ddl")).rows[0];
  await c.query('ROLLBACK');return {migrations,counts,roles,policies,privileges,tlsVerified:true};
}finally{await c.end();}}
async function main(){assert.equal(process.argv[2],'--owner-management-approved');assert(!fs.existsSync(output),'ALREADY_ATTEMPTED_STOP');
  for(const [name,pin]of Object.entries(pins))assert.equal(hash(fs.readFileSync(path.join(root,'apps/api/prisma/migrations',name,'migration.sql'))),pin);
  const u=new URL(process.env.DIRECT_URL);assert.equal(process.env.DB_ENVIRONMENT,'DEV');assert.equal(u.username,'postgres.nqdaykgasfnsaixkhbya');assert.equal(u.hostname,'aws-0-ap-northeast-2.pooler.supabase.com');assert.equal(u.port,'5432');assert.equal(u.pathname,'/postgres');
  report.before=await inspect();assert.equal(report.before.migrations.length,2);
  u.searchParams.set('sslmode','require');u.searchParams.set('sslaccept','strict');u.searchParams.set('sslcert',path.resolve(process.env.DATABASE_CA_CERT_PATH).replace(/\\/g,'/'));
  const redact=s=>{let v=String(s||'').replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[REDACTED_DATABASE_URL]');for(const x of [u.password,decodeURIComponent(u.password)])if(x)v=v.split(x).join('[REDACTED]');return v;};
  report.status='ATTEMPT_STARTED';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  try{const stdout=execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--config','apps/api/prisma.config.ts'],{cwd:root,env:{...process.env,DIRECT_URL:u.toString()},encoding:'utf8',timeout:120000,stdio:['ignore','pipe','pipe']});fs.writeFileSync(path.join(root,'docs/phase5/MANAGEMENT_MIGRATION_LOG.txt'),redact(stdout));}
  catch(e){fs.writeFileSync(path.join(root,'docs/phase5/MANAGEMENT_MIGRATION_LOG.txt'),redact(String(e.stdout||'')+'\n'+String(e.stderr||'')));report.status='FAILED_STOPPED_NO_RESOLVE';throw e;}
  report.status='APPLIED_REQUIRES_VERIFICATION';report.after=await inspect();assert.equal(report.after.migrations.length,4);assert.equal(report.after.policies.length,2);assert(report.after.privileges.product_insert&&report.after.privileges.image_insert);assert(!report.after.privileges.image_delete&&!report.after.privileges.product_delete&&!report.after.privileges.ddl);report.status='APPLIED_VERIFIED';
}
main().catch(e=>{report.safeCode=sanitizedDatabaseError(e);process.exitCode=1;}).finally(()=>{report.finishedAtUtc=new Date().toISOString();fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,safeCode:report.safeCode,counts:report.after?.counts,privileges:report.after?.privileges}));});
// truonglt owner-approved management migration deployment end
