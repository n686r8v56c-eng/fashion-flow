import test from 'node:test';
import assert from 'node:assert/strict';
import {KEYWORDS,PRODUCT_SEEDS,REFERENCE_SEEDS} from '../src/detailLabData.js';
import {RESEARCH_PRODUCTS,RESEARCH_ENRICHMENTS} from '../src/detailLabResearch.js';

test('Market Flow seasonal source has exactly 50 original keyword entries per season',()=>{
 for(const season of ['봄','여름','가을','겨울'])assert.equal(KEYWORDS.filter(row=>row.season===season).length,50,season);
 assert.equal(KEYWORDS.length,200);
});
test('All 35 long-form sample cards stay split by transcript',()=>{
 const products=[...PRODUCT_SEEDS,...RESEARCH_PRODUCTS];
 assert.equal(products.length,35);
 assert.equal(new Set(products.map(p=>p.id)).size,35);
 const counts={};for(const p of products)counts[p.referenceId]=(counts[p.referenceId]||0)+1;
 assert.deepEqual(counts,{'script-1':10,'script-2':12,'script-3':13});
 for(const p of products){
  assert.equal(p.keyword,'경량패딩');
  assert.ok(REFERENCE_SEEDS.some(r=>r.id===p.referenceId),p.id);
  assert.ok(p.title);
  assert.ok(Array.isArray(p.features));
  for(const f of p.features){assert.ok(f.detail,p.id);assert.ok(f.observation,p.id)}
 }
});
test('Added sample enrichments reference real base cards without overwriting IDs',()=>{
 const existing=new Set(PRODUCT_SEEDS.map(p=>p.id));
 for(const [id,features] of Object.entries(RESEARCH_ENRICHMENTS)){
  assert.ok(existing.has(id),'unknown base card '+id);
  assert.ok(Array.isArray(features)&&features.length);
  for(const f of features){assert.ok(f.detail);assert.ok(f.observation)}
 }
});
