// truonglt Phase3.1 production business route fail-closed test start
const{test}=require('node:test'),assert=require('node:assert/strict');
test('disabled business module registers no read/write routes while live health stays200',async()=>{
  const before=process.env.BUSINESS_API_ENABLED;process.env.BUSINESS_API_ENABLED='false';const{createApp}=require('../dist/app');const app=await createApp();
  try{await app.listen(0,'127.0.0.1');const url=await app.getUrl();assert.equal((await fetch(url+'/api/v1/health/live')).status,200);
    assert.equal((await fetch(url+'/api/v1/products')).status,404);
    assert.equal((await fetch(url+'/api/v1/products/f4c0d90e-a788-4f3f-90cf-eced7be0426d/mutations',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);
  }finally{await app.close();if(before===undefined)delete process.env.BUSINESS_API_ENABLED;else process.env.BUSINESS_API_ENABLED=before;}
});
// truonglt Phase3.1 production business route fail-closed test end
