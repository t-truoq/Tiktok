// truonglt dedicated runtime synthetic service integration; always rollback start
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});process.env.BUSINESS_API_ENABLED='true';process.env.BUSINESS_WRITE_ENABLED='true';
const {BusinessRepository}=require('../../apps/api/dist/business/repository'),{BusinessService}=require('../../apps/api/dist/business/service'),{sanitizedDatabaseError}=require('../../apps/api/dist/database');
const repository=new BusinessRepository(),report={startedAtUtc:new Date().toISOString(),status:'RUNNING',syntheticOnly:true,realJwtE2E:false,committedWrites:false};
async function main(){const user=await repository.actor('c918885f-c09c-40b0-a43a-4edcbdf69317');assert.equal(user.role,'ADMIN');const actor={id:user.id,subject:user.authSubject,role:user.role},db=await repository.db();
  const counts=()=>repository.read(async tx=>({products:await tx.product.count(),images:await tx.productImage.count(),history:await tx.productHistory.count(),requests:await tx.mutationRequest.count()}),actor);
  report.before=await counts();const rollback=Error('EXPECTED_SYNTHETIC_ROLLBACK');
  try{await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${actor.id}, true), set_config('app.auth_subject', ${actor.subject}, true)`;
    const scoped={managementAvailable:()=>repository.managementAvailable(),transaction:async(a,fn)=>{assert.equal(a.id,actor.id);return fn(tx);},read:async fn=>fn(tx)};
    const service=new BusinessService(scoped),key=crypto.randomUUID(),body={name:'Synthetic rollback '+crypto.randomUUID(),pic:'Synthetic',note:'No committed fixture'};
    const created=await service.create(body,actor,key);assert.deepEqual(await service.create(body,actor,key),created);
    const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=',imageBody={expectedVersion:1,filename:'pixel.png',contentType:'image/png',data:png},imageKey=crypto.randomUUID();
    const image=await service.uploadImage(created.id,imageBody,actor,imageKey);assert.equal(image.version,2);assert.deepEqual(await service.uploadImage(created.id,imageBody,actor,imageKey),image);
    const content=await service.imageContent(created.id,image.imageId,actor);assert.equal(content.bytes.toString('base64'),png);
    await assert.rejects(()=>service.uploadImage(created.id,imageBody,actor,crypto.randomUUID()),e=>e.getResponse?.().code==='VERSION_CONFLICT');
    const before=await service.detail(created.id,actor);assert.equal(before.classification,'MANUAL');assert.equal(before.imageId,image.imageId);assert.equal(before.suggestedRounds.SAMPLE,1);assert.equal(JSON.stringify(before).includes(png),false);
    let version=2;for(const [group,price]of[['SAMPLE','100'],['END','200']]){await service.mutate(created.id,{expectedVersion:version++,operation:'ROUND_ACTION',values:{action:'ORDER_NEXT',group,value:price}},actor,crypto.randomUUID());}
    const ordered=await service.detail(created.id,actor);assert.equal(ordered.ongoingRounds.length,2);assert.equal(ordered.finance.payment.unpaid,'300');
    await service.mutate(created.id,{expectedVersion:version++,operation:'ROUND_ACTION',values:{action:'RECEIVE',group:'SAMPLE',roundIndex:'1'}},actor,crypto.randomUUID());
    const received=await service.detail(created.id,actor);assert.equal(received.finance.payment.paid,'100');assert.equal(received.finance.payment.unpaid,'200');assert.equal(received.ongoingRounds.length,1);assert.equal(received.ongoingRounds[0].group,'END');
    const noPermission=(await tx.$queryRaw`SELECT has_table_privilege(current_user,'public.product_images','DELETE') image_delete,has_table_privilege(current_user,'public.product_history','UPDATE') history_update,has_table_privilege(current_user,'public.products','TRUNCATE') truncate`)[0];assert(!noPermission.image_delete&&!noPermission.history_update&&!noPermission.truncate);
    report.checks={manualInsertRls:true,privateImageInsertRls:true,createReplay:true,imageReplay:true,versionConflict:true,privateImageBytes:true,noBase64InList:true,parallelRounds:true,receiveIsolation:true,noDeleteUpdateHistoryTruncate:true};
    throw rollback;
  },{isolationLevel:'Serializable',timeout:30000});}catch(e){if(e!==rollback)throw e;report.rollback='PASS';}
  report.after=await counts();assert.deepEqual(report.after,report.before);report.status='PASS';
}
main().catch(e=>{report.status='FAIL';report.safeCode=sanitizedDatabaseError(e);if(e?.getResponse)report.businessCode=e.getResponse().code;process.exitCode=1;}).finally(async()=>{await repository.onApplicationShutdown();report.finishedAtUtc=new Date().toISOString();fs.writeFileSync(path.join(root,'docs/phase5/MANAGEMENT_LIVE_RESULT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
// truonglt dedicated runtime synthetic service integration; always rollback end
