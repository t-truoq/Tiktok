// truonglt Phase3.1 patched Prisma configuration dependency compatibility start
const{test}=require('node:test'),assert=require('node:assert/strict');
test('patched deepmerge supports Prisma static plain configuration merge and cycles safely',async()=>{
  const{deepmerge}=await import('deepmerge-ts');
  const left={schema:'schema.prisma',migrations:{path:'migrations'},datasource:{url:'postgresql://unused:unused@127.0.0.1:1/offline'}};
  const right={migrations:{seed:'node seed.cjs'},datasource:{url:'postgresql://unused:unused@127.0.0.1:1/changed'}};
  assert.deepEqual(deepmerge(left,right),{schema:'schema.prisma',migrations:{path:'migrations',seed:'node seed.cjs'},datasource:{url:right.datasource.url}});
  assert.equal(left.datasource.url,'postgresql://unused:unused@127.0.0.1:1/offline');
  const a={},b={};a.self=a;b.self=b;try{deepmerge(a,b);}catch(error){assert.doesNotMatch(error.message,/Maximum call stack size exceeded/);}
});
// truonglt Phase3.1 patched Prisma configuration dependency compatibility end
