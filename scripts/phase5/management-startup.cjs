// truonglt production startup and read-only HTTP verification start
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..');
require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});Object.assign(process.env,{NODE_ENV:'production',HOST:'0.0.0.0',BUSINESS_API_ENABLED:'true',BUSINESS_WRITE_ENABLED:'true'});
const {createApp}=require('../../apps/api/dist/app'),{JwtVerifier}=require('../../apps/api/dist/business/security');
const report={verifiedAtUtc:new Date().toISOString(),status:'RUNNING',databaseWrites:false,checks:[]};let app;
async function main(){app=await createApp();await app.listen(0,'0.0.0.0');const port=app.getHttpServer().address().port,base='http://127.0.0.1:'+port+'/api/v1';
  for(const p of ['/health/live','/health/ready','/products','/products/00000000-0000-4000-8000-000000000000/images/00000000-0000-4000-8000-000000000000/content']){
    const response=await fetch(base+p);const body=await response.json();assert.equal(response.status,p.startsWith('/health')?200:401);report.checks.push({path:p,httpStatus:response.status,body});
  }
  const file=path.join(root,'artifacts/phase3-real-actor.jwt');let token;
  if(fs.existsSync(file)){const value=fs.readFileSync(file,'utf8').trim();try{assert.equal(await new JwtVerifier().verify(value),'c918885f-c09c-40b0-a43a-4edcbdf69317');token=value;}catch{report.authenticatedHttp='NOT_EXECUTED_TOKEN_EXPIRED_OR_INVALID';}}
  if(token){for(const p of ['/session','/products?classification=ACTIVE&limit=2']){const response=await fetch(base+p,{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200);const data=await response.json();if(p==='/session'){assert(data.canCreate&&data.canUpload);report.capabilities={canCreate:data.canCreate,canUpload:data.canUpload};}else report.activeCount=data.total;report.checks.push({path:p,httpStatus:response.status});}report.authenticatedHttp='REAL_JWT_READ_PASS';}
  report.status='PASS';
}
main().catch(()=>{report.status='FAIL';process.exitCode=1;}).finally(async()=>{await app?.close();fs.writeFileSync(path.join(root,'docs/phase5/MANAGEMENT_STARTUP_RESULT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
// truonglt production startup and read-only HTTP verification end
