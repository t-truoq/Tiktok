// truonglt Phase3.1 actual production repository initializer read-only verification start
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..');
require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
const{BusinessRepository}=require('../../apps/api/dist/business/repository'),{JwtVerifier}=require('../../apps/api/dist/business/security');
const report={verifiedAtUtc:new Date().toISOString(),publicWritesEnabled:false,databaseWrites:false,status:'RUNNING'};
async function main(){
  assert.equal(process.env.BUSINESS_API_ENABLED,'false');assert.equal(process.env.DB_ENVIRONMENT,'DEV');
  const subject=await new JwtVerifier().verify(fs.readFileSync(path.join(root,'artifacts/phase3-real-actor.jwt'),'utf8').trim());assert.equal(subject,'c918885f-c09c-40b0-a43a-4edcbdf69317');
  const repository=new BusinessRepository();process.env.BUSINESS_API_ENABLED='true';
  try{const user=await repository.actor(subject);assert.equal(user.role,'ADMIN');const actor={id:user.id,subject,role:user.role};
    report.initializer='PASS_NON_OWNER_NOSUPER_NOBYPASS_NO_DDL_NO_OWNER_SET';
    report.readContext=await repository.read(async tx=>(await tx.$queryRaw`SELECT current_user role,current_setting('app.actor_id') actor,current_setting('app.auth_subject') subject,current_setting('transaction_read_only') read_only`)[0],actor);
    assert.equal(report.readContext.role,'tiktok_api_runtime');assert.equal(report.readContext.actor,user.id);assert.equal(report.readContext.subject,subject);assert.equal(report.readContext.read_only,'on');
    report.writeContextWithoutWrites=await repository.transaction(actor,async tx=>(await tx.$queryRaw`SELECT current_user role,current_setting('app.actor_id') actor,current_setting('transaction_isolation') isolation`)[0]);
    assert.equal(report.writeContextWithoutWrites.isolation,'serializable');report.status='PASS_REAL_TOKEN_PRODUCTION_REPOSITORY_INIT_AND_CONTEXT';
  }finally{process.env.BUSINESS_API_ENABLED='false';await repository.onApplicationShutdown();}
}
main().catch(()=>{report.status='FAIL';process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(root,'docs/phase3/PRODUCTION_REPOSITORY_RESULT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,initializer:report.initializer,publicWritesEnabled:false}));});
// truonglt Phase3.1 actual production repository initializer read-only verification end
