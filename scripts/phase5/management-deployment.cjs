// truonglt read-only deployment evidence with optional real owner JWT start
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..');
const expected=process.argv[2];assert(/^[a-f0-9]{40}$/.test(expected));
const report={verifiedAtUtc:new Date().toISOString(),expectedRevision:expected,databaseWrites:false,checks:[],render:'PENDING',vercel:'PENDING'};
const backend='https://tiktok-6kwu.onrender.com',frontend='https://tiktok-six-rho.vercel.app';
async function get(base,p,token){const response=await fetch(base+p,{cache:'no-store',signal:AbortSignal.timeout(20000),headers:token?{Authorization:'Bearer '+token}: {}});const body=await response.json();return {path:p,httpStatus:response.status,revision:response.headers.get('x-backend-revision'),mode:response.headers.get('x-business-mode'),body};}
async function main(){
  for(const p of ['/api/v1/health/live','/api/v1/health/ready','/api/v1/products'])report.checks.push(await get(backend,p));
  report.render=report.checks.every(c=>c.revision===expected&&c.httpStatus===(c.path.includes('/health/')?200:401))?'REVISION_HEALTH_AUTH_PASS':'PENDING_OR_FAILED';
  const home=await fetch(frontend,{signal:AbortSignal.timeout(20000),cache:'no-store'}),html=await home.text();report.frontendHttp=home.status;
  const entry=html.match(/src="(\/assets\/index-[^"]+\.js)"/);let asset;
  if(entry){asset=entry[1];const js=await(await fetch(frontend+asset,{signal:AbortSignal.timeout(20000)})).text();
    const chunks=[...new Set([...js.matchAll(/(?:\.\/|\/assets\/)([^"'\s]+\.js)/g)].map(m=>m[1]).filter(v=>/^(ui|pages|ProductDrawer)-/.test(v)))];
    let newFeature=js.includes('Ảnh chỉ được truy cập sau đăng nhập.');
    for(const chunk of chunks){const content=await(await fetch(frontend+'/assets/'+chunk,{signal:AbortSignal.timeout(20000)})).text();if(content.includes('Ảnh chỉ được truy cập sau đăng nhập.')||content.includes('Số lượt được chọn tự động.'))newFeature=true;}
    // Local build artifacts identify the exact new chunks even when Vite maps imports indirectly.
    if(!newFeature){const directory=path.join(root,'apps/web/dist/assets');for(const name of fs.readdirSync(directory).filter(n=>/^ProductDrawer-.*\.js$/.test(n))){
      const local=fs.readFileSync(path.join(directory,name),'utf8');if(!local.includes('Số lượt được chọn tự động.'))continue;
      const response=await fetch(frontend+'/assets/'+name,{signal:AbortSignal.timeout(20000)});const remote=await response.text();
      if(response.ok&&remote===local){newFeature=true;report.verifiedManagementChunk='/assets/'+name;}
    }}
    report.frontendAsset=asset;report.vercel=home.status===200&&newFeature?'NEW_MANAGEMENT_BUNDLE_PASS':'PENDING_OR_UNCONFIRMED';
  }
  const tokenFile=path.join(root,'artifacts/phase3-real-actor.jwt');if(report.render==='REVISION_HEALTH_AUTH_PASS'&&fs.existsSync(tokenFile)){
    const token=fs.readFileSync(tokenFile,'utf8').trim();const session=await get(frontend,'/api/v1/session',token);
    report.realJwtSession={httpStatus:session.httpStatus,revision:session.revision,canCreate:session.body.canCreate,canUpload:session.body.canUpload};
    if(session.httpStatus===200){const products=await get(frontend,'/api/v1/products?classification=ACTIVE&limit=2',token);report.authenticatedProducts={httpStatus:products.httpStatus,total:products.body.total,parallelRoundsContract:products.body.items?.every(p=>Array.isArray(p.ongoingRounds)&&!!p.suggestedRounds)};
      const summary=await get(frontend,'/api/v1/finance/summary?classification=XLSX_MATCHED',token);report.currentActive24={httpStatus:summary.httpStatus,...summary.body};
      const history=await get(frontend,'/api/v1/history?limit=2',token);report.latestRuntimeEvents=history.body.items?.map(e=>({eventType:e.eventType,stageLabel:e.stageLabel,sourceTimestampText:e.sourceTimestampText,actorRecorded:!!e.actorId,productName:e.product?.rootName}));
      const denied=await get(frontend,'/api/v1/products/00000000-0000-4000-8000-000000000000/images/00000000-0000-4000-8000-000000000000/content');report.anonymousImageHttp=denied.httpStatus;
    }
  }
  report.status=report.render==='REVISION_HEALTH_AUTH_PASS'&&report.vercel==='NEW_MANAGEMENT_BUNDLE_PASS'&&report.realJwtSession?.httpStatus===200&&report.realJwtSession?.canCreate&&report.realJwtSession?.canUpload&&report.authenticatedProducts?.httpStatus===200&&report.anonymousImageHttp===401?'DEPLOYMENT_READ_VERIFIED':'PENDING_OR_PARTIAL';
}
main().catch(()=>{report.status='UNREACHABLE_OR_UNCONFIRMED';}).finally(()=>{
  // Keep mutable operational balances and actor-attributed history out of the public repository.
  fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
  fs.writeFileSync(path.join(root,'artifacts/phase5-management-deployment-private.json'),JSON.stringify(report,null,2)+'\n');
  delete report.currentActive24;delete report.latestRuntimeEvents;
  fs.writeFileSync(path.join(root,'docs/phase5/MANAGEMENT_DEPLOYMENT_RESULT.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,render:report.render,vercel:report.vercel,revision:report.expectedRevision}));
});
// truonglt read-only deployment evidence with optional real owner JWT end
