// truonglt Phase3 business/security reference tests start
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { JwtVerifier } = require('../dist/business/security');
const { assertRuntimeIdentity, BusinessRepository } = require('../dist/business/repository');
const { mutationDto, pagination } = require('../dist/business/contracts');
const { applyOperation } = require('../dist/business/operations');
const { decimalSlot, canonical, BusinessService } = require('../dist/business/service');
const { sourceRuntime } = require('../../../scripts/phase0/source-baseline.cjs');
const now = new Date('2026-10-14T00:00:00Z');
const expectCode = code => error => error.getResponse().code === code;
function base(progress = 'Đặt mẫu 3') { return { schemaVersion: '9.1', name: 'synthetic', currentProgress: progress, stageData: {}, history: [],
  purchaseState: { 'sample:3': { ordered: true, received: false, cancelled: false, verified: false, issue: 'review' } }, priceMau3: '12.34' }; }
function dto(operation, values = {}) { return mutationDto({ operation, expectedVersion: 1, values }); }
for (const filename of ['Tiktok_Affiliate_V9.1_Original_Backup.gs', 'Tiktok_Affiliate_V9.2_Optimized.gs']) {
  for (const [operation, fn] of [['VERIFY_STAGE','verifySelectedAffiliateStage91'], ['CORRECT_UNRECEIVED','markSelectedUnreceived91'],
    ['CANCEL_STAGE','cancelSelectedAffiliateStage91'], ['RESTORE_STAGE','restoreSelectedAffiliateStage91']]) test(`${filename} reference ${operation}`, () => {
    const runtime = sourceRuntime(filename), source = base(); const ref = structuredClone(source);
    runtime.context.changeSelectedStage91 = callback => callback(ref.purchaseState['sample:3'], { r: ref, s: runtime.context.parseAffiliateStage(ref.currentProgress) });
    runtime.context[fn](); runtime.context.syncCurrentOrder91(ref, {progress:ref.currentProgress,price:ref.priceMau3});
    const result = applyOperation(source, dto(operation), now);
    assert.deepEqual(result.record.purchaseState, JSON.parse(JSON.stringify(ref.purchaseState))); assert.equal(result.events[0].type, operation); assert.deepEqual(source, base());
  });
  for (const value of ['', '0', '12.34']) test(`${filename} reference order price ${JSON.stringify(value)}`, () => {
    const runtime = sourceRuntime(filename), source = base(), ref = structuredClone(source);
    runtime.context.getRootName = () => 'synthetic'; runtime.context.getCurrentProgress = () => ref.currentProgress;
    runtime.context.loadRecord = () => ref; runtime.context.saveRecord = () => {};
    const sheet = { getRange: () => ({ getValue: () => value }) }; runtime.context.editBuy91(sheet, 5, 'sample');
    runtime.context.syncCurrentOrder91(ref, {progress:ref.currentProgress,price:ref.priceMau3});
    const result = applyOperation(source, dto('EDIT_BUY', { value }), now);
    assert.equal(result.record.priceMau3, ref.priceMau3 === null ? null : String(ref.priceMau3)); assert.deepEqual(result.record.purchaseState, ref.purchaseState);
  });
}
test('DTO rejects excess fields, invalid versions, pagination and precision loss', () => {
  assert.throws(() => mutationDto({ operation: 'EDIT_FIELDS', expectedVersion: 1, values: {}, role: 'ADMIN' }), expectCode('UNKNOWN_FIELD'));
  assert.throws(() => mutationDto({ operation: 'EDIT_FIELDS', expectedVersion: 0, values: {} }), expectCode('INVALID_VERSION'));
  assert.throws(() => pagination({ limit: '101' }), expectCode('INVALID_PAGINATION'));
  assert.throws(() => decimalSlot('1.234', 2), expectCode('DECIMAL_NOT_REPRESENTABLE'));
  assert.throws(() => decimalSlot('10000000000000000', 2), expectCode('DECIMAL_NOT_REPRESENTABLE'));
  assert.deepEqual([undefined,null,'',0,'0'].map(v => decimalSlot(v,2).state), ['MISSING','NULL','BLANK','NUMBER','TEXT']);
  assert.equal(canonical({z:1,a:2}), canonical({a:2,z:1}));
});
test('onEdit header sync resets received on priced order; missing order review and immutable before', () => {
  const raw = base(); raw.purchaseState['sample:3'].received = true;
  assert.equal(applyOperation(raw,dto('SET_STAGE',{progress:'Đặt mẫu 3'}),now).record.purchaseState['sample:3'].received,false);
  const received = applyOperation(raw,dto('SET_STAGE',{progress:'Nhận End 9'}),now);
  assert.deepEqual(received.record.purchaseState['end:9'], {ordered:true,received:true,cancelled:false,verified:false,issue:'Nhận khi chưa ghi nhận Đặt'});
  assert.deepEqual(received.events.map(e=>e.type),['LEAVE_STAGE','ENTER_STAGE']);
  assert.throws(() => applyOperation(base('Nhận mẫu 3'),dto('EDIT_BUY',{value:'1'}),now),expectCode('BUY_REQUIRES_ORDER_STAGE'));
  assert.throws(() => applyOperation(base('Nhận mẫu 2'),dto('EDIT_SALES',{unitPrice:'1'}),now),expectCode('SALES_REQUIRES_END_STAGE'));
});
test('new stage snapshots retain sheet blanks, Done snapshot and sequenced leave/enter events', () => {
  const start=applyOperation(base(),dto('SET_STAGE',{progress:'Nhận End 3'}),now);
  assert.equal(start.record.stageData['Nhận End 3'].price,''); assert.equal(start.record.stageData['Nhận End 3'].endPrice,'');
  const done=applyOperation(start.record,dto('SET_STAGE',{progress:'Done'}),now);
  assert.equal(done.record.status,'Hoàn tất');assert.equal(done.record.stageData.Done.progress,'Done');
  assert.deepEqual(done.events.map(e=>e.type),['LEAVE_STAGE','ENTER_STAGE']);
  assert.equal(done.events[1].data.progress,'Done');assert.equal(done.events[1].data.price,'');
});
test('grouped edits compose source column order with intermediate audited states',()=>{
  const raw=base('Đặt End 3');raw.purchaseState['end:3']={ordered:true,received:false,verified:true,cancelled:false};raw.priceEnd3='0.02';
  const a=applyOperation(raw,dto('EDIT_SALES',{quantity:'0.2',unitPrice:'0.1'}),now);
  const b=applyOperation(raw,dto('EDIT_SALES',{unitPrice:'0.1',quantity:'0.2'}),now);
  assert.deepEqual(a,b);assert.deepEqual(a.events.map(e=>e.type),['END_SELL_PRICE_EDIT','END_SELL_QTY_EDIT']);
  assert.equal(a.events[0].after.qtySellEnd3,undefined);assert.equal(a.events[1].after.qtySellEnd3,'0.2');
  assert.equal(a.finance.projectedProfit,'0');assert.equal(a.events[1].data.profit,'-0.02');
});
test('owner-confirmed local historical date is interpreted without altering source', () => {
  const raw=base('Nhận mẫu 3');raw.currentDate='2026-10-14 10:46:38';raw.status='historical';
  const result=applyOperation(raw,dto('EDIT_FIELDS',{note:'hết hàng'}),now);assert.match(result.record.status,/Hết hàng • còn/);
  assert.equal(raw.currentDate,'2026-10-14 10:46:38');assert.equal(raw.status,'historical');
});
test('runtime database has no owner fallback and rejects superuser, bypass RLS and table ownership', async () => {
  for (const role of [{rolname:'postgres',rolsuper:false,rolbypassrls:false,owned:0},{rolname:'tiktok_api_runtime',rolsuper:true,rolbypassrls:false,owned:0},
    {rolname:'tiktok_api_runtime',rolsuper:false,rolbypassrls:true,owned:0},{rolname:'tiktok_api_runtime',rolsuper:false,rolbypassrls:false,owned:1}])
    assert.throws(()=>assertRuntimeIdentity(role),expectCode('UNSAFE_RUNTIME_ROLE'));
  const saved = process.env.BUSINESS_API_ENABLED; delete process.env.BUSINESS_API_ENABLED;
  try { await assert.rejects(()=>new BusinessRepository().db(),expectCode('BUSINESS_API_DISABLED')); } finally { if(saved !== undefined) process.env.BUSINESS_API_ENABLED=saved; }
});
test('subresource filters and stable sorting reach repository; unsupported fields rejected', async () => {
  let requested;
  const service = new BusinessService({read:async fn=>fn({product:{findUnique:async()=>({id:'test'})},purchaseRound:{count:async()=>0,findMany:async args=>{requested=args;return[];}}})});
  await service.resource('test','rounds',{group:'END',roundIndex:'9007199254740991',verified:'false',limit:'10',sort:'roundIndex',direction:'desc'});
  assert.deepEqual(requested.where,{productId:'test',group:'END',roundIndex:9007199254740991n,verified:false});
  assert.deepEqual(requested.orderBy,[{roundIndex:'desc'},{id:'asc'}]);
  assert.throws(()=>service.resource('test','rounds',{status:'irrelevant'}),expectCode('UNKNOWN_FIELD'));
});
test('serialization failures from concurrent serializable transaction map to 409', async () => {
  const service=new BusinessService({transaction:async()=>{throw Object.assign(Error('synthetic'),{code:'P2034'});}});
  await assert.rejects(()=>service.mutate('id',dto('CANCEL_STAGE'),{id:'actor',role:'EDITOR',subject:'subject'},'synthetic-conflict'),expectCode('VERSION_CONFLICT'));
});
for (const alg of ['RS256','ES256']) test(`JWT ${alg} validates signed issuer/audience/expiry; rejects tampering and anonymous`, async () => {
  const { privateKey, publicKey } = alg==='RS256' ? generateKeyPairSync('rsa',{modulusLength:2048}) : generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const jwk = {...publicKey.export({format:'jwk'}),kid:'test',alg,use:'sig'};
  const verifier = new JwtVerifier(async()=>({ok:true,json:async()=>({keys:[jwk]})}),()=>now.getTime());
  const token = (changes={}) => {
    const header=Buffer.from(JSON.stringify({alg,kid:'test'})).toString('base64url');
    const body=Buffer.from(JSON.stringify({iss:'https://nqdaykgasfnsaixkhbya.supabase.co/auth/v1',aud:'authenticated',role:'authenticated',sub:'f4c0d90e-a788-4f3f-90cf-eced7be0426d',exp:Math.floor(now.getTime()/1000)+60,...changes})).toString('base64url');
    const signature=sign('sha256',Buffer.from(header+'.'+body),{key:privateKey,...(alg==='ES256'?{dsaEncoding:'ieee-p1363'}:{})}).toString('base64url');
    return header+'.'+body+'.'+signature;
  };
  assert.equal(await verifier.verify(token()),'f4c0d90e-a788-4f3f-90cf-eced7be0426d');
  for(const changes of [{iss:'https://attacker.invalid'},{aud:'other'},{role:'anon'},{exp:0},{nbf:9999999999}]) await assert.rejects(()=>verifier.verify(token(changes)),expectCode('INVALID_TOKEN'));
  const valid=token(),parts=valid.split('.'); parts[1]=Buffer.from(JSON.stringify({sub:'attacker'})).toString('base64url');
  await assert.rejects(()=>verifier.verify(parts.join('.')),expectCode('INVALID_TOKEN'));
  await assert.rejects(()=>verifier.verify(valid.slice(0,-8)+'AAAAAAAA'),expectCode('INVALID_TOKEN'));
});
// truonglt Phase3 business/security reference tests end
