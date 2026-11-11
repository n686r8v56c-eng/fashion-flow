import {openLocalDatabase,transaction} from './sync/localDatabase.js';
let connection;
const flights=new Map();
const database=()=>connection||(connection=openLocalDatabase('fashion-server-cache-v1'));
export async function cachedRead(owner,key,loader,maxAge=5*60*1000){
 const cacheKey=JSON.stringify([owner,key]);if(flights.has(cacheKey))return flights.get(cacheKey);
 const work=(async()=>{let db,cached;try{db=await database();cached=await transaction(db,['meta'],'readonly',tx=>tx.objectStore('meta').get(cacheKey))}catch{}
  if(cached&&Date.now()-cached.at<maxAge)return cached.value;
  try{const value=await loader();if(db)await transaction(db,['meta'],'readwrite',tx=>tx.objectStore('meta').put({at:Date.now(),value},cacheKey));return value}catch(error){if(cached&&navigator.onLine===false)return cached.value;throw error}
 })();flights.set(cacheKey,work);try{return await work}finally{flights.delete(cacheKey)}
}
export async function invalidateRead(owner,key){try{const db=await database();await transaction(db,['meta'],'readwrite',tx=>tx.objectStore('meta').delete(JSON.stringify([owner,key])))}catch{}}
export async function cacheValue(owner,key,value){try{const db=await database();await transaction(db,['meta'],'readwrite',tx=>tx.objectStore('meta').put({at:Date.now(),value},JSON.stringify([owner,key])))}catch{}}
