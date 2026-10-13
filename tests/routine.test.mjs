import test from "node:test";
import assert from "node:assert/strict";
import { lastRoutine, validateSupplies } from "../public/routine.js";
import { migrate, applyCommand } from "../netlify/lib/core.mjs";

test("last routine uses recorded grooming, ignores future/deleted logs and preserves attribution", () => {
  const events = [
    {id:"a",type:"grooming",careTitle:"Brush",time:100,loggedBy:"kim"},
    {id:"b",type:"grooming",careTitle:"Brush",time:200,deletedAt:201},
    {id:"c",type:"grooming",careTitle:"Brush",time:400},
    {id:"d",type:"grooming",careTitle:"Teeth",time:250},
  ];
  assert.equal(lastRoutine(events,"Brush",300).id,"a");
  assert.equal(lastRoutine(events,"Brush",300).loggedBy,"kim");
  assert.equal(lastRoutine(events,"Bath",300),null);
});

test("supply status is validated and shared without creating medication events", () => {
  const item = {id:"heartgard",status:"ordered",updatedAt:100,link:"https://example.com/refill"};
  assert.throws(()=>validateSupplies([item,{...item}]));
  assert.throws(()=>validateSupplies([{...item,link:"javascript:alert(1)"}]));
  assert.throws(()=>validateSupplies([{...item,status:"given"}]));
  const doc=migrate({events:[]}), device={id:"d1",person:"brandon"};
  const command={protocol:4,operationId:"supply-1",kind:"profile",eventId:null,payload:{supplies:[item]},expectedRevision:doc.profile.revision};
  applyCommand(doc,command,device);
  assert.equal(doc.profile.supplies[0].status,"ordered");
  assert.equal(doc.events.length,0);
  assert.throws(()=>applyCommand(doc,{...command,operationId:"supply-2"},device),/Shared settings changed/);
});
