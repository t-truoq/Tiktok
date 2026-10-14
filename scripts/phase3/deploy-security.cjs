// truonglt Phase3.1 owner-approved single security deployment start
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');const root=path.resolve(__dirname,'../..');
require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
const filename='apps/api/prisma/migrations/20261014083000_runtime_security/migration.sql';
const pin='3916a0baca77cd2be19531165d24315d251aae732b54df3437a7a13e561f3a0b';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(hash(fs.readFileSync(path.join(root,filename))),pin);
assert.equal(hash(fs.readFileSync(path.join(root,'apps/api/prisma/migrations/20261014063000_preserve_source_baseline/migration.sql'))),'148e77f65ba5c08720afddc569e3535512017b3257a1384ba39cdb7c5cb37c93');
assert.equal(process.argv[2],'--owner-phase3-1-approved');
const preflight=JSON.parse(fs.readFileSync(path.join(root,'docs/phase3/SECURITY_PREFLIGHT.json')));
assert.equal(preflight.status,'PASS');assert.equal(preflight.roles.length,1);assert.equal(preflight.policies.length,0);
assert(Date.now()-Date.parse(preflight.verifiedAtUtc)<1800000);
const u=new URL(process.env.DIRECT_URL);assert.equal(process.env.DB_ENVIRONMENT,'DEV');assert.equal(u.username,'postgres.nqdaykgasfnsaixkhbya');assert.equal(u.hostname,'aws-0-ap-northeast-2.pooler.supabase.com');assert.equal(u.port,'5432');assert.equal(u.pathname,'/postgres');
u.searchParams.set('sslmode','require');u.searchParams.set('sslaccept','strict');u.searchParams.set('sslcert',path.resolve(process.env.DATABASE_CA_CERT_PATH).replace(/\\/g,'/'));
const redact=s=>{let value=String(s||'').replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[REDACTED_DATABASE_URL]');for(const secret of[u.password,decodeURIComponent(u.password)])if(secret)value=value.split(secret).join('[REDACTED]');return value;};
const output=path.join(root,'docs/phase3/SECURITY_MIGRATION_RESULT.json');assert(!fs.existsSync(output),'ALREADY_ATTEMPTED_STOP_NO_AUTOMATIC_RETRY');
const report={startedAtUtc:new Date().toISOString(),migration:filename,sha256:pin,project:'nqdaykgasfnsaixkhbya',status:'ATTEMPT_STARTED',attempts:1,sslaccept:'strict',sourceImported:false,managedSchemasChanged:false};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
try{const stdout=execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--config','apps/api/prisma.config.ts'],
  {cwd:root,env:{...process.env,DIRECT_URL:u.toString()},encoding:'utf8',timeout:120000,stdio:['ignore','pipe','pipe']});
  fs.writeFileSync(path.join(root,'docs/phase3/SECURITY_MIGRATION_LOG.txt'),redact(stdout));report.status='APPLIED_REQUIRES_CATALOG_VERIFICATION';console.log(redact(stdout));
}catch(e){report.status='FAILED_STOPPED_NO_RESOLVE';report.exitCode=e.status;fs.writeFileSync(path.join(root,'docs/phase3/SECURITY_MIGRATION_LOG.txt'),redact(String(e.stdout||'')+'\n'+String(e.stderr||'')));process.exitCode=1;}
finally{report.finishedAtUtc=new Date().toISOString();fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
// truonglt Phase3.1 owner-approved single security deployment end
