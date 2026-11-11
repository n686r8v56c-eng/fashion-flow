import {cachedPhoto,compressPhoto,clearPhotoUrls} from './photoCache.js';
import{createClient}from'@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured=Boolean(url&&key&&!url.includes('YOUR_PROJECT'));
export const supabase=configured?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
if(supabase)supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')clearPhotoUrls()});
export async function uploadPhoto(file,userId){
 if(!supabase)throw Error('Supabase 연결이 필요합니다.');
 if(!file?.type?.startsWith('image/'))throw Error('이미지 파일만 가능합니다.');
 if(file.size>10*1024*1024)throw Error('사진은 10MB 이하로 등록해 주세요.');
 const blob=await compressPhoto(file),ext=blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg';
 const path=`${userId}/${crypto.randomUUID()}.${ext}`;
 const {error}=await supabase.storage.from('wardrobe').upload(path,blob,{upsert:false,contentType:blob.type,cacheControl:'31536000'});
 if(error)throw error;return path;
}
export async function photoUrl(path){if(!path||!supabase)return null;try{return await cachedPhoto(supabase,path)}catch(error){console.warn('사진 불러오기 실패:',error.message);return null}}
