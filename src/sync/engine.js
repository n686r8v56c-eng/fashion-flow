import {openLocalDatabase,transaction,readLegacy} from './localDatabase.js';
const TABLE='fashion_sync_events';
// The server only permits candidates, collection and products. Route every other
// logical collection through the existing collection namespace without touching local keys.
// Preserve the existing wire prefix for compatibility with already synced CLOSET data.
const SERVER_COLLECTIONS=new Set(['candidates','collection','products']);
const needsWireKey=collection=>!SERVER_COLLECTIONS.has(collection);
const WIRE_PREFIX='~fashion-closet-v1~';
function wireKey(collection,id){
 return needsWireKey(collection)?{collection:'collection',item_id:WIRE_PREFIX+collection+'~'+id}:{collection,item_id:id};
}
function localEvent(event){
 if(event?.collection!=='collection'||!event.item_id?.startsWith(WIRE_PREFIX))return event;
 const rest=event.item_id.slice(WIRE_PREFIX.length),separator=rest.indexOf('~'),collection=rest.slice(0,separator);
 return separator>0&&needsWireKey(collection)&&rest.slice(separator+1)?{...event,collection,item_id:rest.slice(separator+1)}:event;
}

const keyFor=(owner,collection,id)=>JSON.stringify([owner,collection,id]);
const uid=()=>crypto.randomUUID();
const clone=value=>structuredClone(value);
export async function createSyncEngine({client,userId,dbName='fashion-local-sync-v1',legacy=true,pack=async x=>x,unpack=async x=>x}){
 const db=await openLocalDatabase(dbName),listeners=new Set();let stopped=false,running=null;
 let status={phase:'local',pending:0,conflicts:0,lastSync:null,message:''};
 const all=()=>transaction(db,['records'],'readonly',tx=>tx.objectStore('records').getAll()).then(rows=>rows.filter(x=>x.owner===userId));
 const metaGet=k=>transaction(db,['meta'],'readonly',tx=>tx.objectStore('meta').get(k));
 const metaPut=(k,v)=>transaction(db,['meta'],'readwrite',tx=>tx.objectStore('meta').put(v,k));
 const emit=()=>{for(const listener of listeners)listener()};
 async function refreshStatus(patch={}){const rows=await all();status={...status,...patch,pending:rows.filter(x=>x.dirty).length,conflicts:rows.filter(x=>x.conflict).length};emit()}
 async function migrate(){
  if(!legacy)return;
  // Legacy collection/product databases had no owner. Claim them once on this browser;
  // never import the same unscoped data into a second account. Originals stay intact.
  const claim=await transaction(db,['meta'],'readwrite',tx=>{let owner;const store=tx.objectStore('meta'),r=store.get('legacy-owner');r.onsuccess=()=>{owner=r.result||userId;if(!r.result)store.put(owner,'legacy-owner')};return()=>owner});
  const sources=[['candidates','fashion-candidates-v1','notes'],['collection','fashion-collection-v1','links'],['products','fashion-price-tracker-v1','products']];
  for(const [collection,name,store] of sources){
   const flag='migrated:'+userId+':'+collection;if(await metaGet(flag))continue;
   const rows=(collection==='candidates'||claim===userId)?(await readLegacy(name,store)).filter(row=>collection!=='candidates'||row.user_id===userId):[];
   await transaction(db,['records','meta'],'readwrite',tx=>{const target=tx.objectStore('records');for(const payload of rows){const key=keyFor(userId,collection,payload.id),r=target.get(key);r.onsuccess=()=>{if(!r.result)target.put({key,owner:userId,collection,id:payload.id,payload,deleted:false,seq:0,dirty:true,mutationId:uid()})}}tx.objectStore('meta').put(true,flag)});
  }
 }
 async function list(collection){return (await all()).filter(x=>x.collection===collection&&!x.deleted).map(x=>clone(x.payload))}
 async function saveBatch(collection,payloads){
  if(stopped)throw Error('계정이 변경됐어요. 화면을 다시 열어 주세요.');
  await transaction(db,['records'],'readwrite',tx=>{const store=tx.objectStore('records');for(const payload of payloads){if(!payload?.id)throw Error('기록 ID가 없어요.');const key=keyFor(userId,collection,payload.id),r=store.get(key);r.onsuccess=()=>{const prior=r.result;store.put({...prior,key,owner:userId,collection,id:payload.id,payload:clone(payload),deleted:false,seq:prior?.seq||0,dirty:true,mutationId:uid()})}}});
  await refreshStatus({phase:'local'});
 }
 async function remove(collection,id){
  if(stopped)throw Error('계정이 변경됐어요.');
  await transaction(db,['records'],'readwrite',tx=>{const store=tx.objectStore('records'),key=keyFor(userId,collection,id),r=store.get(key);r.onsuccess=()=>{if(r.result)store.put({...r.result,deleted:true,dirty:true,mutationId:uid()})}});
  await refreshStatus({phase:'local'});
 }
 async function merge(event,payload){
  await transaction(db,['records'],'readwrite',tx=>{const store=tx.objectStore('records'),key=keyFor(userId,event.collection,event.item_id),r=store.get(key);r.onsuccess=()=>{
   const local=r.result;if(local&&local.seq>=event.seq)return;
   if(local?.dirty&&local.mutationId!==event.mutation_id){store.put({...local,conflict:{event,payload}});return}
   store.put({key,owner:userId,collection:event.collection,id:event.item_id,payload,deleted:event.deleted,seq:event.seq,dirty:false,mutationId:event.mutation_id});
  }});
 }
 async function pull(){
  const cursorKey='cursor:'+userId;let cursor=await metaGet(cursorKey)||0;
  while(!stopped){
   const {data,error}=await client.from(TABLE).select('seq,collection,item_id,payload,deleted,mutation_id').eq('user_id',userId).gt('seq',cursor).order('seq').limit(100);if(error)throw error;
   for(const event of data||[]){if(stopped)return;const payload=event.deleted?{}:await unpack(event.payload,db);await merge(localEvent(event),payload);cursor=event.seq;await metaPut(cursorKey,cursor)}
   if((data||[]).length<100)break;
  }
 }
 async function push(){
  const pending=(await all()).filter(row=>row.dirty&&!row.conflict);
  for(let offset=0;offset<pending.length&&!stopped;offset+=20){
   const batch=pending.slice(offset,offset+20),changes=[];
   for(const row of batch)changes.push({...wireKey(row.collection,row.id),payload:row.deleted?{}:await pack(row.payload,db),deleted:row.deleted,base_seq:row.seq,mutation_id:row.mutationId});
   if(stopped)return;
   const {data,error}=await client.rpc('fashion_sync_push',{changes});if(error)throw error;
   for(const result of data||[]){const original=batch.find(row=>row.mutationId===result.mutation_id);if(!original)continue;
    if(result.status==='conflict'){const event=localEvent(result.event);await merge(event,event.deleted?{}:await unpack(event.payload,db));continue}
    await transaction(db,['records'],'readwrite',tx=>{const store=tx.objectStore('records'),r=store.get(original.key);r.onsuccess=()=>{const current=r.result;if(!current)return;if(current.mutationId===original.mutationId)store.put({...current,seq:result.seq,dirty:false,conflict:undefined});else if(!current.conflict)store.put({...current,seq:result.seq})}});
   }
  }
 }
 async function sync(){
  if(stopped)return;if(running)return running;
  running=(async()=>{try{
   if(globalThis.navigator?.onLine===false){await refreshStatus({phase:'offline',message:'오프라인 · 기기에 저장됨'});return}
   await refreshStatus({phase:'syncing',message:''});
   await pull();if(stopped)return;await push();if(stopped)return;await pull();if(stopped)return;
   const lastSync=Date.now();await metaPut('last-sync:'+userId,lastSync);await refreshStatus({phase:'synced',lastSync,message:''});
  }catch(error){if(!stopped)await refreshStatus({phase:/PGRST20[25]|42P01/.test(error.code||'')?'setup':'error',message:error.message||'동기화 실패. 기기 저장은 유지돼요.'})}finally{running=null}})();return running;
 }
 async function resolveConflicts(){
  for(const row of (await all()).filter(x=>x.conflict)){
   const {event,payload}=row.conflict;
   await transaction(db,['records'],'readwrite',tx=>{const store=tx.objectStore('records'),r=store.get(row.key);r.onsuccess=()=>{const current=r.result;if(current?.mutationId!==row.mutationId||current.conflict?.event.seq!==event.seq)return;
    if(!current.deleted){const id=uid(),copy={...current.payload,id};if(copy.title)copy.title+=' (기기 복사)';if(copy.name)copy.name+=' (기기 복사)';if(copy.title_key)copy.title_key+=' '+id;store.put({key:keyFor(userId,row.collection,id),owner:userId,collection:row.collection,id,payload:copy,seq:0,deleted:false,dirty:true,mutationId:uid()})}
    store.put({key:row.key,owner:userId,collection:row.collection,id:row.id,payload,seq:event.seq,deleted:event.deleted,dirty:false,mutationId:event.mutation_id});
   }});
  }await refreshStatus();await sync();
 }
 await migrate();await refreshStatus({lastSync:await metaGet('last-sync:'+userId)||null});
 return {userId,list,save:(collection,payload)=>saveBatch(collection,[payload]),saveBatch,remove,sync,resolveConflicts,getStatus:()=>({...status}),subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},close(){stopped=true;listeners.clear();/* Keep DB open until any in-flight IDB work has settled. */},exportAll:()=>all()};
}
