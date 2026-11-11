import {openLocalDatabase,transaction} from './sync/localDatabase.js';
let database;const urls=new Map(),pending=new Map();
export async function cachedPhoto(client,path){
 const {data:{session}}=await client.auth.getSession();const owner=session?.user?.id;
 if(!owner)return null;
 const key=JSON.stringify([owner,path]);if(urls.has(key))return urls.get(key);if(pending.has(key))return pending.get(key);
 const work=(async()=>{let db,blob;try{db=await(database||(database=openLocalDatabase('fashion-photo-cache-v1')));blob=await transaction(db,['assets'],'readonly',tx=>tx.objectStore('assets').get(key))}catch{}
  if(!blob){const {data,error}=await client.storage.from('wardrobe').download(path);if(error)throw error;blob=data;if(db)try{await transaction(db,['assets'],'readwrite',tx=>tx.objectStore('assets').put(blob,key))}catch{}}
  const url=URL.createObjectURL(blob);urls.set(key,url);return url;
 })();pending.set(key,work);try{return await work}finally{pending.delete(key)}
}
export function clearPhotoUrls(){for(const url of urls.values())URL.revokeObjectURL(url);urls.clear()}
export async function compressPhoto(file){
 const url=URL.createObjectURL(file);
 try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('사진을 읽지 못했어요.'));image.src=url});
  const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight));
  if(scale===1&&file.size<=250*1024)return file;
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  // Preserve alpha for cut-out wardrobe images used on the outfit canvas.
  const type=/image\/(png|webp)/.test(file.type)?'image/png':'image/jpeg';
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,.78));if(!blob)throw Error('사진 압축에 실패했어요.');return blob.size<file.size||scale<1?blob:file;
 }finally{URL.revokeObjectURL(url)}
}
