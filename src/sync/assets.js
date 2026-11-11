import {transaction} from './localDatabase.js';
const PREFIX='__fashion_sync_asset_v1';
const dataUrl=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob)});
export function createAssetCodec(client,userId){
 const keyFor=hash=>userId+':'+hash;
 async function read(db,hash){return transaction(db,['assets'],'readonly',tx=>tx.objectStore('assets').get(keyFor(hash)))}
 async function write(db,hash,row){return transaction(db,['assets'],'readwrite',tx=>tx.objectStore('assets').put(row,keyFor(hash)))}
 async function pack(value,db){
  const isData=typeof value==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(value);
  if(value instanceof Blob||isData){
   const blob=isData?await(await fetch(value)).blob():value;
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const path=userId+'/sync/'+hash;const cached=await read(db,hash);
   if(!cached?.uploaded){const {error}=await client.storage.from('wardrobe').upload(path,blob,{upsert:false,contentType:blob.type,cacheControl:'31536000'});if(error&&String(error.statusCode)!=='409'&&error.error!=='Duplicate')throw error;await write(db,hash,{blob,uploaded:true})}
   return {[PREFIX]:hash,as:isData?'dataURL':'blob'};
  }
  if(Array.isArray(value))return Promise.all(value.map(x=>pack(x,db)));
  if(value&&typeof value==='object'){const result={};for(const [key,item] of Object.entries(value))result[key]=await pack(item,db);return result}
  return value;
 }
 async function unpack(value,db){
  if(value?.[PREFIX]){
   const hash=value[PREFIX];if(!/^[a-f0-9]{64}$/.test(hash))throw Error('사진 참조가 올바르지 않아요.');
   let cached=await read(db,hash);
   if(!cached){const {data,error}=await client.storage.from('wardrobe').download(userId+'/sync/'+hash);if(error)throw error;cached={blob:data,uploaded:true};await write(db,hash,cached)}
   return value.as==='dataURL'?dataUrl(cached.blob):cached.blob;
  }
  if(Array.isArray(value))return Promise.all(value.map(x=>unpack(x,db)));
  if(value&&typeof value==='object'){const result={};for(const [key,item] of Object.entries(value))result[key]=await unpack(item,db);return result}
  return value;
 }
 return {pack,unpack};
}
