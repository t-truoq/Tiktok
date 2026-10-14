// truonglt Phase3 exhaustive source inventory and parity evidence start
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const Decimal=require('decimal.js');
const root=path.resolve(__dirname,'../..'), refs=path.join(root,'TikTok_Affiliate_Phase0_References/references');
const {sourceRuntime,oracle,sha,PINNED_SHA256,sourcePath,decodeProperties}=require('../phase0/source-baseline.cjs');
const {calculateFinance}=require('../../apps/api/dist/finance/engine');
const bytes=fs.readFileSync(sourcePath);assert.equal(sha(bytes),PINNED_SHA256);
const source=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));const decoded=decodeProperties(source);assert.equal(decoded.records.length,46);
const input=JSON.parse(fs.readFileSync(path.join(root,'tests/golden/baseline-input.json')));
const expected=JSON.parse(fs.readFileSync(path.join(root,'tests/golden/baseline-expected.json')));
const inventories=expected.sourceAlgorithms.map(item=>{
  const data=fs.readFileSync(path.join(refs,item.filename));assert.equal(sha(data),item.sha256);const text=data.toString('utf8');
  return {filename:item.filename,bytes:data.length,sha256:item.sha256,functions:[...text.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)].map(m=>({name:m[1],line:text.slice(0,m.index).split('\n').length}))};
});
const runtimes=expected.sourceAlgorithms.map(x=>sourceRuntime(x.filename)),records=[];
for(const item of input.records){
  const actual=calculateFinance(item.rawRecord);let parity=true;
  for(const runtime of runtimes){const ref=oracle(runtime,item.rawRecord);
    for(const k of ['paid','unpaid','incurred','sampleTotal','endTotal']) assert(new Decimal(actual.payment[k]).eq(ref.payment[k]));
    assert(new Decimal(actual.refund.total).eq(ref.refund.total));assert(new Decimal(actual.projectedProfit).eq(ref.projectedProfit));
    assert.equal(actual.payment.missing,ref.payment.missing);assert.equal(actual.payment.review,ref.payment.review);assert.equal(actual.refund.missing,ref.refund.missing);
    assert.deepEqual(actual.payment.details,ref.payment.details.map(x=>({...x,amount:x.amount===null?null:String(x.amount)})));
  }
  records.push({key:item.key,classification:item.classification,parity:parity?'PASS':'FAIL',payment:actual.payment,refund:actual.refund,projectedProfit:actual.projectedProfit,
    historyEvents:(item.rawRecord.history||[]).length,historySha256:sha(JSON.stringify(item.rawRecord.history||[])),
    snapshots:Object.keys(item.rawRecord.stageData||{}).length,sourceUnmodified:true});
}
const aggregate=classification=>{
  const matched=records.filter(r=>r.classification===classification),fields={paid:new Decimal(0),unpaid:new Decimal(0),refundEligible:new Decimal(0),projectedProfit:new Decimal(0)};
  matched.forEach(r=>{fields.paid=fields.paid.plus(r.payment.paid);fields.unpaid=fields.unpaid.plus(r.payment.unpaid);fields.refundEligible=fields.refundEligible.plus(r.refund.total);fields.projectedProfit=fields.projectedProfit.plus(r.projectedProfit);});
  return {count:matched.length,...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.toString()]))};
};
const report={verifiedAtUtc:new Date().toISOString(),sourceSha256:PINNED_SHA256,sourceRecords:46,sourceHistory:1224,sourceSnapshots:133,
  actualHistory:records.reduce((s,r)=>s+r.historyEvents,0),actualSnapshots:records.reduce((s,r)=>s+r.snapshots,0),importsExecuted:false,
  financialParity:'PASS_ALL_46_PER_RECORD_PER_ROUND_BOTH_SOURCE_VERSIONS',active24:aggregate('XLSX_MATCHED'),legacy22:aggregate('LEGACY_UNMATCHED'),sourceInventories:inventories,records};
assert.equal(report.actualHistory,1224);assert.equal(report.actualSnapshots,133);assert.equal(sha(fs.readFileSync(sourcePath)),PINNED_SHA256);
fs.writeFileSync(path.join(root,'docs/phase3/PARITY_RESULT.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({financialParity:report.financialParity,active24:report.active24,records:46,history:report.actualHistory,snapshots:report.actualSnapshots}));
// truonglt Phase3 exhaustive source inventory and parity evidence end
