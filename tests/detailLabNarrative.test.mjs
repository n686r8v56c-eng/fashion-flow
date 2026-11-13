import test from 'node:test';
import assert from 'node:assert/strict';
import {NARRATIVE_RESEARCH,NARRATIVE_SCHEMA} from '../src/detailLabNarrative.js';
import {REFERENCE_SEEDS,PRODUCT_SEEDS} from '../src/detailLabData.js';
import {RESEARCH_PRODUCTS} from '../src/detailLabResearch.js';

test('three longform content analyses have traceable refs and structured evidence',()=>{
 assert.equal(NARRATIVE_SCHEMA,'fashion-detail-lab-content-analysis-v1');
 assert.equal(NARRATIVE_RESEARCH.length,3);
 const refIds=new Set(REFERENCE_SEEDS.map(r=>r.id));
 const productIds=[...PRODUCT_SEEDS,...RESEARCH_PRODUCTS].map(p=>p.referenceId);
 for(const entry of NARRATIVE_RESEARCH){
  assert.ok(refIds.has(entry.id),entry.id);
  assert.ok(productIds.includes(entry.id),entry.id);
  assert.equal(entry.keyword,'경량패딩');
  assert.ok(entry.hook&&entry.purpose&&entry.engine);
  assert.ok(entry.structure.length>=5);
  assert.ok(entry.devices.length>=5);
  assert.ok(entry.promiseOutcome.length);
  for(const item of entry.structure)assert.ok(item.role&&item.device&&item.evidence);
  for(const item of entry.devices)assert.ok(item.name&&item.evidence&&item.kind);
 }
});
test('1등 promised in script 3 is not falsely recorded as fulfilled',()=>{
 const third=NARRATIVE_RESEARCH.find(v=>v.id==='script-3');
 assert.ok(third.promiseOutcome.some(x=>x.promise.includes('1등')&&x.status.includes('미이행')));
});
test('script 1 unknown timestamps remain explicitly unknown',()=>{
 const first=NARRATIVE_RESEARCH.find(v=>v.id==='script-1');
 assert.ok(first.structure.every(x=>x.start==='미제공'&&x.end==='미제공'));
});
