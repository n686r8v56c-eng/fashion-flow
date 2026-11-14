import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {createSyncEngine} from '../src/sync/engine.js';
import {openLocalDatabase,transaction} from '../src/sync/localDatabase.js';
import {createAssetCodec} from '../src/sync/assets.js';
const OWNER='11111111-1111-4111-8111-111111111111';
const copy=x=>structuredClone(x);
function server(){
 const events=[];let fail=false,afterPush=null,pushes=0;
 const client={from(){let owner,cursor=0;return {select(){return this},eq(_,v){owner=v;return this},gt(_,v){cursor=v;return this},order(){return this},async limit(n){if(fail)return {error:{code:'NETWORK',message:'offline'}};return {data:copy(events.filter(x=>x.user_id===owner&&x.seq>cursor).slice(0,n))}}}},async rpc(_, {changes}){
  if(fail)return {error:{code:'NETWORK',message:'offline'}};if(changes.some(c=>!['candidates','collection','products'].includes(c.collection)))return {error:{code:'23514',message:'fashion_sync_events_collection_check'}};pushes++;const results=[];
  for(const c of changes){const existing=events.find(x=>x.user_id===OWNER&&x.mutation_id===c.mutation_id);if(existing){results.push({status:'ok',mutation_id:c.mutation_id,seq:existing.seq});continue}
   const latest=events.findLast(x=>x.user_id===OWNER&&x.collection===c.collection&&x.item_id===c.item_id);
   if((latest?.seq||0)!==c.base_seq){results.push({status:'conflict',mutation_id:c.mutation_id,event:copy(latest)});continue}
   const event={...copy(c),user_id:OWNER,seq:events.length+1};events.push(event);results.push({status:'ok',mutation_id:c.mutation_id,seq:event.seq});
  }if(afterPush){const fn=afterPush;afterPush=null;await fn()}return {data:results};
 }};
 return {client,events,get pushes(){return pushes},setFail:v=>fail=v,setAfterPush:fn=>afterPush=fn};
}
const device=(srv,dbName)=>createSyncEngine({client:srv.client,userId:OWNER,dbName,legacy:false});
test('two devices exchange additions, updates and deletion tombstones; clean sync does not resend',async()=>{
 const srv=server(),a=await device(srv,'device-a'),b=await device(srv,'device-b');
 await a.save('collection',{id:'link-1',title:'아이폰 수집'});await a.sync();assert.equal(srv.events.length,1);
 await b.sync();assert.deepEqual(await b.list('collection'),[{id:'link-1',title:'아이폰 수집'}]);
 await b.save('collection',{id:'link-1',title:'아이패드 수정'});await b.sync();await a.sync();assert.equal((await a.list('collection'))[0].title,'아이패드 수정');
 await a.remove('collection','link-1');await a.sync();await b.sync();assert.deepEqual(await b.list('collection'),[]);
 const count=srv.pushes;await a.sync();assert.equal(srv.pushes,count);a.close();b.close();
});
test('failed upload and restart preserve the durable queue',async()=>{
 const srv=server(),a=await device(srv,'offline-device');await a.save('products',{id:'p',name:'상품',offers:[]});srv.setFail(true);await a.sync();assert.equal(a.getStatus().pending,1);a.close();
 const reopened=await device(srv,'offline-device');assert.equal((await reopened.list('products'))[0].name,'상품');srv.setFail(false);await reopened.sync();assert.equal(reopened.getStatus().pending,0);assert.equal(srv.events.length,1);reopened.close();
});
test('concurrent edits retain both versions; explicit resolution copies local changes',async()=>{
 const srv=server(),a=await device(srv,'conflict-a'),b=await device(srv,'conflict-b');await a.save('candidates',{id:'c',title:'초안'});await a.sync();await b.sync();
 await a.save('candidates',{id:'c',title:'아이폰 수정'});await b.save('candidates',{id:'c',title:'아이패드 수정'});await a.sync();await b.sync();
 assert.equal(b.getStatus().conflicts,1);assert.equal((await b.list('candidates'))[0].title,'아이패드 수정');
 await b.resolveConflicts();const titles=(await b.list('candidates')).map(x=>x.title);assert.ok(titles.includes('아이폰 수정'));assert.ok(titles.includes('아이패드 수정 (기기 복사)'));assert.equal(b.getStatus().conflicts,0);await a.sync();assert.equal((await a.list('candidates')).length,2);a.close();b.close();
});
test('editing during an in-flight upload never acknowledges the newer mutation',async()=>{
 const srv=server(),a=await device(srv,'race-a');await a.save('products',{id:'p',name:'이전'});srv.setAfterPush(()=>a.save('products',{id:'p',name:'새 수정'}));await a.sync();
 assert.equal(a.getStatus().pending,1);assert.equal((await a.list('products'))[0].name,'새 수정');await a.sync();assert.equal(srv.events.at(-1).payload.name,'새 수정');assert.equal(a.getStatus().pending,0);a.close();
});
test('pagination imports more than one page without skipping records',async()=>{
 const srv=server(),a=await device(srv,'pages-a'),b=await device(srv,'pages-b');await a.saveBatch('products',Array.from({length:205},(_,i)=>({id:'p'+i,name:String(i)})));await a.sync();await b.sync();assert.equal((await b.list('products')).length,205);a.close();b.close();
});
test('legacy migration keeps originals and never reimports deletions or leaks unscoped rows to another owner',async()=>{
 const legacy=await new Promise((resolve,reject)=>{const r=indexedDB.open('fashion-collection-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('links',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 await transaction(legacy,['links'],'readwrite',tx=>tx.objectStore('links').put({id:'old',title:'기존 기록',manualThumbnail:new Blob(['photo'])}));
 const srv=server(),a=await createSyncEngine({client:srv.client,userId:OWNER,dbName:'migration'});assert.equal((await a.list('collection')).length,1);await a.remove('collection','old');a.close();
 const again=await createSyncEngine({client:srv.client,userId:OWNER,dbName:'migration'});assert.equal((await again.list('collection')).length,0);assert.equal((await transaction(legacy,['links'],'readonly',tx=>tx.objectStore('links').getAll())).length,1);
 const other=await createSyncEngine({client:srv.client,userId:'other-user',dbName:'migration'});assert.equal((await other.list('collection')).length,0);again.close();other.close();legacy.close();
});
test('photos are uploaded once by content hash and fetched once on the second device',async()=>{
 const files=new Map();let uploads=0,downloads=0;
 const client={storage:{from(){return {async upload(path,blob){uploads++;files.set(path,blob);return {}},async download(path){downloads++;return {data:files.get(path)}}}}}};
 const codec=createAssetCodec(client,OWNER),db=await openLocalDatabase('assets-a'),db2=await openLocalDatabase('assets-b');
 const original={id:'photo',manualThumbnail:new Blob(['hello'],{type:'image/jpeg'})},packed=await codec.pack(original,db);await codec.pack({...original,title:'수정'},db);assert.equal(uploads,1);assert.ok(!JSON.stringify(packed).includes('hello'));
 const restored=await codec.unpack(packed,db2);assert.equal(await restored.manualThumbnail.text(),'hello');await codec.unpack(packed,db2);assert.equal(downloads,1);db.close();db2.close();
});

test('closet queue survives old server constraints and restores separated collections on a new device',async()=>{
 const srv=server(),a=await device(srv,'closet-wire-a');
 const names=['closet-inbox','closet-checklists','closet-inventory-outfits'];
 for(const name of names)await a.save(name,{id:'same-id',userId:OWNER,title:name,path:OWNER+'/inbox/photo.jpg',tags:['보라']});
 srv.setFail(true);await a.sync();assert.equal(a.getStatus().pending,3);a.close();
 const resumed=await device(srv,'closet-wire-a');srv.setFail(false);await resumed.sync();
 assert.equal(resumed.getStatus().phase,'synced');assert.equal(resumed.getStatus().pending,0);
 assert.ok(srv.events.every(e=>e.collection==='collection'&&e.item_id.length<=100));
 const b=await device(srv,'closet-wire-b');await b.sync();
 for(const name of names){assert.equal((await b.list(name))[0].title,name);assert.deepEqual((await b.list(name))[0].tags,['보라'])}
 assert.deepEqual(await b.list('collection'),[]);
 await resumed.save(names[2],{id:'same-id',title:'수정'});await resumed.sync();await b.sync();
 assert.equal((await b.list(names[2]))[0].title,'수정');
 await b.remove(names[2],'same-id');await b.sync();await resumed.sync();
 assert.deepEqual(await resumed.list(names[2]),[]);assert.equal((await resumed.list(names[0])).length,1);
 resumed.close();b.close();
});
test('new CLOSET collections survive DB constraint, retry and cross-device roundtrip',async()=>{
 const srv=server(),a=await device(srv,'closet-new-a');
 const names=['closet-notes-v1','closet-lookbook-boards','closet-shopping','closet-future-collection'];
 for(const name of names)await a.save(name,{id:'same-id',title:name});
 srv.setFail(true);await a.sync();assert.equal(a.getStatus().pending,names.length);a.close();
 const resumed=await device(srv,'closet-new-a');srv.setFail(false);await resumed.sync();
 assert.equal(resumed.getStatus().pending,0);
 assert.ok(srv.events.every(e=>e.collection==='collection'&&e.item_id.length<=100));
 const b=await device(srv,'closet-new-b');await b.sync();
 for(const name of names)assert.equal((await b.list(name))[0].title,name);
 assert.deepEqual(await b.list('collection'),[]);
 await b.remove(names[0],'same-id');await b.sync();await resumed.sync();
 assert.deepEqual(await resumed.list(names[0]),[]);
 for(const name of names.slice(1))assert.equal((await resumed.list(name))[0].title,name);
 resumed.close();b.close();
});
test('closet conflict events decode back into the logical collection',async()=>{
 const srv=server(),a=await device(srv,'closet-conflict-a'),b=await device(srv,'closet-conflict-b'),collection='closet-inventory-outfits';
 await a.save(collection,{id:'look',title:'초안'});await a.sync();await b.sync();
 await a.save(collection,{id:'look',title:'기기A'});await b.save(collection,{id:'look',title:'기기B'});
 await a.sync();await b.sync();assert.equal(b.getStatus().conflicts,1);
 await b.resolveConflicts();await a.sync();assert.equal((await a.list(collection)).length,2);
 assert.deepEqual(await a.list('collection'),[]);a.close();b.close();
});
