import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,ChevronUp,Link2,ExternalLink,Trash2,Plus,Pencil,ArrowUp,ArrowDown,RotateCcw,Download,Upload,X} from 'lucide-react';
import {BEAUTY_SEED_DRILLS} from './bodyBeautySeedDrills.js';
import './BodyVideoInboxLibrary.css';

const DEFAULT_LABELS=['마사지','이완','폼롤러','도구','SNPE'];
const VOICE_LEVEL_NAMES=['기초','음정','음색','기교','표현'];
// Source: Voice Flow drill catalog, exported 2026-11-06. Stable IDs prevent duplicate seeding.
const VOICE_SEED_DRILLS=[{"level":1,"sort":0,"en":"Appoggio","ko":"아포지오 · 호흡 지지"},{"level":1,"sort":1,"en":"Breath–Voice Coordination","ko":"호흡·성대 협응"},{"level":1,"sort":2,"en":"F–V Transition","ko":"F→V 전환"},{"level":1,"sort":3,"en":"S–Z Transition","ko":"S→Z 전환"},{"level":1,"sort":4,"en":"Lip Trill","ko":"립트릴"},{"level":1,"sort":5,"en":"Tongue Trill","ko":"텅트릴"},{"level":1,"sort":6,"en":"Straw Phonation","ko":"빨대 발성"},{"level":1,"sort":7,"en":"Water Resistance Phonation","ko":"물저항 발성"},{"level":1,"sort":8,"en":"Gentle Humming","ko":"허밍"},{"level":1,"sort":9,"en":"Easy Onset","ko":"부드러운 발성 시작"},{"level":1,"sort":10,"en":"Gentle Offset","ko":"부드러운 발성 종료"},{"level":1,"sort":11,"en":"Humming to Vowel","ko":"음→아 연결"},{"level":2,"sort":0,"en":"Single Note Matching","ko":"피아노 단음 따라 하기"},{"level":2,"sort":1,"en":"Pitch Accuracy","ko":"음정 정확도"},{"level":2,"sort":2,"en":"Semitone Steps","ko":"반음씩 상행·하행"},{"level":2,"sort":3,"en":"Interval Jumps","ko":"3도·5도·옥타브 도약"},{"level":2,"sort":4,"en":"Pitch Glide","ko":"피치 글라이드"},{"level":2,"sort":5,"en":"Siren","ko":"사이렌"},{"level":2,"sort":6,"en":"Range Expansion","ko":"음역 확장"},{"level":3,"sort":0,"en":"Chest Register","ko":"흉성"},{"level":3,"sort":1,"en":"Head Register","ko":"두성"},{"level":3,"sort":2,"en":"Mix Coordination","ko":"믹스 보이스"},{"level":3,"sort":3,"en":"Register Transition","ko":"성구 전환"},{"level":3,"sort":4,"en":"Vowel Resonance","ko":"모음·공명 조절"},{"level":3,"sort":5,"en":"Bright–Dark Tone","ko":"밝고 어두운 음색"},{"level":3,"sort":6,"en":"Light–Full Tone","ko":"가볍고 묵직한 음색"},{"level":3,"sort":7,"en":"M–N–NG Resonance","ko":"비음·공명 탐색"},{"level":4,"sort":0,"en":"Crescendo–Decrescendo","ko":"크레셴도·디크레셴도"},{"level":4,"sort":1,"en":"Messa di Voce","ko":"메사 디 보체"},{"level":4,"sort":2,"en":"Scale Agility","ko":"스케일 민첩성"},{"level":4,"sort":3,"en":"Arpeggio","ko":"아르페지오"},{"level":4,"sort":4,"en":"Melisma","ko":"멜리스마"},{"level":4,"sort":5,"en":"Legato","ko":"레가토"},{"level":4,"sort":6,"en":"Staccato","ko":"스타카토"},{"level":4,"sort":7,"en":"Vibrato","ko":"비브라토 조절"},{"level":4,"sort":8,"en":"Dynamic Control","ko":"음량 조절"},{"level":5,"sort":0,"en":"Sustained Tone","ko":"지속음·발성 안정성"},{"level":5,"sort":1,"en":"Long Phrase","ko":"긴 프레이즈·호흡 배분"},{"level":5,"sort":2,"en":"Clear Diction","ko":"자음·모음 딕션"},{"level":5,"sort":3,"en":"Semantic Pausing","ko":"의미 단위 쉼"},{"level":5,"sort":4,"en":"Musical Phrasing","ko":"프레이징"},{"level":5,"sort":5,"en":"Stress & Intonation","ko":"강세·억양"},{"level":5,"sort":6,"en":"Emotional Delivery","ko":"감정 표현"},{"level":5,"sort":7,"en":"Expressive Reading","ko":"표현 낭독"},{"level":5,"sort":8,"en":"Voice to Speech","ko":"발성에서 말하기 연결"}];

