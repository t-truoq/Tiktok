// truonglt Phase3.1 independent timezone and boundary tests start
const{test}=require('node:test');const assert=require('node:assert/strict');
const{sourceDateToInstant,formatSourceTimestamp,SOURCE_TIMEZONE}=require('../dist/finance/source-time');
const{calculateStatus}=require('../dist/finance/engine');
test('official IANA timezone handles UTC/local month, year, leap-day and date-only',()=>{
  assert.equal(SOURCE_TIMEZONE,'Asia/Ho_Chi_Minh');
  for(const[local,utc]of[['2026-01-01 00:00:00','2025-12-31T17:00:00.000Z'],['2024-03-01 00:00:00','2024-02-29T17:00:00.000Z'],
    ['2026-10-14 10:46:38','2026-10-14T03:46:38.000Z'],['2026-10-14','2026-10-13T17:00:00.000Z']])assert.equal(sourceDateToInstant(local).toISOString(),utc);
  assert.equal(formatSourceTimestamp(new Date('2025-12-31T17:00:00Z')),'2026-01-01 00:00:00');
  assert.equal(sourceDateToInstant('2026-10-14T10:46:38+07:00').toISOString(),'2026-10-14T03:46:38.000Z');
});
test('timezone conversion has no dependency on process TZ and invalid dates never roll over',()=>{
  const before=process.env.TZ;
  try{for(const tz of['UTC','America/New_York','Asia/Tokyo']){process.env.TZ=tz;assert.equal(sourceDateToInstant('2026-01-01 00:00:00').toISOString(),'2025-12-31T17:00:00.000Z');}}
  finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}
  for(const v of['2026-02-30 12:00:00','14/10/2026','2026-13-01','2026-01-01 24:00:00','2026-02-30T00:00:00Z',0,{}])assert.throws(()=>sourceDateToInstant(v),/INVALID_SOURCE_DATE/);
  for(const v of[null,undefined,''])assert.equal(sourceDateToInstant(v),null);
});
test('24h,15d,30d boundaries span local year/month changes with explicit clock',()=>{
  const start=sourceDateToInstant('2025-12-31 23:59:59');
  for(const[stage,note,days,before,at]of[['Nhận mẫu 3','',1,'Chờ đủ 1 ngày','Có thể đặt lượt tiếp theo'],
    ['Nhận End 3','',15,'Chờ check hoàn','⚠️ Cần check hoàn tiền'],['Nhận mẫu 3','hết hàng',30,'Hết hàng • còn 1 ngày hoàn','⚠️ Cần check hoàn tiền']]){
    assert.equal(calculateStatus(stage,start,'',note,new Date(start.getTime()+days*86400000-1)),before);
    assert.equal(calculateStatus(stage,start,'',note,new Date(start.getTime()+days*86400000)),at);
  }
});
// truonglt Phase3.1 independent timezone and boundary tests end
