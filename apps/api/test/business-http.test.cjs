// truonglt Phase3 HTTP authorization and validation integration start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync,sign } = require('node:crypto');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { BusinessController } = require('../dist/business/controller');
const { BusinessGuard } = require('../dist/business/security');
const { BusinessService } = require('../dist/business/service');
const { BusinessRepository } = require('../dist/business/repository');
const { privateKey,publicKey } = generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const jwk={...publicKey.export({format:'jwk'}),kid:'http-test',alg:'ES256',use:'sig'};
function jwt(){const h=Buffer.from(JSON.stringify({alg:'ES256',kid:'http-test'})).toString('base64url');
  const p=Buffer.from(JSON.stringify({iss:'https://nqdaykgasfnsaixkhbya.supabase.co/auth/v1',aud:'authenticated',role:'authenticated',sub:'f4c0d90e-a788-4f3f-90cf-eced7be0426d',exp:Math.floor(Date.now()/1000)+60})).toString('base64url');
  return h+'.'+p+'.'+sign('sha256',Buffer.from(h+'.'+p),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');}
test('HTTP routes enforce auth, VIEWER write denial and strict DTO; no anonymous DB calls',async()=>{
  // truonglt Phase4 explicit local synthetic write-test opt-in start
  const previousWrite=process.env.BUSINESS_WRITE_ENABLED;process.env.BUSINESS_WRITE_ENABLED='true';
  // truonglt Phase4 explicit local synthetic write-test opt-in end
  const originalFetch=global.fetch;let dbCalls=0;let role='VIEWER';
  global.fetch=async(url,options)=>String(url).endsWith('/.well-known/jwks.json')?{ok:true,json:async()=>({keys:[jwk]})}:originalFetch(url,options);
  const repository={actor:async()=>{dbCalls++;return{id:'f4c0d90e-a788-4f3f-90cf-eced7be0426d',authSubject:'f4c0d90e-a788-4f3f-90cf-eced7be0426d',role};},read:async fn=>{
    dbCalls++;return fn({product:{count:async()=>0,findMany:async()=>[]}});},transaction:async()=>{dbCalls++;throw Error('SHOULD_NOT_WRITE');}};
  class TestModule{};Module({controllers:[BusinessController],providers:[BusinessGuard,BusinessService,{provide:BusinessRepository,useValue:repository}]})(TestModule);
  const app=await NestFactory.create(TestModule,{logger:false});app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');
  const url=await app.getUrl(),id='c6fe11fc-ec32-4f47-bbd3-d19c83e86b04';
  try{
    for(const route of ['/products','/finance/summary','/source-archives','/import-batches',`/products/${id}/history`]){
      const response=await originalFetch(url+'/api/v1'+route);assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTH_REQUIRED');}
    const response=await originalFetch(url+'/api/v1/products/'+id+'/mutations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,401);assert.equal(dbCalls,0);
    const headers={Authorization:'Bearer '+jwt(),'Content-Type':'application/json','Idempotency-Key':'synthetic-http-key'};
    const viewer=await originalFetch(url+'/api/v1/products/'+id+'/mutations',{method:'POST',headers,body:'{}'});assert.equal(viewer.status,403);assert.equal((await viewer.json()).code,'FORBIDDEN');
    const list=await originalFetch(url+'/api/v1/products?limit=10',{headers});assert.equal(list.status,200);assert.deepEqual(await list.json(),{page:1,limit:10,total:0,items:[]});
    role='EDITOR';const invalid=await originalFetch(url+'/api/v1/products/'+id+'/mutations',{method:'POST',headers,body:JSON.stringify({operation:'EDIT_BUY',expectedVersion:0,values:{value:'10'}})});
    assert.equal(invalid.status,400);assert.equal((await invalid.json()).code,'INVALID_VERSION');
    const badSort=await originalFetch(url+'/api/v1/products?sort=rawJson',{headers});assert.equal(badSort.status,400);
  }finally{await app.close();global.fetch=originalFetch;
    // truonglt Phase4 restore write flag after local test start
    if(previousWrite===undefined)delete process.env.BUSINESS_WRITE_ENABLED;else process.env.BUSINESS_WRITE_ENABLED=previousWrite;
    // truonglt Phase4 restore write flag after local test end
  }
});
// truonglt Phase3 HTTP authorization and validation integration end
