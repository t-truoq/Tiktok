// truonglt Phase4 real JWT read-only HTTP verification with zero database writes start
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..');
const report={verifiedAtUtc:new Date().toISOString(),databaseWrites:false,historyImported:false,tests:[],status:'RUNNING'};
async function main(){
  require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
  const remote=process.argv.includes('--render');report.target=remote?'RENDER':'LOCAL_PRODUCTION_APP';
  const token=fs.readFileSync(path.join(root,'artifacts/phase3-real-actor.jwt'),'utf8').trim();
  const{JwtVerifier}=require('../../apps/api/dist/business/security');await new JwtVerifier().verify(token);
  let app;let base='https://tiktok-6kwu.onrender.com';
  try{
    if(!remote){process.env.BUSINESS_API_ENABLED='true';process.env.BUSINESS_WRITE_ENABLED='false';process.env.NODE_ENV='production';
      app=await require('../../apps/api/dist/app').createApp();await app.listen(0,'127.0.0.1');base=await app.getUrl();}
    const headers={Authorization:'Bearer '+token};
    async function check(p,status,auth=true,method='GET'){
      const r=await fetch(base+'/api/v1'+p,{method,headers:auth?headers:undefined,signal:AbortSignal.timeout(20000)});const body=await r.json();
      report.tests.push({path:p,method,authenticated:auth,httpStatus:r.status,expectedStatus:status,revision:r.headers.get('x-backend-revision'),businessMode:r.headers.get('x-business-mode')});
      assert.equal(r.status,status);return body;
    }
    await check('/health/live',200,false);const ready=await check('/health/ready',200,false);assert.equal(ready.tls,true);assert.equal(ready.timezone,'UTC');
    await check('/products',401,false);const list=await check('/products?limit=10',200);assert(Array.isArray(list.items));
    const summary=await check('/finance/summary',200);assert.equal(typeof summary.paid,'string');
    await check('/source-archives',200);await check('/import-batches',200);
    const id='00000000-0000-4000-8000-000000000000';
    for(const resource of ['', '/rounds','/sales','/stages','/history','/snapshots'])await check('/products/'+id+resource,404);
    const blocked=await check('/products/'+id+'/mutations',403,true,'POST');assert.equal(blocked.code,'BUSINESS_WRITES_DISABLED');
    report.status='PASS_REAL_JWT_READ_ONLY_HTTP';report.sourceDataPresent=list.total>0;
    if(remote){const expected=process.env.EXPECTED_RENDER_REVISION;const revisions=report.tests.map(t=>t.revision);
      report.revisionVerified=!!expected&&revisions.every(r=>r===expected);if(!report.revisionVerified)report.status='HTTP_PASS_REVISION_UNVERIFIED';
      assert(report.tests.every(t=>t.businessMode==='read-only'),'RENDER_NOT_READ_ONLY');}
  }finally{await app?.close();}
}
main().catch(()=>{report.status='BLOCKED_OR_FAILED_READ_API';process.exitCode=1;}).finally(()=>{
  fs.mkdirSync(path.join(root,'docs/phase4'),{recursive:true});fs.writeFileSync(path.join(root,'docs/phase4',process.argv.includes('--render')?'RENDER_READ_API_RESULT.json':'LOCAL_READ_API_RESULT.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
});
// truonglt Phase4 real JWT read-only HTTP verification with zero database writes end
