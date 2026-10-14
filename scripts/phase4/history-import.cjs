// truonglt Phase4 offline-default CLI with separate owner approval gate start
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');const {buildPlan,reconcilePlan,importInTransaction}=require('./importer.cjs');
const {sourcePath,sha}=require('../phase0/source-baseline.cjs');
async function main(){
  const args=process.argv.slice(2);assert(args.every(x=>['--dry-run','--apply'].includes(x))&&!(args.includes('--apply')&&args.includes('--dry-run')),'INVALID_ARGUMENTS');
  const before=sha(fs.readFileSync(sourcePath)),plan=buildPlan(),reconciliation=reconcilePlan(plan);
  const report={verifiedAtUtc:new Date().toISOString(),status:'DRY_RUN_PASS',databaseConnected:false,databaseWrites:false,historyImported:false,
    sourceSha256:before,planSha256:plan.planSha256,mappingVersion:plan.mappingVersion,timezone:'Asia/Ho_Chi_Minh',...reconciliation};
  fs.mkdirSync(path.join(root,'docs/phase4'),{recursive:true});
  if(args.includes('--apply')){
    // This invocation has NOT been approved or executed. Future owner signoff must match this exact plan.
    require('dotenv').config({path:path.join(root,'apps/api/.env'),quiet:true});
    const approvalPath=process.env.HISTORY_IMPORT_APPROVAL_PATH;
    if(!approvalPath||!fs.existsSync(approvalPath))throw Error('OWNER_DATA_IMPORT_APPROVAL_REQUIRED');
    const approval=JSON.parse(fs.readFileSync(approvalPath));
    assert.equal(approval.scope,'AUTHORITATIVE_HISTORY_DEV_IMPORT');assert.equal(approval.projectRef,'nqdaykgasfnsaixkhbya');
    assert.equal(approval.sourceSha256,before);assert.equal(approval.planSha256,plan.planSha256);assert.equal(approval.approved,true);
    assert.equal(process.env.DB_ENVIRONMENT,'DEV');
    // Import connection is explicitly supplied; no fallback from runtime or health owner connection.
    const url=new URL(process.env.IMPORT_DATABASE_URL);assert.equal(url.username,'postgres.nqdaykgasfnsaixkhbya');
    assert.equal(url.hostname,'aws-0-ap-northeast-2.pooler.supabase.com');assert.equal(url.port,'5432');assert.equal(url.pathname,'/postgres');
    const{Pool}=require('pg'),{PrismaPg}=require('@prisma/adapter-pg');
    const{PrismaClient,Prisma}=require('../../apps/api/dist/generated/prisma/client');const{databaseConnectionOptions}=require('../../apps/api/dist/database');
    const pool=new Pool({...databaseConnectionOptions(process.env.IMPORT_DATABASE_URL),max:1,connectionTimeoutMillis:10000});
    const client=new PrismaClient({adapter:new PrismaPg(pool),log:[]});
    try{
      const result=await client.$transaction(async tx=>{
        await tx.$executeRaw`SET LOCAL lock_timeout='10s'`;
        const identity=await tx.$queryRaw`SELECT current_user role,current_setting('TimeZone') timezone`;
        assert.equal(identity[0].role,'postgres');assert.equal(identity[0].timezone,'UTC');
        const migrations=await tx.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name`;
        assert.equal(migrations.length,2);assert(migrations.every(m=>m.finished_at&&!m.rolled_back_at));
        assert.equal(migrations[0].checksum,'148e77f65ba5c08720afddc569e3535512017b3257a1384ba39cdb7c5cb37c93');
        assert.equal(migrations[1].checksum,'3916a0baca77cd2be19531165d24315d251aae732b54df3437a7a13e561f3a0b');
        return importInTransaction(tx,plan,Prisma);
      },{isolationLevel:'Serializable',timeout:180000,maxWait:10000});
      Object.assign(report,{status:result.replay?'ALREADY_IMPORTED_VERIFIED':'IMPORTED_VERIFIED',databaseConnected:true,databaseWrites:!result.replay,historyImported:true,replay:result.replay});
    }finally{await client.$disconnect();await pool.end();}
  }
  assert.equal(sha(fs.readFileSync(sourcePath)),before,'SOURCE_CHANGED_DURING_RUN');report.sourceChecksumAfter=before;
  fs.writeFileSync(path.join(root,'docs/phase4',args.includes('--apply')?'IMPORT_RESULT.json':'DRY_RUN_RESULT.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}
if(require.main===module)main().catch(e=>{
  const safe=['OWNER_DATA_IMPORT_APPROVAL_REQUIRED','INVALID_ARGUMENTS','NONEMPTY_PRODUCTS_REQUIRE_OWNER_REVIEW','ARCHIVE_EXISTS_WITHOUT_MATCHING_BATCH','SOURCE_CHECKSUM_MISMATCH','PLAN_CHECKSUM_MISMATCH'];
  const failure={status:'FAILED_STOPPED',code:safe.includes(e.message)?e.message:'IMPORT_VALIDATION_OR_TRANSACTION_FAILED',
    ...(typeof e.code==='string'&&/^P\d{4}$/.test(e.code)?{prismaCode:e.code}:{}),automaticRetry:false};
  fs.mkdirSync(path.join(root,'docs/phase4'),{recursive:true});
  fs.writeFileSync(path.join(root,'docs/phase4/IMPORT_ERROR_RESULT.json'),JSON.stringify(failure,null,2)+'\n');
  console.error(JSON.stringify(failure));process.exitCode=1;
});
module.exports={main};
// truonglt Phase4 offline-default CLI with separate owner approval gate end
