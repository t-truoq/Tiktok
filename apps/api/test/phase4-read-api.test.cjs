// truonglt Phase4 authenticated read resources and independently blocked writes HTTP tests start
const{test}=require('node:test'),assert=require('node:assert/strict'),{generateKeyPairSync,sign}=require('node:crypto');
require('reflect-metadata');const{Module}=require('@nestjs/common'),{NestFactory}=require('@nestjs/core');
const{BusinessController}=require('../dist/business/controller'),{BusinessGuard}=require('../dist/business/security'),{BusinessService}=require('../dist/business/service'),{BusinessRepository}=require('../dist/business/repository');
test('read-only HTTP authenticates read resources, serializes Decimal/BIGINT and blocks ADMIN write before transaction',async()=>{
  const{privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const subject='c918885f-c09c-40b0-a43a-4edcbdf69317',id='00000000-0000-4000-8000-000000000001';
  const h=Buffer.from(JSON.stringify({alg:'ES256',kid:'phase4-unit'})).toString('base64url'),p=Buffer.from(JSON.stringify({iss:'https://nqdaykgasfnsaixkhbya.supabase.co/auth/v1',aud:'authenticated',role:'authenticated',sub:subject,exp:Math.floor(Date.now()/1000)+60})).toString('base64url');
  const token=h+'.'+p+'.'+sign('sha256',Buffer.from(h+'.'+p),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const original=global.fetch,old=process.env.BUSINESS_WRITE_ENABLED;delete process.env.BUSINESS_WRITE_ENABLED;
  global.fetch=async(u,o)=>String(u).endsWith('/.well-known/jwks.json')?{ok:true,json:async()=>({keys:[{...publicKey.export({format:'jwk'}),kid:'phase4-unit',alg:'ES256',use:'sig'}]})}:original(u,o);
  let transactions=0;const seen=[];const row={id,rootName:'Synthetic read',sourceFieldStates:{},rounds:[],legacyRecords:[],currentStageIndex:3n};
  const readModel=name=>({count:async()=>1,findMany:async args=>{seen.push({name,args});return name==='salesDetail'?[{id,unitPrice:'12.34',soldQuantity:'2.000',round:{group:'END',roundIndex:3n}}]:[{id,sourceLabel:'Done'}];}});
  const repository={actor:async()=>({id:subject,authSubject:subject,role:'ADMIN'}),read:async fn=>fn({product:{findUnique:async()=>row},salesDetail:readModel('salesDetail'),stageSnapshot:readModel('stageSnapshot')}),transaction:async()=>{transactions++;throw Error('MUST_NOT_WRITE');}};
  class TestModule{};Module({controllers:[BusinessController],providers:[BusinessGuard,BusinessService,{provide:BusinessRepository,useValue:repository}]})(TestModule);
  const app=await NestFactory.create(TestModule,{logger:false});app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=await app.getUrl(),headers={Authorization:'Bearer '+token};
  try{
    const anonymous=await original(base+'/api/v1/products/'+id+'/sales');assert.equal(anonymous.status,401);
    const detail=await original(base+'/api/v1/products/'+id,{headers});assert.equal(detail.status,200);assert.equal((await detail.json()).currentStageIndex,'3');
    const sales=await original(base+'/api/v1/products/'+id+'/sales',{headers});assert.equal(sales.status,200);const s=await sales.json();assert.equal(s.items[0].round.roundIndex,'3');assert.equal(s.items[0].unitPrice,'12.34');
    const stages=await original(base+'/api/v1/products/'+id+'/stages?sort=sourceLabel',{headers});assert.equal(stages.status,200);
    assert.deepEqual(seen[0].args.where,{round:{productId:id}});assert.equal(seen[1].name,'stageSnapshot');
    const mutation=await original(base+'/api/v1/products/'+id+'/mutations',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});
    assert.equal(mutation.status,403);assert.equal((await mutation.json()).code,'BUSINESS_WRITES_DISABLED');assert.equal(transactions,0);
  }finally{await app.close();global.fetch=original;if(old===undefined)delete process.env.BUSINESS_WRITE_ENABLED;else process.env.BUSINESS_WRITE_ENABLED=old;}
});
// truonglt Phase4 authenticated read resources and independently blocked writes HTTP tests end
