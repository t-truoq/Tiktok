// truonglt Phase3.1 owner-interactive legitimate Auth session acquisition start
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const subject='c918885f-c09c-40b0-a43a-4edcbdf69317',url='https://nqdaykgasfnsaixkhbya.supabase.co/auth/v1';
async function prompt(label){
  if(!process.stdin.isTTY)throw Error('INTERACTIVE_OWNER_TERMINAL_REQUIRED');
  process.stdout.write(label);process.stdin.setRawMode(true);process.stdin.resume();let value='';
  return new Promise((resolve,reject)=>{const onData=buffer=>{for(const char of buffer.toString()){
    if(char==='\u0003'){finish();reject(Error('CANCELLED'));return;}
    if(char==='\r'||char==='\n'){finish();resolve(value);return;}
    if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else if(char>=' ')value+=char;
  }};const finish=()=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};process.stdin.on('data',onData);});
}
async function main(){
  const key=await prompt('Supabase publishable key (hidden): '),email=await prompt('Approved account email (hidden): '),password=await prompt('Password (hidden): ');
  const response=await fetch(url+'/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('LOGIN_FAILED_USE_EXISTING_OAUTH_OR_MFA_FLOW_IF_REQUIRED');const data=await response.json();
  if(data.user?.id!==subject||typeof data.access_token!=='string'){
    if(data.access_token)await fetch(url+'/logout',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+data.access_token}});
    throw Error('AUTHORIZED_IDENTITY_MISMATCH');
  }
  const{JwtVerifier}=require('../../apps/api/dist/business/security');if(await new JwtVerifier().verify(data.access_token)!==subject)throw Error('REAL_JWT_VERIFICATION_FAILED');
  const file=path.resolve(__dirname,'../../artifacts/phase3-real-actor.jwt');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data.access_token,{mode:0o600});
  if(process.platform==='win32'){const who=spawnSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true});const sid=who.stdout.match(/S-1-5-[0-9-]+/)?.[0];
    if(!sid||spawnSync('icacls',[file,'/inheritance:r','/grant:r','*'+sid+':(F)','*S-1-5-18:(F)'],{stdio:'pipe',windowsHide:true}).status!==0)throw Error('TOKEN_ACL_FAILED');}
  console.log('REAL_TOKEN_VERIFIED_AND_STORED_LOCAL_PUBLIC_WRITES_STILL_DISABLED');
}
main().catch(()=>{console.error('OWNER_LOGIN_NOT_COMPLETED_NO_TOKEN_OR_PASSWORD_LOGGED');process.exitCode=1;});
// truonglt Phase3.1 owner-interactive legitimate Auth session acquisition end
