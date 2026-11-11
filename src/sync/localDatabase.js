export function openLocalDatabase(name='fashion-local-sync-v1') {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(name,1);
  request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('records',{keyPath:'key'});db.createObjectStore('meta');db.createObjectStore('assets')};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(Error('다른 탭을 닫고 다시 열어 주세요.'));
 });
}
export async function transaction(db,stores,mode,work){
 return new Promise((resolve,reject)=>{const tx=db.transaction(stores,mode);let result;
  try{result=work(tx)}catch(error){tx.abort();reject(error);return}
  tx.oncomplete=()=>resolve(typeof result==='function'?result():result?.result);
  tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('저장이 취소됐어요.'));
 });
}
export async function readLegacy(name,store){
 let db;
 try{db=await new Promise((resolve,reject)=>{const request=indexedDB.open(name);request.onupgradeneeded=()=>request.transaction.abort();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('기존 저장소를 사용 중인 탭을 닫아 주세요.'))})}
 catch(error){if(error?.name==='AbortError')return [];throw error}
 try{if(!db.objectStoreNames.contains(store))return [];return await transaction(db,[store],'readonly',tx=>tx.objectStore(store).getAll())}finally{db.close()}
}
