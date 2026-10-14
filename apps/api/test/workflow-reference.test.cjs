// truonglt Phase3.1 whole onEdit/header source workflow parity harness start
const{test}=require('node:test'),assert=require('node:assert/strict');
const{sourceRuntime,oracle}=require('../../../scripts/phase0/source-baseline.cjs');const{applyOperation}=require('../dist/business/operations');const{calculateFinance}=require('../dist/finance/engine');
const Decimal=require('decimal.js');
function harness(filename){
  process.env.TZ='Asia/Ho_Chi_Minh';let clock=Date.parse('2026-10-14T00:00:00Z');
  const runtime=sourceRuntime(filename),ctx=runtime.context,cells=new Map();
  class ReferenceDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}}
  ctx.Date=ReferenceDate;ctx.Session={getScriptTimeZone:()=> 'Asia/Ho_Chi_Minh'};
  ctx.Utilities={formatDate:(date,tz)=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;}};
  ctx.LockService={getDocumentLock:()=>({waitLock(){},releaseLock(){}})};
  let stored={name:'synthetic',schemaVersion:'9.1',history:[],stageData:{},purchaseState:{},currentProgress:'',currentDate:'',refundQty:'',wholesale:null,qty:null,note:'',pic:'',status:'',profit:null};
  cells.set('3:1','synthetic');ctx.loadRecord=()=>structuredClone(stored);ctx.saveRecord=(_name,r)=>{stored=JSON.parse(JSON.stringify(r));};
  ctx.stylePaymentSummary=()=>{};ctx.colorStatusCell=()=>{};ctx.saveImageToRecord=()=>{};
  const sheet={getName:()=> 'Trang tính2',getLastRow:()=>3,getImages:()=>[],getRange:(row,col=1,rows=1,cols=1)=>{
    if(typeof row==='string'){const m=/^([A-Z]+)(\d+)$/.exec(row);col=[...m[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);row=Number(m[2]);}
    let range;const values=display=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>{const v=cells.get(`${row+i}:${col+j}`)??'';return display?String(v):v;}));
    const methods={getSheet:()=>sheet,getRow:()=>row,getColumn:()=>col,getNumRows:()=>rows,getNumColumns:()=>cols,getValue:()=>cells.get(`${row}:${col}`)??'',getDisplayValue:()=>String(cells.get(`${row}:${col}`)??''),
      getValues:()=>values(false),getDisplayValues:()=>values(true),setValue:v=>{cells.set(`${row}:${col}`,v);return range;},clearContent:()=>{cells.set(`${row}:${col}`,'');return range;},
      setValues:matrix=>{matrix.forEach((r,i)=>r.forEach((v,j)=>cells.set(`${row+i}:${col+j}`,v)));return range;},getFormula:()=>''};
    range=new Proxy(methods,{get:(obj,k)=>obj[k]||(()=>range)});return range;
  }};
  return{ctx,record:()=>structuredClone(stored),clock:()=>new Date(clock),edit:(col,value)=>{const old=cells.get('3:'+col);cells.set('3:'+col,col===6?new ReferenceDate(value):value);ctx.onEdit({triggerUid:'synthetic-installed',range:sheet.getRange(3,col),oldValue:old});},
    action:fn=>{ctx.selectedStage91=()=>({sheet,row:3,name:'synthetic',r:structuredClone(stored),s:ctx.parseAffiliateStage(stored.currentProgress)});ctx.auditPaymentSummary=()=>{};ctx[fn]();},setClock:value=>{clock=Date.parse(value);}};
}
for(const filename of['Tiktok_Affiliate_V9.1_Original_Backup.gs','Tiktok_Affiliate_V9.2_Optimized.gs'])test(`${filename} whole onEdit financial/state/event workflow`,()=>{
  const h=harness(filename);let current=h.record(),view;
  const steps=[['SET_STAGE',{progress:'Đặt mẫu 3'},4,'Đặt mẫu 3'],['EDIT_BUY',{value:'12.34'},8,'12.34'],['SET_STAGE',{progress:'Nhận mẫu 3'},4,'Nhận mẫu 3'],
    ['EDIT_FIELDS',{note:' hết hàng '},15,' hết hàng '],['EDIT_FIELDS',{pic:' PIC-A '},5,' PIC-A '],['EDIT_FIELDS',{date:'2026-10-13T00:00:00Z'},6,'2026-10-13T00:00:00Z'],
    ['SET_STAGE',{progress:'Đặt mẫu 3'},4,'Đặt mẫu 3'],['CANCEL_STAGE',{},null,'cancelSelectedAffiliateStage91'],['RESTORE_STAGE',{},null,'restoreSelectedAffiliateStage91'],
    ['SET_STAGE',{progress:'Đặt End 3'},4,'Đặt End 3'],['EDIT_BUY',{value:'0.02'},9,'0.02'],['EDIT_SALES',{unitPrice:'0.1'},12,'0.1'],['EDIT_SALES',{quantity:'0.2'},13,'0.2'],
    ['SET_STAGE',{progress:'Nhận End 3'},4,'Nhận End 3'],['VERIFY_STAGE',{},null,'verifySelectedAffiliateStage91'],['CORRECT_UNRECEIVED',{},null,'markSelectedUnreceived91'],
    ['SET_STAGE',{progress:'Done'},4,'Done'],['SET_STAGE',{progress:''},4,'']];
  for(const[operation,values,col,value]of steps){
    const before=h.record().history.length;col===null?h.action(value):h.edit(col,value);
    const result=applyOperation(current,{operation,values,expectedVersion:1},h.clock(),view),ref=h.record();
    assert.deepEqual(result.record.purchaseState,ref.purchaseState,operation+JSON.stringify(values));
    const actual=calculateFinance(result.record),expected=oracle({context:h.ctx},ref);
    for(const key of['paid','unpaid','sampleTotal','endTotal'])assert(new Decimal(actual.payment[key]).eq(expected.payment[key]),operation+':'+key);
    assert(new Decimal(actual.refund.total).eq(expected.refund.total));assert(Math.abs(Number(actual.projectedProfit)-expected.projectedProfit)<1e-12);
    assert.equal(result.record.status||'',ref.status||'',operation+':status');
    assert.deepEqual(result.events.map(e=>({type:e.type,stage:e.stage})),ref.history.slice(before).map(e=>({type:e.type,stage:e.progress})),operation+':event sequence');
    if(result.record.currentProgress){
      const a=result.record.stageData[result.record.currentProgress],b=ref.stageData[ref.currentProgress];assert.equal(a?.date,b?.date,operation+':snapshot date');
      for(const field of['price','endPrice','sellEnd','sellEndQty','profit']){
        if(a[field]===''||a[field]===null||b[field]===''||b[field]===null)assert.equal(a[field],b[field],operation+':snapshot '+field);
        else assert(Math.abs(Number(a[field])-Number(b[field]))<1e-12,operation+':snapshot '+field);
      }
      for(const field of['pic','note','status'])assert.equal(a[field],b[field],operation+':snapshot '+field);
    }
    current=result.record;view=result.view;
  }
});
// truonglt Phase3.1 whole onEdit/header source workflow parity harness end
