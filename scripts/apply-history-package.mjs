// Explicit operator tool: requires an already-authorized session; never discovers credentials.
// Run after reviewing the private package and deploying the history-import endpoint.
import fs from 'node:fs';
import { hash, stable } from '../netlify/lib/core.mjs';
const [base,sessionPath,packagePath,ledgerPath,outputDir,flag]=process.argv.slice(2);
if(flag!=='--apply')throw Error('Usage: node scripts/apply-history-package.mjs <API URL> <authorized-session> <reviewed-package> <source-ledger> <private-output-dir> --apply');
const session=JSON.parse(fs.readFileSync(sessionPath)),plan=JSON.parse(fs.readFileSync(packagePath));
const headers={Authorization:'Bearer '+session.token,'X-Winnie-Home':session.home,'Content-Type':'application/json'};
async function request(action,value) {
  const response=await fetch(base+'?action='+action,{method:value?'POST':'GET',headers,...(value?{body:JSON.stringify(value)}:{})});
  const data=await response.json();
  if(!response.ok)throw Error(action+' failed ('+response.status+'): '+data.error);
  return data;
}
const before=await request('export');
fs.mkdirSync(outputDir,{recursive:true});
const beforePath=outputDir+'/before.json';
if(!fs.existsSync(beforePath))fs.writeFileSync(beforePath,JSON.stringify(before,null,2));
const archived=await request('archive',JSON.parse(fs.readFileSync(beforePath)));
if(!archived.archived || archived.sha256!==hash(stable(JSON.parse(fs.readFileSync(beforePath)))))throw Error('Backup digest mismatch.');
const ledger=JSON.parse(fs.readFileSync(ledgerPath));
const source={events:[],ledger};
const sourceBackup=await request('archive',source);
if(!sourceBackup.archived || sourceBackup.sha256!==hash(stable(source)))throw Error('Source archive digest mismatch.');
fs.writeFileSync(outputDir+'/backup-receipts.json',JSON.stringify({archived,sourceBackup},null,2));
const progressPath=outputDir+'/receipts.json';
const receipts=fs.existsSync(progressPath)?JSON.parse(fs.readFileSync(progressPath)):[];
for(let start=0;start<plan.commands.length;start+=100) {
  const commands=plan.commands.slice(start,start+100);
  // Original operation IDs and revisions make a replay safe after an uncertain response.
  const result=await request('history-import',{archiveSha256:archived.sha256,commands});
  receipts.push(...result.receipts);fs.writeFileSync(progressPath,JSON.stringify(receipts));
  console.log('Verified '+Math.min(start+100,plan.commands.length)+' / '+plan.commands.length+' historical changes');
}
const latest=await request('export');
const recordMap=new Map(latest.events.map(e=>[e.id,e]));
for(const command of plan.commands) {
  const actual=recordMap.get(command.eventId);
  if(!actual)throw Error('Missing imported entry '+command.eventId);
  for(const [key,value] of Object.entries(command.payload)) {
    if(command.kind==='recover' && ['id','photos','revision','deletedAt','loggedBy','deviceId'].includes(key))continue;
    if(stable(actual[key])!==stable(value))throw Error('Verification differs for '+command.eventId+' '+key+'; inspect concurrent edits.');
  }
}
for(const original of JSON.parse(fs.readFileSync(beforePath)).events) {
  const actual=recordMap.get(original.id);
  if(!actual || stable(actual.photos || [])!==stable(original.photos || []))throw Error('Original photo references changed; inspect '+original.id);
}
const historyArchive={batch:plan.batch,held:plan.held,sourceDigest:sourceBackup.sha256,importedAt:Date.now(),count:plan.summary.newEntries};
await request('command',{protocol:4,operationId:'history-profile-'+hash(historyArchive).slice(0,24),kind:'profile',expectedRevision:latest.profile.revision,payload:{historyArchive}});
const after=await request('export');fs.writeFileSync(outputDir+'/after.json',JSON.stringify(after,null,2));
console.log(JSON.stringify({verified:true,...plan.summary,activeEntries:after.events.filter(e=>!e.deletedAt).length,photos:after.events.reduce((n,e)=>n+(e.photos?.length||0),0)}));
