import React,{useEffect,useState}from'react';
export const PREFIX='cosmetic-storage:';
const BUCKET='wardrobe';
let mediaClient=null;
export const configureMedia=client=>{mediaClient=client};
const cache=new Map();
export const isStored=value=>typeof value==='string'&&value.startsWith(PREFIX);
export function makeUploader(supabase,userId,compress){
 return async(file)=>{if(!file)return '';if(!userId)throw Error('로그인 후 사진을 등록해 줘.');const compressed=await compress(file);const response=await fetch(compressed);const blob=await response.blob();const path=userId+'/'+crypto.randomUUID()+'.jpg';const {error}=await supabase.storage.from(BUCKET).upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw Error('사진 업로드 실패: '+error.message+' (Supabase Storage SQL 설정 확인)');return PREFIX+path};
}
export async function getImageUrl(supabase,value){if(!isStored(value))return value||'';const hit=cache.get(value);if(hit&&hit.expiry>Date.now())return hit.url;const path=value.slice(PREFIX.length);const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(path,3600);if(error)throw error;cache.set(value,{url:data.signedUrl,expiry:Date.now()+50*60*1000});return data.signedUrl}
export function CosmeticImg({supabase=mediaClient,value,alt='',...props}){const[src,setSrc]=useState(isStored(value)?'':(value||''));useEffect(()=>{let alive=true;if(!isStored(value)){setSrc(value||'');return()=>{alive=false}}getImageUrl(supabase,value).then(url=>{if(alive)setSrc(url)}).catch(()=>{if(alive)setSrc('')});return()=>{alive=false}},[supabase,value]);return <img {...props} src={src||undefined} alt={alt}/> }
export function CosmeticZoom({supabase=mediaClient,value,...props}){const[src,setSrc]=useState('');useEffect(()=>{let alive=true;getImageUrl(supabase,value).then(url=>{if(alive)setSrc(url)});return()=>{alive=false}},[supabase,value]);return src?<img {...props} src={src} alt="확대"/>:null}

export function CosmeticUsage({supabase=mediaClient,userId}){const[usage,setUsage]=useState(null),[message,setMessage]=useState('');useEffect(()=>{let live=true;if(!supabase||!userId)return;(async()=>{let size=0,count=0,offset=0;while(offset<10000){const{data,error}=await supabase.storage.from(BUCKET).list(userId,{limit:1000,offset});if(error)throw error;const files=(data||[]).filter(x=>x.name&&!x.name.startsWith('.'));for(const file of files){count++;size+=Number(file.metadata?.size||0)}if((data||[]).length<1000)break;offset+=1000}if(live)setUsage({size,count})})().catch(e=>{if(live)setMessage(e.message)});return()=>{live=false}},[supabase,userId]);return <div className="cf-storage-usage"><b>Cosmetic Flow 사진 저장량</b>{usage?<small>{usage.count.toLocaleString()}장 · {(usage.size/1024/1024).toFixed(1)} MB</small>:<small>{message||'확인 중…'}</small>}<small>새 전용 버킷에 업로드한 사진 기준 · Supabase 전체 사용량과는 별도</small></div>}
