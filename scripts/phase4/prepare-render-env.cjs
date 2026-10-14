// truonglt Phase4 secret-only Render read-runtime handoff preparation start
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
const runtime=process.env.RUNTIME_DATABASE_URL;const url=new URL(runtime);assert.equal(url.username,'tiktok_api_runtime.nqdaykgasfnsaixkhbya');
assert.equal(url.hostname,'aws-0-ap-northeast-2.pooler.supabase.com');assert.equal(url.port,'5432');
const file=path.join(root,'artifacts/phase4-render.env');fs.mkdirSync(path.dirname(file),{recursive:true});
// Stage credentials safely while old revisions may still be deployed; enable reads only after Phase4 revision evidence.
const values={NODE_VERSION:'24.21.0',NODE_ENV:'production',HOST:'0.0.0.0',DB_ENVIRONMENT:'DEV',BUSINESS_API_ENABLED:'false',BUSINESS_WRITE_ENABLED:'false',
  DATABASE_URL:runtime,RUNTIME_DATABASE_URL:runtime,DATABASE_CA_CERT_PATH:'/etc/secrets/supabase-ca.crt',SUPABASE_URL:'https://nqdaykgasfnsaixkhbya.supabase.co',
  SUPABASE_JWKS_URL:'https://nqdaykgasfnsaixkhbya.supabase.co/auth/v1/.well-known/jwks.json'};
fs.writeFileSync(file,Object.entries(values).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{mode:0o600});
if(process.platform==='win32'){
  const who=spawnSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true});const sid=who.stdout?.match(/S-1-5-[0-9-]+/)?.[0];assert(sid);
  const acl=spawnSync('icacls',[file,'/inheritance:r','/grant:r','*'+sid+':(F)','*S-1-5-18:(F)'],{stdio:'pipe',windowsHide:true});assert.equal(acl.status,0);
}else fs.chmodSync(file,0o600);
console.log(JSON.stringify({status:'PREPARED_IGNORED_ACL_PROTECTED',file:'artifacts/phase4-render.env',secretValuesPrinted:false,publicWritesEnabled:false,
  importConfigured:false,ownerDatabaseCredentialsIncluded:false,corsConfigured:false,readActivation:'SET_TRUE_ONLY_AFTER_PHASE4_REVISION_VERIFIED'}));
// truonglt Phase4 secret-only Render read-runtime handoff preparation end
