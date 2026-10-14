// Build a reviewable, revision-bound import. Invoke with private paths; never publish its output.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { stageNotes } from './notes-import.mjs';
import { hash, applyCommand, migrate } from '../netlify/lib/core.mjs';
export function historyPackage(snapshot,ledger,reconciliation) {
  const staged=stageNotes(ledger), all=stageNotes(ledger,{includeMarch:true});
  const existing=new Map(snapshot.events.map(e=>[e.id,e]));
  const rows=new Map(ledger.rows.map(r=>[r.sourceId,r]));
  const edits=new Map(), review=[];
  const assigned=new Set(), matches=reconciliation.matches.map(match => {
    const source=all.events.find(x=>x.provenance.sourceId===match.sourceId && x.type===match.type);
    const exact=source?.time_precision==='minute' ? snapshot.events.find(e=>!e.deletedAt && !assigned.has(e.id) && e.type===match.type && e.id.startsWith('imp_2026-03_') && Math.abs(e.time-source.time)<60000) : null;
    if(exact){assigned.add(exact.id);return {...match,id:exact.id,exact:true};}
    return {...match,exact:false};
  });
  for(const match of matches) {
    if(!match.exact && assigned.has(match.id)) {review.push({sourceId:match.sourceId,reason:'Ambiguous existing record match'});continue;}
    assigned.add(match.id);
    const e=existing.get(match.id),row=rows.get(match.sourceId);
    if(!e || e.deletedAt || !row)continue;
    const source=all.events.find(x=>x.provenance.sourceId===row.sourceId && x.type===match.type);
    const provenance=source?.provenance || {sourceId:row.sourceId,raw:row.raw,text:row.text,header:row.header,file:row.file,line:row.line,flags:['Time unresolved']};
    const flags=[...provenance.flags];
    if(source?.time_precision==='minute' && Math.abs(source.time-e.time)>60000) {
      flags.push('Source clock differs from existing import; compare original note');review.push({id:e.id,source:source.provenance.wall,existingTime:e.time});
    }
    edits.set(e.id,{historical:true,provenance:{...provenance,flags,matchedExistingId:e.id,originalNote:e.note || ''},
      ...(flags.length?{tags:[...new Set([...(e.tags||[]),'needs-review'])]}:{})});
  }
  const repairs=['imp_2026-03_259','imp_2026-03_301','imp_2026-03_402','imp_2026-04_279'];
  for(const id of repairs) {
    const e=existing.get(id);if(!e || e.deletedAt)continue;
    const precise=id==='imp_2026-03_301';
    const end=precise ? Date.parse('2026-03-21T08:00:00-07:00') : null;
    edits.set(id,{...(edits.get(id)||{}),historical:true,end_time:end,
      ...(id==='imp_2026-03_259'?{analysisExcluded:true}:{}),
      provenance:{originalNote:e.note || '',originalEnd:e.end_time,
        raw:precise ? 'March 20\n8:16 💤\nMarch 21\n8:00 Wake Up' : id==='imp_2026-03_259' ? 'Monday March 16\n8:14' : e.note || '',
        flags:precise?[]:[id==='imp_2026-03_259'?'Activity not specified in original note':'Sleep end not recorded'],
        repair:precise?'Sleep window ends at the explicit next-day wake. Not measured uninterrupted sleep.':'Removed unrelated April 29 timer closure; original value preserved.'},
      ...(!precise?{tags:[...new Set([...(e.tags||[]),'needs-review'])]}:{})});
  }
  for(const id of ['imp_2026-03_312','imp_2026-03_387']) {
    const e=existing.get(id);if(e && !e.deletedAt)edits.set(id,{...(edits.get(id)||{}),historical:true,tags:[...new Set([...(e.tags||[]),'accident'])]});
  }
  for(const e of snapshot.events.filter(e=>!e.deletedAt && (e.tags?.includes('_diagnostic') || e.note==='__diagnostic_probe__')))
    edits.set(e.id,{historical:true,analysisExcluded:true});
  const commands=[];
  for(const e of staged.events) {
    if(existing.has(e.id)) {
      if(existing.get(e.id).provenance?.sourceId!==e.provenance.sourceId)throw Error('Import ID collision: '+e.id);
      continue;
    }
    commands.push({protocol:4,kind:'recover',eventId:e.id,payload:e,operationId:'history_'+hash(e).slice(0,32)});
  }
  for(const [id,payload] of edits)commands.push({protocol:4,kind:'edit',eventId:id,expectedRevision:existing.get(id).revision,payload,operationId:'history_'+hash({id,payload,revision:existing.get(id).revision}).slice(0,32)});
  // Validate every command against an isolated copy before a live request is possible.
  const simulation=migrate(structuredClone(snapshot));
  for(const c of commands)applyCommand(simulation,c,{id:'preview',person:'brandon'});
  return {version:1,batch:'notes-2026-10-13-v1',snapshotRevision:snapshot.revision,commands,held:staged.held,review,
    summary:{newEntries:commands.filter(c=>c.kind==='recover').length,updatedEntries:edits.size,heldRows:staged.held.length,clockQuestions:review.length},
    rollback:{newIds:commands.filter(c=>c.kind==='recover').map(c=>c.eventId),originals:[...edits.keys()].map(id=>existing.get(id))}};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [snapshotPath,ledgerPath,analysisPath,out]=process.argv.slice(2);
  if(!out)throw Error('Usage: node scripts/history-package.mjs <snapshot> <ledger> <analysis> <private-output>');
  const read=p=>JSON.parse(fs.readFileSync(p));
  const result=historyPackage(read(snapshotPath),read(ledgerPath),read(analysisPath).marchReconciliation);
  fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result.summary));
}
