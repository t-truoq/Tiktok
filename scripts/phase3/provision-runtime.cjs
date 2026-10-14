// truonglt Phase3.1 authorized secret-only LOGIN and real business actor provisioning start
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');const {Client}=require('pg');const root=path.resolve(__dirname,'../..');
require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
const {databaseConnectionOptions,sanitizedDatabaseError}=require('../../apps/api/dist/database');
const subject='c918885f-c09c-40b0-a43a-4edcbdf69317';
const secretPath=path.join(root,'artifacts/runtime-db-secret.json');
const report={startedAtUtc:new Date().toISOString(),project:'nqdaykgasfnsaixkhbya',status:'RUNNING',publicWritesEnabled:false,realAuthSubject:subject,authUsersCreated:false};
function protect(file){
  if(process.platform==='win32'){
    const who=spawnSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true});const sid=who.stdout?.match(/S-1-5-[0-9-]+/)?.[0];assert(sid,'SECRET_ACL_IDENTITY_UNAVAILABLE');
    const acl=spawnSync('icacls',[file,'/inheritance:r','/grant:r','*'+sid+':(F)','*S-1-5-18:(F)'],{stdio:'pipe',windowsHide:true});assert.equal(acl.status,0,'SECRET_ACL_FAILED');
  }else fs.chmodSync(file,0o600);
}
async function main(){
  assert.equal(process.argv[2],'--owner-runtime-and-real-admin-approved');assert.equal(process.env.DB_ENVIRONMENT,'DEV');
  const owner=new URL(process.env.DIRECT_URL);assert.equal(owner.username,'postgres.nqdaykgasfnsaixkhbya');assert.equal(owner.hostname,'aws-0-ap-northeast-2.pooler.supabase.com');assert.equal(owner.port,'5432');
  const c=new Client({...databaseConnectionOptions(process.env.DIRECT_URL),connectionTimeoutMillis:10000});await c.connect();
  let secret;
  try{
    const migration=(await c.query("SELECT checksum,finished_at,rolled_back_at FROM public._prisma_migrations WHERE migration_name='20261014083000_runtime_security'")).rows;
    assert.equal(migration.length,1);assert.equal(migration[0].checksum,'3916a0baca77cd2be19531165d24315d251aae732b54df3437a7a13e561f3a0b');assert(migration[0].finished_at&&!migration[0].rolled_back_at);
    const policies=(await c.query("SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname")).rows;
    assert.equal(policies.length,22);report.policyCount=policies.length;
    const roles=(await c.query("SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolcanlogin FROM pg_roles WHERE rolname IN ('tiktok_api_access','tiktok_api_runtime') ORDER BY rolname")).rows;
    assert.equal(roles.length,2);assert(roles.every(r=>!r.rolsuper&&!r.rolbypassrls&&!r.rolcreaterole&&!r.rolcreatedb));report.roles=roles;
    assert.equal((await c.query('SELECT id FROM auth.users WHERE id=$1::uuid',[subject])).rowCount,1,'AUTHORIZED_AUTH_IDENTITY_NOT_FOUND');
    if(fs.existsSync(secretPath)){secret=JSON.parse(fs.readFileSync(secretPath));assert.equal(new URL(secret.runtimeUrl).username,'tiktok_api_runtime.nqdaykgasfnsaixkhbya');}
    else{const password=crypto.randomBytes(32).toString('base64url'),url=new URL(owner);url.username='tiktok_api_runtime.nqdaykgasfnsaixkhbya';url.password=password;url.searchParams.set('sslmode','verify-full');
      secret={runtimeUrl:url.toString()};fs.mkdirSync(path.dirname(secretPath),{recursive:true});fs.writeFileSync(secretPath,JSON.stringify(secret)+'\n',{flag:'wx',mode:0o600});protect(secretPath);}
    const password=decodeURIComponent(new URL(secret.runtimeUrl).password);assert(/^[A-Za-z0-9_-]{43}$/.test(password));
    // Random restricted alphabet; utility statements cannot bind PASSWORD parameters.
    await c.query("ALTER ROLE tiktok_api_runtime LOGIN PASSWORD '"+password+"'");
    await c.query('BEGIN');
    const existing=(await c.query('SELECT id,role FROM public.users WHERE auth_subject=$1',[subject])).rows;
    if(existing.length){assert.equal(existing[0].role,'ADMIN','EXISTING_ROLE_REQUIRES_REVIEW');report.businessActorId=existing[0].id;}
    else{await c.query('INSERT INTO public.users(id,auth_subject,role,updated_at) VALUES($1::uuid,$1,\'ADMIN\',now())',[subject]);report.businessActorId=subject;}
    await c.query('COMMIT');report.authorizedBusinessActor='PROVISIONED_REAL_ADMIN';
  }finally{await c.end();}
  const runtime=new Client({...databaseConnectionOptions(secret.runtimeUrl),connectionTimeoutMillis:10000});await runtime.connect();
  try{
    const socket=runtime.connection.stream;assert(socket.encrypted&&socket.authorized);report.tls={verified:true,protocol:socket.getProtocol(),hostnameVerification:true};
    report.identity=(await runtime.query("SELECT current_user role,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,has_schema_privilege(current_user,'public','CREATE') can_create FROM pg_roles r WHERE r.rolname=current_user")).rows[0];
    assert.equal(report.identity.role,'tiktok_api_runtime');assert(!report.identity.can_create);
    assert.equal((await runtime.query('SELECT id FROM public.users')).rowCount,0,'UNBOUND_USER_READ_NOT_DENIED');
    await runtime.query('BEGIN READ ONLY');await runtime.query("SELECT set_config('app.auth_subject',$1,true)",[subject]);
    assert.equal((await runtime.query('SELECT id,role FROM public.users WHERE auth_subject=$1',[subject])).rowCount,1);await runtime.query('ROLLBACK');
    report.login='PASS_SESSION_POOLER';
  }finally{await runtime.end();}
  const runtimeEnv=path.join(root,'apps/api/.env.runtime');fs.writeFileSync(runtimeEnv,'RUNTIME_DATABASE_URL='+JSON.stringify(secret.runtimeUrl)+'\nBUSINESS_API_ENABLED=false\n',{mode:0o600});protect(runtimeEnv);
  const envPath=path.join(root,'apps/api/.env');let text=fs.readFileSync(envPath,'utf8');
  for(const [key,value]of Object.entries({RUNTIME_DATABASE_URL:secret.runtimeUrl,BUSINESS_API_ENABLED:'false'})){
    text=text.replace(new RegExp('^'+key+'=.*(?:\\r?\\n|$)','gm'),'');text+='\n'+key+'='+JSON.stringify(value)+'\n';
  }
  fs.writeFileSync(envPath,text);protect(envPath);report.secretStorage='IGNORED_LOCAL_FILES_USER_AND_SYSTEM_ACL';report.status='PASS_LOGIN_ACTOR_PROVISIONED_REAL_JWT_PENDING';
}
main().catch(e=>{report.status='FAILED_STOPPED';report.safeCode=sanitizedDatabaseError(e);process.exitCode=1;}).finally(()=>{
  report.finishedAtUtc=new Date().toISOString();fs.writeFileSync(path.join(root,'docs/phase3/RUNTIME_PROVISION_RESULT.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,login:report.login,publicWritesEnabled:false,actor:report.authorizedBusinessActor,policyCount:report.policyCount,safeCode:report.safeCode}));
});
// truonglt Phase3.1 authorized secret-only LOGIN and real business actor provisioning end
