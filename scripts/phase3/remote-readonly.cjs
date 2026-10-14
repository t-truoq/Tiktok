// truonglt Phase3 read-only auth infrastructure and staging checks start
const fs=require('node:fs');const path=require('node:path');
const report={verifiedAtUtc:new Date().toISOString(),phase3Deployed:false,databaseWrites:false,checks:[]};
async function main(){
  const urls=[['jwks','https://nqdaykgasfnsaixkhbya.supabase.co/auth/v1/.well-known/jwks.json'],
    ['staging-live','https://tiktok-6kwu.onrender.com/api/v1/health/live'],['staging-ready','https://tiktok-6kwu.onrender.com/api/v1/health/ready']];
  for(const [name,url] of urls){
    try{const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});const body=await response.json();
      report.checks.push({name,httpStatus:response.status,...(name==='jwks'?{
        publicKeyCount:Array.isArray(body.keys)?body.keys.length:0,algorithms:Array.isArray(body.keys)?[...new Set(body.keys.map(k=>k.alg||k.kty))]:[],
        usableAsymmetricKeys:Array.isArray(body.keys)&&body.keys.some(k=>k.kty==='RSA'||k.kty==='EC'&&k.crv==='P-256')
      }:{body:{status:body.status,database:body.database,tls:body.tls,timezone:body.timezone,tlsProtocol:body.tlsProtocol}})});
    }catch{report.checks.push({name,status:'UNREACHABLE_OR_INVALID_RESPONSE'});}
  }
  if(report.checks.some(c=>c.name==='staging-live'&&c.status)){
    try{const response=await fetch(urls[1][1],{signal:AbortSignal.timeout(20000),redirect:'error'});const body=await response.json();
      report.checks.push({name:'staging-live-retry',httpStatus:response.status,body:{status:body.status}});
    }catch{report.checks.push({name:'staging-live-retry',status:'UNREACHABLE_OR_INVALID_RESPONSE'});}
  }
  fs.writeFileSync(path.resolve(__dirname,'../../docs/phase3/REMOTE_READONLY_RESULT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(()=>{console.error('REMOTE_READONLY_VERIFICATION_FAILED');process.exitCode=1;});
// truonglt Phase3 read-only auth infrastructure and staging checks end
