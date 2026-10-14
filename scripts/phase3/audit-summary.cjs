// truonglt Phase3 dependency audit without automatic fixes start
const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),cli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
const report={verifiedAtUtc:new Date().toISOString(),dependencyChanges:!!pkg.overrides,controlledOverrides:pkg.overrides||{},forceFixExecuted:false,audits:[]};
for(const scope of ['all','production']){
  const result=spawnSync(process.execPath,[cli,'audit','--json',...(scope==='production'?['--omit=dev']:[])],{cwd:root,encoding:'utf8',windowsHide:true});
  let data;try{data=JSON.parse(result.stdout);}catch{report.audits.push({scope,status:'AUDIT_UNAVAILABLE'});continue;}
  if(data.error){report.audits.push({scope,status:'AUDIT_UNAVAILABLE'});continue;}
  report.audits.push({scope,counts:data.metadata?.vulnerabilities,findings:Object.entries(data.vulnerabilities||{}).map(([name,item])=>({name,severity:item.severity,isDirect:item.isDirect,
    range:item.range,fixAvailable:item.fixAvailable,advisories:item.via.filter(x=>typeof x==='object').map(x=>({title:x.title,url:x.url,range:x.range}))}))});
}
fs.writeFileSync(path.join(root,'docs/phase3/DEPENDENCY_AUDIT.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.audits.map(x=>({scope:x.scope,status:x.status||'COMPLETE',counts:x.counts,packages:x.findings?.map(f=>f.name)}))));
// truonglt Phase3 dependency audit without automatic fixes end
