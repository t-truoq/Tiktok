// truonglt focused regression for newly authorized management features start
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),{applyOperation}=require('../../apps/api/dist/business/operations'),{imageDto,createProductDto}=require('../../apps/api/dist/business/management');
const now=new Date('2026-10-14T17:45:00Z'),fresh={name:'Synthetic only',schemaVersion:'9.1',history:[],stageData:{},purchaseState:{},currentProgress:'',currentDate:'',status:'',note:'',pic:''};
const act=(r,action,group,extra={})=>applyOperation(r,{expectedVersion:1,operation:'ROUND_ACTION',values:{action,group,...extra}},now).record;
const r1=act(fresh,'ORDER_NEXT','SAMPLE',{value:'100'});assert.equal(r1.currentProgress,'Đặt mẫu 1');
const r2=act(r1,'RECEIVE','SAMPLE',{roundIndex:'1'});assert.equal(r2.purchaseState['sample:1'].received,true);
const r3=act(r2,'ORDER_NEXT','SAMPLE',{value:'200'});assert.equal(r3.currentProgress,'Đặt mẫu 2');
const parallel=act(r3,'ORDER_NEXT','END',{value:'300'});assert.equal(parallel.currentProgress,'Đặt End 1');assert.equal(parallel.purchaseState['sample:2'].ordered,true);assert.equal(parallel.purchaseState['end:1'].ordered,true);
const received=act(parallel,'RECEIVE','SAMPLE',{roundIndex:'2'});assert.deepEqual(received.purchaseState['end:1'],parallel.purchaseState['end:1']);assert.equal(received.priceEnd1,'300');assert.equal(received.purchaseState['sample:2'].received,true);
const dynamic=act(received,'ORDER_NEXT','SAMPLE',{value:'0'});assert.equal(dynamic.currentProgress,'Đặt mẫu 3');assert.equal(dynamic.priceMau3,'0');
assert.throws(()=>act(received,'RECEIVE','SAMPLE',{roundIndex:'2'}));assert.throws(()=>act(received,'ORDER_NEXT','SAMPLE',{roundIndex:'1'}));
const date=applyOperation(fresh,{expectedVersion:1,operation:'EDIT_FIELDS',values:{date:'2026-12-31T23:59'}},now);assert.equal(date.record.currentDate,'2026-12-31 23:59:00');
assert.throws(()=>applyOperation(fresh,{expectedVersion:1,operation:'EDIT_FIELDS',values:{date:'2026-02-30T12:00'}},now));
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=';
const photo=imageDto({expectedVersion:1,filename:'pixel.png',contentType:'image/png',data:png});assert(photo.bytes>0);assert.throws(()=>imageDto({expectedVersion:1,filename:'x.svg',contentType:'image/svg+xml',data:Buffer.from('<svg/>').toString('base64')}));
assert.throws(()=>createProductDto({name:'x',classification:'XLSX_MATCHED'}));assert.deepEqual(createProductDto({name:' Test '}),{name:'Test',note:'',pic:''});
const input=JSON.parse(fs.readFileSync(path.join(root,'tests/golden/baseline-input.json'))),expected=JSON.parse(fs.readFileSync(path.join(root,'tests/golden/baseline-expected.json')));
const {calculateFinance}=require('../../apps/api/dist/finance/engine'),{sourceRuntime,oracle,sha,PINNED_SHA256,sourcePath}=require('../phase0/source-baseline.cjs');
assert.equal(sha(fs.readFileSync(sourcePath)),PINNED_SHA256);const algorithms=expected.sourceAlgorithms.map(x=>sourceRuntime(x.filename));
for(const item of input.records){const actual=calculateFinance(item.rawRecord);for(const runtime of algorithms){const reference=oracle(runtime,item.rawRecord);assert.deepEqual(actual.payment.details,reference.payment.details.map(x=>({...x,amount:x.amount===null?null:String(x.amount)})));for(const k of ['paid','unpaid','incurred','sampleTotal','endTotal'])assert.equal(actual.payment[k],String(reference.payment[k]));assert.equal(actual.projectedProfit,String(reference.projectedProfit));assert.equal(actual.refund.total,String(reference.refund.total));}}
const report={verifiedAtUtc:new Date().toISOString(),status:'PASS',newRoundWorkflow:'PASS',parallelSample2End1:'PASS',dynamicRound3AndZero:'PASS',ianaLocalDate:'PASS',privateImageValidation:'PASS',manualDto:'PASS',financialParity:'46/46_BOTH_VERSIONS_PER_ROUND',sourceSha256:sha(fs.readFileSync(sourcePath)),databaseWrites:false,fullOldTestSuiteRepeated:false};
fs.writeFileSync(path.join(root,'docs/phase5/MANAGEMENT_CHECK_RESULT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
// truonglt focused regression for newly authorized management features end