import {MAX_VIDEOS_PER_ITEM as MAX,normalizeVideoIds} from './bodyVideoLimits.js';
const groupKey=(area,group)=>area+':'+group;
const instagramUrl=raw=>{
 try{
  const u=new URL(String(raw||'').trim().replace(/^(?!https?:\/\/)/,'https://'));
  if(!['instagram.com','www.instagram.com','m.instagram.com'].includes(u.hostname.toLowerCase()))return null;
  const p=u.pathname.split('/').filter(Boolean);
  if(!['reel','reels','p','tv'].includes(p[0])||!/^[-\w]+$/.test(p[1]||''))return null;
  return 'https://www.instagram.com/'+(p[0]==='reels'?'reel':p[0])+'/'+p[1]+'/';
 }catch{return null}
};
const instagramLinks=value=>[...new Set((Array.isArray(value)?value:[]).map(instagramUrl).filter(Boolean))].slice(0,5);
const nextId=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
const displayName=row=>row.en||row.title||row.ko||'이름 없음';
const videoId=raw=>{
 try{
  const u=new URL(String(raw).trim().replace(/^(?!https?:\/\/)/,'https://'));
  const host=u.hostname.toLowerCase();
  const id=host==='youtu.be'?u.pathname.split('/')[1]:['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)?(u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1]):null;
  return /^[\w-]{11}$/.test(id||'')?id:null;
 }catch{return null}
};
function download(name,object){
 const blob=new Blob([JSON.stringify(object,null,2)],{type:'application/json;charset=utf-8'});
 const link=document.createElement('a'),url=URL.createObjectURL(blob);
 link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),20000);
}
// Dedicated leg-swelling-care stretch starter set. IDs and version preserve user deletions/edits.
export const LEG_STRETCH_SEED=[
 {
  "id": "legs-stretch-v1-01",
  "area": "legs",
  "group": "stretch",
  "level": 1,
  "sort": 100,
  "title": "Wall Calf Stretch",
  "en": "Wall Calf Stretch",
  "ko": "벽 짚고 종아리 늘리기",
  "note": "벽에 손을 대고 한 다리를 뒤로 보내 뒤꿈치를 바닥에 둔다. 무릎을 편 채 20~30초 유지한 뒤 반대쪽도 반복한다. 통증 없이 부드럽게.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-02",
  "area": "legs",
  "group": "stretch",
  "level": 1,
  "sort": 101,
  "title": "Bent-Knee Soleus Stretch",
  "en": "Bent-Knee Soleus Stretch",
  "ko": "무릎 굽혀 가자미근 늘리기",
  "note": "벽을 짚고 뒤쪽 무릎을 살짝 굽힌 상태에서 뒤꿈치를 바닥에 붙인다. 종아리 아래쪽을 20~30초 부드럽게 늘린다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-03",
  "area": "legs",
  "group": "stretch",
  "level": 1,
  "sort": 102,
  "title": "Towel Calf Stretch",
  "en": "Towel Calf Stretch",
  "ko": "수건 이용 종아리 스트레치",
  "note": "앉아 다리를 뻗고 발바닥 앞쪽에 수건을 걸어 몸쪽으로 가볍게 당긴다. 20초 유지하고 반대쪽도 반복한다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-04",
  "area": "legs",
  "group": "stretch",
  "level": 2,
  "sort": 103,
  "title": "Ankle Pumps",
  "en": "Ankle Pumps",
  "ko": "발목 펌핑",
  "note": "앉거나 누워 발끝을 몸쪽으로 당겼다가 멀리 뻗는다. 편안한 범위에서 15~20회 리듬감 있게 반복한다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-05",
  "area": "legs",
  "group": "stretch",
  "level": 2,
  "sort": 104,
  "title": "Ankle Circles",
  "en": "Ankle Circles",
  "ko": "발목 원 그리기",
  "note": "발을 바닥에서 살짝 들고 발목으로 작은 원을 천천히 그린다. 시계·반시계 방향 각각 10회, 통증 없는 범위에서 한다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-06",
  "area": "legs",
  "group": "stretch",
  "level": 2,
  "sort": 105,
  "title": "Ankle Alphabet",
  "en": "Ankle Alphabet",
  "ko": "발목 알파벳 그리기",
  "note": "앉아 발을 든 뒤 발끝으로 공중에 알파벳을 그리듯 천천히 움직인다. 다리 전체보다 발목 움직임에 집중한다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-07",
  "area": "legs",
  "group": "stretch",
  "level": 3,
  "sort": 106,
  "title": "Toe Spreads",
  "en": "Toe Spreads",
  "ko": "발가락 벌리기",
  "note": "발뒤꿈치를 바닥에 둔 채 발가락을 넓게 벌렸다가 편안히 모은다. 10~15회 반복한다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-08",
  "area": "legs",
  "group": "stretch",
  "level": 3,
  "sort": 107,
  "title": "Plantar Fascia Stretch",
  "en": "Plantar Fascia Stretch",
  "ko": "발바닥 근막 스트레치",
  "note": "앉아서 한 발을 다른 허벅지 위에 올리고 발가락을 몸쪽으로 부드럽게 당긴다. 발바닥이 늘어나는 느낌으로 15~20초 유지한다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-09",
  "area": "legs",
  "group": "stretch",
  "level": 3,
  "sort": 108,
  "title": "Toe Flexion and Extension",
  "en": "Toe Flexion and Extension",
  "ko": "발가락 굽힘·폄",
  "note": "앉은 자세에서 발가락을 가볍게 움켜쥐었다가 길게 펴준다. 10~15회 천천히 반복한다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-10",
  "area": "legs",
  "group": "stretch",
  "level": 4,
  "sort": 109,
  "title": "Tibialis Anterior Stretch",
  "en": "Tibialis Anterior Stretch",
  "ko": "앞정강근 스트레치",
  "note": "의자에 앉아 발등이 부드럽게 펴지는 방향으로 발목을 움직인다. 발목 앞쪽에 통증이 없도록 무리하지 않는다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-11",
  "area": "legs",
  "group": "stretch",
  "level": 4,
  "sort": 110,
  "title": "Heel Walks",
  "en": "Heel Walks",
  "ko": "뒤꿈치 걷기",
  "note": "안전한 평지에서 발끝을 살짝 들어 뒤꿈치로 10~20걸음 천천히 걷는다. 균형이 불안하면 벽을 짚는다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-12",
  "area": "legs",
  "group": "stretch",
  "level": 4,
  "sort": 111,
  "title": "Seated Toe Raises",
  "en": "Seated Toe Raises",
  "ko": "앉아서 발끝 들기",
  "note": "의자에 앉아 뒤꿈치는 바닥에 두고 양쪽 발끝을 들어 올렸다 내린다. 15~20회 반복하며 앞정강근을 가볍게 움직인다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-13",
  "area": "legs",
  "group": "stretch",
  "level": 5,
  "sort": 112,
  "title": "Legs Up the Wall",
  "en": "Legs Up the Wall",
  "ko": "벽에 다리 올리기",
  "note": "누워서 종아리와 발을 벽에 편안히 기대고 3~5분 쉰다. 불편하거나 저림이 생기면 즉시 자세를 풀고, 허리와 목을 편하게 둔다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-14",
  "area": "legs",
  "group": "stretch",
  "level": 5,
  "sort": 113,
  "title": "Elevated Ankle Pumps",
  "en": "Elevated Ankle Pumps",
  "ko": "다리 올리고 발목 펌핑",
  "note": "누워 종아리를 쿠션에 올린 채 발끝을 몸쪽으로 당겼다 뻗기를 15~20회 반복한다.",
  "archived": false,
  "videos": []
 },
 {
  "id": "legs-stretch-v1-15",
  "area": "legs",
  "group": "stretch",
  "level": 5,
  "sort": 114,
  "title": "Supine Heel Slides",
  "en": "Supine Heel Slides",
  "ko": "누워서 뒤꿈치 미끄러뜨리기",
  "note": "바로 누운 자세에서 한쪽 뒤꿈치를 바닥에 붙인 채 엉덩이 쪽으로 끌어당겼다가 다시 다리를 편다. 좌우 각각 10회 부드럽게 움직인다.",
  "archived": false,
  "videos": []
 }
];
export function seedBodyCatalog(value){
 const items=[...(value?.items||[])],keys=new Set(items.map(x=>x.id));
 if(Number(value?.beautyCatalogSeedVersion)<1){
 for(const area of ['lower','upper']){
  for(const group of ['massage','stretch','bodyweight','machine']){
   for(const [sort,drill] of BEAUTY_SEED_DRILLS.entries()){
    const id='beauty-template:'+area+':'+group+':'+drill.id;
    if(keys.has(id))continue;
    const level=drill.id===51?1:Math.ceil(drill.id/10);
    items.push({id,area,group,level,sort:1000+sort,archived:false,title:drill.en,en:drill.en,ko:drill.ko,note:'',videos:[]});
   }
  }
 }
 }
 if((Number(value?.legStretchSeedVersion)||0)<1){
  for(const drill of LEG_STRETCH_SEED){
   if(keys.has(drill.id)||items.some(x=>x.area==='legs'&&x.group==='stretch'&&String(x.en||x.title||'').trim().toLowerCase()===drill.en.toLowerCase()))continue;
   items.push({...drill});
  }
 }
 // Insert Voice Flow's 45 drills only into Face > Voice (internal group: stretch).
 // Keep pre-existing custom drills, video links, notes and archived state unchanged.
 for(const drill of VOICE_SEED_DRILLS){
  const id='voice-flow:face:stretch:'+drill.level+':'+drill.sort;
  if(keys.has(id)||items.some(x=>x.area==='face'&&x.group==='stretch'&&x.level===drill.level&&String(x.en||x.title||'').trim()===drill.en))continue;
  items.push({id,area:'face',group:'stretch',level:drill.level,sort:drill.sort,archived:false,title:drill.en,en:drill.en,ko:drill.ko,note:'',videos:[]});
 }
 const levelNames={...(value?.levelNames||{})};
 if(!levelNames['face:stretch'])levelNames['face:stretch']=VOICE_LEVEL_NAMES;
 return {...value,items,levelNames,beautyCatalogSeedVersion:1,legStretchSeedVersion:Math.max(1,Number(value?.legStretchSeedVersion)||0)};
}
export default function CareLibrary({data,onUpdate,area,group,sync,readOnly=false,database=null,userId=null}){
 const [level,setLevel]=useState(1);
 const [editingMode,setEditingMode]=useState(false);
 const [showDeleted,setShowDeleted]=useState(false);
 const [opened,setOpened]=useState(null);
 const [active,setActive]=useState({});
 const [editor,setEditor]=useState(null);
 const [draft,setDraft]=useState({en:'',ko:'',level:1,note:''});
 const [message,setMessage]=useState('');
 const [thumbnailSigned,setThumbnailSigned]=useState({});
 const [thumbnailBusy,setThumbnailBusy]=useState('');

 const [showRecovery,setShowRecovery]=useState(false);
 const [showImport,setShowImport]=useState(false);
 const [levelRename,setLevelRename]=useState(null);
 const [renameText,setRenameText]=useState('');
 const timer=useRef(null),wasLongPress=useRef(false);
 const labels=Array.from({length:5},(_,i)=>data.levelNames?.[groupKey(area,group)]?.[i]||(area==='face'&&group==='stretch'?VOICE_LEVEL_NAMES[i]:DEFAULT_LABELS[i]));
 useEffect(()=>{setLevel(1);setOpened(null);setEditingMode(false);setEditor(null);setShowDeleted(false);setShowRecovery(false)},[area,group]);
 const alertUser=text=>{setMessage(text)};
 const update=fn=>{if(readOnly)return;onUpdate(d=>{fn(d)})};
 const scoped=(data.items||[]).filter(x=>x.area===area&&x.group===group);
 const thumbnailPaths=[...new Set(scoped.flatMap(row=>Object.values(row.instagramThumbnails||{}).filter(path=>typeof path==='string'&&userId&&path.startsWith(userId+'/instagram/'))))];
 const thumbnailPathsKey=thumbnailPaths.join('|');
 useEffect(()=>{
  if(!database||!userId||!thumbnailPaths.length)return;
  let active=true;
  Promise.all(thumbnailPaths.map(async path=>{
   const {data:link,error}=await database.storage.from('wardrobe').createSignedUrl(path,3600);
   return [path,error?'':link?.signedUrl||''];
  })).then(entries=>{if(active)setThumbnailSigned(old=>({...old,...Object.fromEntries(entries)}))});
  return ()=>{active=false};
 },[database,userId,thumbnailPathsKey]);
 const uploadInstagramThumbnail=async(row,url,file)=>{
  if(!file||readOnly)return;
  if(!database||!userId){alertUser('Supabase 로그인이 필요해.');return}
  const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  if(!extensions[file.type]){alertUser('JPG, PNG, WEBP 사진을 선택해 줘.');return}
  if(file.size>5*1024*1024){alertUser('사진은 5MB 이하로 선택해 줘.');return}
  setThumbnailBusy(url);
  try{
   const path=userId+'/instagram/'+nextId()+'.'+extensions[file.type];
   const {error}=await database.storage.from('wardrobe').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
   if(error)throw error;
   const {data:link,error:signError}=await database.storage.from('wardrobe').createSignedUrl(path,3600);
   if(signError)throw signError;
   setThumbnailSigned(old=>({...old,[path]:link.signedUrl}));
   update(d=>{
    const target=d.items.find(x=>x.id===row.id);
    if(target&&instagramsFor(target).includes(url))target.instagramThumbnails={...(target.instagramThumbnails||{}),[url]:path};
   });
   alertUser('인스타 썸네일 저장 완료');
  }catch(e){alertUser('사진 업로드 실패: '+(e.message||'Storage 버킷 설정을 확인해 줘.'))}
  finally{setThumbnailBusy('')}
 };
 const ordered=scoped.filter(x=>!x.archived).sort((a,b)=>(a.level||1)-(b.level||1)||(a.sort||0)-(b.sort||0)||String(a.id).localeCompare(String(b.id)));
 const visible=ordered.filter(x=>(x.level||1)===level);
 const archived=scoped.filter(x=>x.archived).sort((a,b)=>(a.level||1)-(b.level||1)||(a.sort||0)-(b.sort||0));
 const numberById=new Map(ordered.map((row,i)=>[row.id,i+1]));
 const videosFor=row=>normalizeVideoIds(row?.videos);
 const instagramsFor=row=>instagramLinks(row?.instagramLinks);
 const linksFor=row=>[...videosFor(row).map(id=>({type:'youtube',id,url:'https://www.youtube.com/watch?v='+id})),...instagramsFor(row).map(url=>({type:'instagram',id:url,url}))];
 const openNew=()=>{setDraft({en:'',ko:'',level,note:''});setEditor({mode:'add'})};
 const openEdit=row=>{setDraft({en:row.en||row.title||'',ko:row.ko||'',level:row.level||1,note:row.note||''});setEditor({mode:'edit',id:row.id})};
 const submitItem=e=>{
  e.preventDefault();
  const en=draft.en.trim(),ko=draft.ko.trim(),target=Number(draft.level),note=draft.note||'';
  if(!en&&!ko){alertUser('영문 또는 한글 이름을 입력해 줘.');return}
  if(editor?.mode==='edit'){
   update(d=>{
    const row=d.items.find(x=>x.id===editor.id);
    if(!row)return;
    const moving=row.level!==target;
    const end=Math.max(-1,...d.items.filter(x=>x.area===area&&x.group===group&&x.level===target).map(x=>x.sort||0))+1;
    Object.assign(row,{title:en||ko,en,ko,level:target,note,sort:moving?end:row.sort});
   });
  }else{
   const end=Math.max(-1,...scoped.filter(x=>x.level===target).map(x=>x.sort||0))+1;
   update(d=>d.items.push({id:nextId(),area,group,level:target,sort:end,archived:false,title:en||ko,en,ko,note,videos:[]}));
  }
  setLevel(target);setEditor(null);alertUser('동작 목록을 저장했어.');
 };
 const reorder=(row,direction)=>{
  const at=visible.findIndex(x=>x.id===row.id),other=visible[at+direction];
  if(!other)return;
  update(d=>{const first=d.items.find(x=>x.id===row.id),second=d.items.find(x=>x.id===other.id);const old=first.sort;first.sort=second.sort;second.sort=old});
 };
 const archive=row=>{
  if(!confirm(displayName(row)+' 동작을 목록에서 삭제할까? 영상은 그대로 보관돼.'))return;
  update(d=>{const found=d.items.find(x=>x.id===row.id);if(found)found.archived=true});
  setOpened(null);alertUser('목록에서 숨겼어. 편집 모드에서 복구할 수 있어.');
 };
 const restore=row=>{
  update(d=>{const found=d.items.find(x=>x.id===row.id);if(found)found.archived=false});
  alertUser('목록에 복구했어.');
 };
 const addVideos=(row,raw)=>{
  const pasted=String(raw||'').trim();
  const rawLinks=pasted.match(/(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com|instagram\.com)\/[^\s,，]+/gi)||[pasted];
  const youTubeIds=[...new Set(rawLinks.map(videoId).filter(Boolean))];
  const instagramUrls=[...new Set(rawLinks.map(instagramUrl).filter(Boolean))];
  if(!youTubeIds.length&&!instagramUrls.length){alertUser('YouTube 또는 Instagram 릴스·게시물 주소를 입력해 줘.');return}
  const existing=linksFor(row);
  const limit=Math.max(0,MAX-existing.length);
  if(!limit){alertUser('영상 링크는 한 동작에 최대 5개까지 등록 가능해.');return}
  const fresh=[...youTubeIds.filter(id=>!videosFor(row).includes(id)).map(id=>({type:'youtube',id})),...instagramUrls.filter(url=>!instagramsFor(row).includes(url)).map(url=>({type:'instagram',url}))].slice(0,limit);
  if(!fresh.length){alertUser('이미 등록된 영상이야.');return}
  update(d=>{
   const found=d.items.find(x=>x.id===row.id);
   if(!found)return;
   found.videos=[...videosFor(found),...fresh.filter(x=>x.type==='youtube').map(x=>x.id)];
   found.instagramLinks=[...instagramsFor(found),...fresh.filter(x=>x.type==='instagram').map(x=>x.url)];
  });
  setOpened(row.id);setActive(v=>({...v,[row.id]:existing.length}));
  alertUser('영상 링크 '+fresh.length+'개 등록 완료');
 };
 const addFromClipboard=async row=>{
  if(linksFor(row).length>=MAX){setOpened(row.id);alertUser('영상은 최대 5개까지 등록 가능해.');return}
  let pasted='';
  try{
   if(!navigator.clipboard?.readText)throw new Error('clipboard unavailable');
   pasted=await navigator.clipboard.readText();
  }catch{
   // Safari on iOS may deny clipboard reads. Use a temporary native prompt,
   // never leave the old inline link form visible beneath the video.
   pasted=window.prompt('YouTube 또는 Instagram 링크를 붙여넣어 줘.','')||'';
  }
  if(!pasted.trim())return;
  addVideos(row,pasted);
 };
 const copyLink=async id=>{
  const url='https://www.youtube.com/watch?v='+id;
  try{await navigator.clipboard.writeText(url);alertUser('링크 복사 완료')}
  catch{alertUser('링크 복사가 차단됐어. 영상 열기를 이용해 줘.')}
 };
 const removeVideo=(row,index)=>{
  if(!confirm('이 영상 링크를 삭제할까?'))return;
  const link=linksFor(row)[index];
  if(!link)return;
  update(d=>{
   const found=d.items.find(x=>x.id===row.id);
   if(!found)return;
   if(link.type==='youtube')found.videos=videosFor(found).filter(id=>id!==link.id);
   else{
    found.instagramLinks=instagramsFor(found).filter(url=>url!==link.url);
    if(found.instagramThumbnails){found.instagramThumbnails={...found.instagramThumbnails};delete found.instagramThumbnails[link.url]}
   }
  });
  setActive(v=>({...v,[row.id]:0}));
 };
 const exportBackup=()=>{
  const now=new Date(),stamp=now.toISOString().slice(0,16).replace(/[T:]/g,'-');
  download('body-care-studio-'+stamp+'.json',{format:'body-care-studio-v1',exportedAt:now.toISOString(),...data});
  alertUser('모든 분류와 영상 링크를 JSON으로 백업했어.');
 };
 const importBackup=async file=>{
  if(!file)return;
  try{
   const raw=JSON.parse(await file.text());
   if(!Array.isArray(raw.items)||!['body-care-studio-v1','body-care-studio-v2'].includes(raw.format))throw Error('Body Care Studio 백업 파일이 아니야.');
   if(!confirm('현재 목록을 보존하면서 새 항목만 추가할까?'))return;
   update(d=>{
    const ids=new Set(d.items.map(x=>x.id));
    raw.items.forEach(x=>{if(x?.id&&!ids.has(x.id)&&['upper','lower','face','core'].includes(x.area)&&['massage','stretch','bodyweight','machine'].includes(x.group)){d.items.push({...x,level:Number(x.level)||1,archived:!!x.archived,videos:normalizeVideoIds(x.videos),instagramLinks:instagramLinks(x.instagramLinks),instagramThumbnails:x.instagramThumbnails||{}});ids.add(x.id)}});
    d.levelNames={...(raw.levelNames||{}),...(d.levelNames||{})};
   });setShowImport(false);alertUser('JSON 백업에서 새 항목을 가져왔어.');
  }catch(e){alertUser('백업 가져오기 실패: '+e.message)}
 };
 const chooseLevel=n=>{if(wasLongPress.current){wasLongPress.current=false;return}setLevel(n);setOpened(null)};
 const startPress=n=>{clearTimeout(timer.current);wasLongPress.current=false;timer.current=setTimeout(()=>{wasLongPress.current=true;setLevelRename(n);setRenameText(labels[n-1])},550)};
 const stopPress=()=>clearTimeout(timer.current);
 const saveRename=e=>{
  e.preventDefault();
  const name=renameText.trim().slice(0,20);
  if(!name)return;
  update(d=>{
   const key=groupKey(area,group),current=Array.from({length:5},(_,i)=>d.levelNames?.[key]?.[i]||DEFAULT_LABELS[i]);
   d.levelNames={...(d.levelNames||{}),[key]:current.map((x,i)=>i===levelRename-1?name:x)};
  });
  setLevelRename(null);alertUser('단계 이름 저장 완료');
 };
 const recovered=scoped.filter(x=>linksFor(x).length);
 const totalSavedVideos=recovered.reduce((sum,x)=>sum+linksFor(x).length,0);
 return <div className="stretching-page">
  <div className="care-page-title"><h1>{data.groupNames?.[groupKey(area,group)]||({massage:'마사지',stretch:'스트레치',bodyweight:'맨몸근력',machine:'기계근력'})[group]}</h1></div>
  <div className="stretching-levels" role="tablist" aria-label="바디케어 단계">
   {labels.map((name,i)=><button key={i} type="button" role="tab" aria-selected={level===i+1} className={level===i+1?'active':''}
     onPointerDown={()=>startPress(i+1)} onPointerUp={stopPress} onPointerCancel={stopPress} onPointerLeave={stopPress}
     onContextMenu={e=>{e.preventDefault();stopPress();wasLongPress.current=true;setLevelRename(i+1);setRenameText(name)}}
     onClick={()=>chooseLevel(i+1)}><span>Lv.{i+1}</span><strong>{name}</strong></button>)}
  </div>

  <div className="stretching-list-heading"><strong>LEVEL {level} · {labels[level-1]}</strong>
   <div className="stretching-header-actions"><span>{visible.length} Drill</span>
    <button type="button" disabled={readOnly} onClick={openNew} aria-label="동작 추가" title="동작 추가"><Plus size={17}/></button>
    <button type="button" disabled={readOnly} className={editingMode?'active':''} onClick={()=>setEditingMode(x=>!x)}><Pencil size={15}/> 편집</button>
   </div>
  </div>
  <div className="stretching-drills">{visible.map(row=>{
   const arr=linksFor(row),expanded=opened===row.id,index=Math.min(active[row.id]||0,Math.max(0,arr.length-1));
   return <div className="stretching-drill" key={row.id}>
    <div className="stretching-drill-row">
     <button type="button" className="stretching-drill-toggle" aria-expanded={expanded} onClick={()=>{setOpened(expanded?null:row.id)}}>
      <span className="stretching-drill-number">{String(numberById.get(row.id)).padStart(2,'0')}</span>
      <span className="stretching-drill-name"><strong>{displayName(row)}</strong>{row.ko&&<small>{row.ko}</small>}</span>
      {expanded?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
     </button>
     {editingMode&&!readOnly?<div className="stretching-edit-controls">
      <button type="button" aria-label="위로 이동" disabled={visible[0]?.id===row.id} onClick={()=>reorder(row,-1)}><ArrowUp size={15}/></button>
      <button type="button" aria-label="아래로 이동" disabled={visible.at(-1)?.id===row.id} onClick={()=>reorder(row,1)}><ArrowDown size={15}/></button>
      <button type="button" aria-label="동작 수정" onClick={()=>openEdit(row)}><Pencil size={15}/></button>
      <button type="button" aria-label="동작 삭제" onClick={()=>archive(row)}><Trash2 size={15}/></button>
     </div>:!readOnly&&<button type="button" className="stretching-link-button" aria-label={displayName(row)+' 영상 추가'} onClick={()=>addFromClipboard(row)}><Link2 size={20}/></button>}
    </div>
    {expanded&&<div className="stretching-video-detail">
     {arr.length?<>
      {arr.length>1&&<div className="stretching-video-switch">{arr.map((v,i)=><button type="button" key={v} className={index===i?'active':''} onClick={()=>setActive(a=>({...a,[row.id]:i}))}>영상 {i+1}</button>)}</div>}
      {arr[index]?.type==='youtube'?<div className="stretching-video-frame"><iframe title={displayName(row)+' 영상'} key={arr[index].id} src={'https://www.youtube-nocookie.com/embed/'+arr[index].id+'?playsinline=1'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen loading="lazy"/></div>:<div className="stretching-no-video">
       {thumbnailSigned[row.instagramThumbnails?.[arr[index]?.url]]?<a href={arr[index].url} target="_blank" rel="noopener noreferrer" style={{width:'100%',display:'block'}}><img src={thumbnailSigned[row.instagramThumbnails[arr[index].url]]} alt={displayName(row)+' Instagram 대표 사진'} style={{display:'block',width:'100%',maxHeight:340,objectFit:'contain',borderRadius:10}}/></a>:<><strong>Instagram 영상 북마크</strong><span>직접 썸네일을 올리거나 Instagram에서 열 수 있어.</span></>}
       {!readOnly&&<label style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,padding:'10px 12px',border:'1px solid #c4a9dc',borderRadius:10,cursor:thumbnailBusy?'wait':'pointer',fontSize:13}}>
        {thumbnailBusy===arr[index].url?'업로드 중...':row.instagramThumbnails?.[arr[index].url]?'썸네일 변경':'사진으로 썸네일 등록'}
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!thumbnailBusy} style={{display:'none'}} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadInstagramThumbnail(row,arr[index].url,file);e.target.value=''}}/>
       </label>}
      </div>}
      <div className="stretching-video-actions">
       <button type="button" onClick={()=>arr[index].type==='youtube'?copyLink(arr[index].id):navigator.clipboard.writeText(arr[index].url).then(()=>alertUser('링크 복사 완료')).catch(()=>alertUser('영상 열기를 이용해 줘.'))}><Link2 size={15}/> 링크 복사</button>
       <a href={arr[index].url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> {arr[index].type==='instagram'?'Instagram에서 열기':'영상 열기'}</a>
       {!readOnly&&<button type="button" onClick={()=>removeVideo(row,index)}><Trash2 size={15}/> 링크 삭제</button>}
       {!readOnly&&arr.length<MAX&&<button type="button" onClick={()=>addFromClipboard(row)}><Plus size={15}/> 영상 추가</button>}
      </div>
     </>:<div className="stretching-no-video"><strong>영상 링크 등록 대기</strong><span>오른쪽 링크 아이콘을 눌러 YouTube 또는 Instagram 주소를 등록해 줘.</span></div>}
    </div>}
   </div>
  })}</div>
  {!readOnly&&editingMode&&archived.length>0&&<div className="stretching-archive">
   <button type="button" className="stretching-archive-toggle" onClick={()=>setShowDeleted(v=>!v)}>삭제한 목록 {archived.length}개 {showDeleted?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
   {showDeleted&&archived.map(row=><div className="stretching-archived-row" key={row.id}><span>{displayName(row)} <small>{row.ko}</small></span><button type="button" onClick={()=>restore(row)}><RotateCcw size={15}/> 복구</button></div>)}
  </div>}
  {!readOnly&&<section className="stretching-recovery">
   <button type="button" className="stretching-recovery-toggle" onClick={()=>setShowRecovery(v=>!v)}><span>저장된 영상 확인 · {recovered.length}개 동작 / {totalSavedVideos}개 링크</span>{showRecovery?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button>
   {showRecovery&&<div className="stretching-recovery-list"><p>현재 바디케어 계정에 저장된 링크야. 숨긴 항목의 영상도 표시돼.</p>
    {!recovered.length&&<p>등록된 영상 링크가 없어.</p>}
    {recovered.map(row=><div className="stretching-recovery-row" key={row.id}><strong>{displayName(row)}{row.archived?' (목록에서 숨김)':''}</strong><div>{linksFor(row).map((link,i)=><a href={link.url} key={link.id} target="_blank" rel="noopener noreferrer">{link.type==='instagram'?'Instagram ':'YouTube '}{i+1} <ExternalLink size={13}/></a>)}</div></div>)}
   </div>}
  </section>}

  {message&&<div className="stretching-message" role="status">{message}</div>}
  {!readOnly&&editor&&<div className="stretching-modal-backdrop" onClick={()=>setEditor(null)}>
   <form className="stretching-modal" role="dialog" aria-modal="true" aria-label={editor.mode==='add'?'동작 추가':'동작 수정'} onClick={e=>e.stopPropagation()} onSubmit={submitItem}>
    <div className="stretching-modal-title"><strong>{editor.mode==='add'?'동작 추가':'동작 수정'}</strong><button type="button" aria-label="닫기" onClick={()=>setEditor(null)}><X size={19}/></button></div>
    <label>영문 이름<input value={draft.en} onChange={e=>setDraft(d=>({...d,en:e.target.value}))} maxLength={120} placeholder="예: Body Scan" autoFocus/></label>
    <label>한글 이름<input value={draft.ko} onChange={e=>setDraft(d=>({...d,ko:e.target.value}))} maxLength={120} placeholder="예: 신체 긴장 관찰"/></label>
     <label>분류<select value={draft.level} onChange={e=>setDraft(d=>({...d,level:Number(e.target.value)}))}>{labels.map((label,i)=><option key={i} value={i+1}>Lv.{i+1} · {label}</option>)}</select></label>
    <button className="stretching-submit" type="submit">저장</button>
   </form>
  </div>}
  {!readOnly&&levelRename!==null&&<div className="stretching-modal-backdrop" onClick={()=>setLevelRename(null)}>
   <form className="stretching-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()} onSubmit={saveRename}>
    <div className="stretching-modal-title"><strong>Lv.{levelRename} 이름 수정</strong><button type="button" onClick={()=>setLevelRename(null)}><X size={19}/></button></div>
    <label>단계 이름<input autoFocus maxLength={20} value={renameText} onChange={e=>setRenameText(e.target.value)}/></label>
    <p>Lv.1~5 단계는 고정이고 이름만 변경할 수 있어.</p><button type="submit" className="stretching-submit">저장</button>
   </form>
  </div>}
 </div>;
}
